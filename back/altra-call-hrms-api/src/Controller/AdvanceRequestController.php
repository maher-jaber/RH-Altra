<?php

namespace App\Controller;

use App\Entity\AdvanceRequest;
use App\Entity\Notification;
use App\Message\PublishNotificationMessage;
use App\Service\LeaveNotificationService;
use App\Service\SettingsService;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Annotation\Route;

class AdvanceRequestController extends ApiBase
{
    public function __construct(
        private EntityManagerInterface $em,
        private MessageBusInterface $bus,
        private LeaveNotificationService $mailer,
        private SettingsService $settings,
    ) {}

    private function getCurrentUser(Request $request): User
    {
        $u = $this->requireUser($request);
        /** @var User|null $user */
        $user = $this->em->getRepository(User::class)->findOneBy(['apiKey' => $u->apiKey]);
        if (!$user) {
            throw $this->createNotFoundException('User not found for this API key. Create the user via Admin first.');
        }
        return $user;
    }

    #[Route('/api/advances/my', methods: ['GET'])]
    public function my(Request $request): JsonResponse
    {
        $user = $this->getCurrentUser($request);

        $rows = $this->em->getRepository(AdvanceRequest::class)
            ->findBy(['user' => $user], ['id' => 'DESC']);

        return $this->jsonOk(array_map(fn(AdvanceRequest $a) => $this->serialize($a), $rows));
    }

    
    #[Route('/api/advances/{id}', requirements: ['id' => '\\d+'], methods: ['GET'])]
    public function getOne(int $id, Request $request): JsonResponse
    {
        $token = $this->requireUser($request);
        $me = $this->getCurrentUser($request);

        /** @var AdvanceRequest|null $a */
        $a = $this->em->getRepository(AdvanceRequest::class)->find($id);
        if (!$a) return $this->json(['error' => 'not_found'], 404);

        $isAdmin = in_array('ROLE_ADMIN', $token->roles ?? [], true);
        $isOwner = $a->getUser()?->getId() === $me->getId();
        $isManager = $a->getManager()?->getId() === $me->getId();

        if (!$isAdmin && !$isOwner && !$isManager) {
            return $this->json(['error' => 'forbidden'], 403);
        }

        return $this->jsonOk($this->serialize($a));
    }


#[Route('/api/advances', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $user = $this->getCurrentUser($request);
        $data = json_decode((string)$request->getContent(), true) ?: [];

        $amount = (float)($data['amount'] ?? 0);
        if ($amount <= 0) {
            return $this->json(['error' => 'amount_required'], 400);
        }

        $a = new AdvanceRequest();
        $a->setUser($user);
        $a->setManager($user->getManager());
        $a->setAmount($amount);
        $a->setCurrency((string)($data['currency'] ?? 'TND'));
        $a->setReason(isset($data['reason']) ? (string)$data['reason'] : null);

        $status = strtoupper((string)($data['status'] ?? AdvanceRequest::STATUS_SUBMITTED));
        if (!in_array($status, [AdvanceRequest::STATUS_DRAFT, AdvanceRequest::STATUS_SUBMITTED], true)) {
            $status = AdvanceRequest::STATUS_SUBMITTED;
        }
        $a->setStatus($status);

        $this->em->persist($a);
        $this->em->flush();

        // Notify manager only when the request is actually submitted
        if ($a->getStatus() === AdvanceRequest::STATUS_SUBMITTED && $a->getManager()) {
            $mgr = $a->getManager();
            $n = new Notification();
            $n->setUser($mgr);
            $n->setTitle('Avance · Nouvelle demande');
            $n->setActionUrl('/advances/detail/' . $a->getId());
            $n->setPayload($this->serialize($a));
            $n->setBody('Montant: ' . $a->getAmount() . ' ' . $a->getCurrency() . ' · Statut: ' . $a->getStatus());
            $n->setType('ADVANCE');
            $this->em->persist($n);
            $this->em->flush();

            $this->bus->dispatch(new PublishNotificationMessage(
                recipientApiKey: $mgr->getApiKey(),
                title: $n->getTitle(),
                body: (string)$n->getBody(),
                type: $n->getType(),
                notificationId: (string)$n->getId(),
                createdAtIso: $n->getCreatedAt()->format(DATE_ATOM),
                actionUrl: $n->getActionUrl(),
                payload: $n->getPayload()
            ));

            try {
                $base = (string) ($_ENV['FRONTEND_URL'] ?? $_SERVER['FRONTEND_URL'] ?? 'http://localhost:4200');
                $url = rtrim($base,'/') . '/advances/detail/' . $a->getId();
                $emp = $a->getUser();
                $empName = $emp ? ($emp->getFullName() ?: $emp->getEmail()) : '—';
                $html = '<div style="font-family:Arial,sans-serif;line-height:1.4">'
                    . '<h2 style="margin:0 0 12px 0">Nouvelle demande d\'avance</h2>'
                    . '<table style="border-collapse:collapse;width:100%;max-width:680px">'
                    . '<tr><td style="padding:8px 10px;border:1px solid #eee;background:#fafafa;width:180px"><b>Employé</b></td><td style="padding:8px 10px;border:1px solid #eee">'.htmlspecialchars($empName,ENT_QUOTES).'</td></tr>'
                    . '<tr><td style="padding:8px 10px;border:1px solid #eee;background:#fafafa"><b>Montant</b></td><td style="padding:8px 10px;border:1px solid #eee">'.$a->getAmount().' '.$a->getCurrency().'</td></tr>'
                    . '<tr><td style="padding:8px 10px;border:1px solid #eee;background:#fafafa"><b>Statut</b></td><td style="padding:8px 10px;border:1px solid #eee">'.$a->getStatus().'</td></tr>'
                    . '</table>'
                    . '<p style="margin:20px 0"><a href="'.htmlspecialchars($url,ENT_QUOTES).'" style="display:inline-block;background:#0d6efd;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">Ouvrir la demande</a></p>'
                    . '<p style="opacity:.7;font-size:12px;margin-top:18px">ALTRA HRMS · Notification automatique</p>'
                    . '</div>';
                if($this->settings->canSendEmail($mgr,'ADVANCE')) { $this->mailer->notify($mgr->getEmail(), 'Nouvelle demande d\'avance', $html); }
            } catch (\Throwable) { /* best-effort */ }
        }

        return $this->jsonOk($this->serialize($a), 201);
    }

    #[Route('/api/advances/pending', methods: ['GET'])]
    public function pending(Request $request): JsonResponse
    {
        $u = $this->requireUser($request);
        $user = $this->getCurrentUser($request);

        $qb = $this->em->createQueryBuilder()
            ->select('a')
            ->from(AdvanceRequest::class, 'a')
            ->where('a.status = :s')->setParameter('s', AdvanceRequest::STATUS_SUBMITTED)
            ->orderBy('a.id', 'DESC');

        if (!$this->hasRole($u, 'ROLE_ADMIN')) {
            $qb->andWhere('a.manager = :m')->setParameter('m', $user);
        }

        $rows = $qb->getQuery()->getResult();

        return $this->jsonOk(array_map(fn(AdvanceRequest $a) => $this->serialize($a), $rows));
    }

    #[Route('/api/advances/{id}/decision', requirements: ['id' => '\\d+'], methods: ['POST'])]
    public function decide(int $id, Request $request): JsonResponse
    {
        $u = $this->requireUser($request);
        $me = $this->getCurrentUser($request);

        /** @var AdvanceRequest|null $a */
        $a = $this->em->getRepository(AdvanceRequest::class)->find($id);
        if (!$a) return $this->json(['error' => 'not_found'], 404);

        if (!$this->hasRole($u, 'ROLE_ADMIN') && $a->getManager()?->getId() !== $me->getId()) {
            return $this->json(['error' => 'forbidden'], 403);
        }
        if ($a->getStatus() !== AdvanceRequest::STATUS_SUBMITTED) {
            return $this->json(['error' => 'invalid_status'], 400);
        }

        $data = json_decode((string)$request->getContent(), true) ?: [];
        $decision = strtoupper((string)($data['decision'] ?? ''));
        if (!in_array($decision, ['APPROVE', 'REJECT'], true)) {
            return $this->json(['error' => 'decision_required'], 400);
        }

        $a->setStatus($decision === 'APPROVE' ? AdvanceRequest::STATUS_APPROVED : AdvanceRequest::STATUS_REJECTED);
        $this->em->flush();

        // Notify employee about the decision
        if ($a->getUser()) {
            $emp = $a->getUser();
            $n = new Notification();
            $n->setUser($emp);
            $n->setTitle('Avance · Décision');
            $n->setActionUrl('/advances/detail/' . $a->getId());
            $n->setPayload($this->serialize($a));
            $n->setBody($a->getStatus() === AdvanceRequest::STATUS_APPROVED ? 'Votre demande d\'avance a été approuvée.' : 'Votre demande d\'avance a été refusée.');
            $n->setType('ADVANCE');
            $this->em->persist($n);
            $this->em->flush();

            $this->bus->dispatch(new PublishNotificationMessage(
                recipientApiKey: $emp->getApiKey(),
                title: $n->getTitle(),
                body: (string)$n->getBody(),
                type: $n->getType(),
                notificationId: (string)$n->getId(),
                createdAtIso: $n->getCreatedAt()->format(DATE_ATOM),
                actionUrl: $n->getActionUrl(),
                payload: $n->getPayload()
            ));

            try {
                $base = (string) ($_ENV['FRONTEND_URL'] ?? $_SERVER['FRONTEND_URL'] ?? 'http://localhost:4200');
                $url = rtrim($base,'/') . '/advances/detail/' . $a->getId();
                $emp = $a->getUser();
                $empName = $emp ? ($emp->getFullName() ?: $emp->getEmail()) : '—';
                $html = '<div style="font-family:Arial,sans-serif;line-height:1.4">'
                    . '<h2 style="margin:0 0 12px 0">Décision sur votre avance</h2>'
                    . '<table style="border-collapse:collapse;width:100%;max-width:680px">'
                    . '<tr><td style="padding:8px 10px;border:1px solid #eee;background:#fafafa;width:180px"><b>Employé</b></td><td style="padding:8px 10px;border:1px solid #eee">'.htmlspecialchars($empName,ENT_QUOTES).'</td></tr>'
                    . '<tr><td style="padding:8px 10px;border:1px solid #eee;background:#fafafa"><b>Montant</b></td><td style="padding:8px 10px;border:1px solid #eee">'.$a->getAmount().' '.$a->getCurrency().'</td></tr>'
                    . '<tr><td style="padding:8px 10px;border:1px solid #eee;background:#fafafa"><b>Statut</b></td><td style="padding:8px 10px;border:1px solid #eee">'.$a->getStatus().'</td></tr>'
                    . '</table>'
                    . '<p style="margin:20px 0"><a href="'.htmlspecialchars($url,ENT_QUOTES).'" style="display:inline-block;background:#0d6efd;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">Ouvrir la demande</a></p>'
                    . '<p style="opacity:.7;font-size:12px;margin-top:18px">ALTRA HRMS · Notification automatique</p>'
                    . '</div>';
                if($this->settings->canSendEmail($emp,'ADVANCE')) { $this->mailer->notify($emp->getEmail(), 'Décision sur votre avance', $html); }
            } catch (\Throwable) { /* best-effort */ }
        }

        return $this->jsonOk($this->serialize($a));
    }

    private function serialize(AdvanceRequest $a): array
    {
        return [
            'id' => $a->getId(),
            'user' => [
                'id' => $a->getUser()?->getId(),
                'fullName' => $a->getUser()?->getFullName(),
                'email' => $a->getUser()?->getEmail(),
            ],
            'manager' => $a->getManager() ? [
                'id' => $a->getManager()?->getId(),
                'fullName' => $a->getManager()?->getFullName(),
                'email' => $a->getManager()?->getEmail(),
            ] : null,
            'amount' => $a->getAmount(),
            'currency' => $a->getCurrency(),
            'reason' => $a->getReason(),
            'status' => $a->getStatus(),
            'createdAt' => $a->getCreatedAt()->format('c'),
        ];
    }
}

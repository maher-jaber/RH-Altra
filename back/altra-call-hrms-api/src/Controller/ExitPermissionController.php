<?php

namespace App\Controller;

use App\Entity\ExitPermission;
use App\Entity\User;
use App\Entity\Notification;
use App\Message\PublishNotificationMessage;
use App\Service\LeaveNotificationService;
use App\Service\SettingsService;
use Symfony\Component\Messenger\MessageBusInterface;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class ExitPermissionController extends ApiBase
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

        #[Route('/api/exit-permissions/my', methods:['GET'])]
    public function my(Request $r): JsonResponse {
        $u = $this->getCurrentUser($r);
        $pg = $this->parsePagination($r);

        if (!$pg['enabled']) {
            $items = $this->em->getRepository(ExitPermission::class)->findBy(['user'=>$u], ['id'=>'DESC']);
            return $this->jsonOk(['items'=>array_map([$this,'serialize'], $items)]);
        }

        $qb = $this->em->createQueryBuilder()
            ->select('ep')
            ->from(ExitPermission::class, 'ep')
            ->where('ep.user = :u')
            ->setParameter('u', $u)
            ->orderBy('ep.id', 'DESC')
            ->setFirstResult($pg['offset'])
            ->setMaxResults($pg['limit']);

        $items = $qb->getQuery()->getResult();

        $countQb = $this->em->createQueryBuilder()
            ->select('COUNT(ep2.id)')
            ->from(ExitPermission::class, 'ep2')
            ->where('ep2.user = :u')
            ->setParameter('u', $u);

        $total = (int)$countQb->getQuery()->getSingleScalarResult();

        return $this->jsonOk([
            'items'=>array_map([$this,'serialize'], $items),
            'meta'=>[
                'page'=>$pg['page'],
                'limit'=>$pg['limit'],
                'total'=>$total,
                'pages'=>(int)ceil($total / max(1,$pg['limit'])),
            ]
        ]);
    }

    #[Route('/api/exit-permissions/{id}', requirements: ['id' => '\\d+'], methods: ['GET'])]
    public function getOne(int $id, Request $request): JsonResponse
    {
        $token = $this->requireUser($request);
        $me = $this->getCurrentUser($request);

        /** @var ExitPermission|null $e */
        $e = $this->em->getRepository(ExitPermission::class)->find($id);
        if (!$e) return $this->json(['error' => 'not_found'], 404);

        $isAdmin = in_array('ROLE_ADMIN', $token->roles ?? [], true);
        $isOwner = $e->getUser()?->getId() === $me->getId();
        $isMgr1 = $e->getManager()?->getId() === $me->getId();
        $isMgr2 = $e->getManager2()?->getId() === $me->getId();

        if (!$isAdmin && !$isOwner && !$isMgr1 && !$isMgr2) {
            return $this->json(['error' => 'forbidden'], 403);
        }

        return $this->jsonOk($this->serialize($e));
    }

       #[Route('/api/exit-permissions', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $user = $this->getCurrentUser($request);
        $data = json_decode((string)$request->getContent(), true) ?: [];

        $startAt = isset($data['startAt']) ? new \DateTimeImmutable((string)$data['startAt']) : null;
        $endAt = isset($data['endAt']) ? new \DateTimeImmutable((string)$data['endAt']) : null;

        if (!$startAt || !$endAt || $endAt <= $startAt) {
            return $this->json(['error' => 'startAt/endAt invalid'], 400);
        }

        // Rule: date must not be in the past
        // Optional rule: enforce working hours window (configurable in Settings)
        $enforce = (bool)$this->settings->get(\App\Service\SettingsService::KEY_EXIT_ENFORCE_HOURS, false);
        if ($enforce) {
            $ws = (string)$this->settings->get(\App\Service\SettingsService::KEY_EXIT_WORK_START, '08:00');
            $we = (string)$this->settings->get(\App\Service\SettingsService::KEY_EXIT_WORK_END, '18:00');
            // compare times only (HH:MM)
            $startT = $startAt->format('H:i');
            $endT   = $endAt->format('H:i');
            if ($startT < $ws || $endT > $we) {
                return $this->json(['error' => 'outside_work_hours', 'workStart'=>$ws, 'workEnd'=>$we], 409);
            }
        }


        $today = new \DateTimeImmutable('today');
        if ($startAt < $today || $endAt < $today) {
            return $this->json(['error' => 'past_dates'], 400);
        }

        $e = new ExitPermission();
        $e->setUser($user);
        $e->setManager($user->getManager());
        $e->setManager2($user->getManager2());
        $e->setManager($user->getManager());
        $e->setManager2($user->getManager2());
        $e->setStartAt($startAt);
        $e->setEndAt($endAt);
        $e->setReason(isset($data['reason']) ? (string)$data['reason'] : null);

        $status = strtoupper((string)($data['status'] ?? ExitPermission::STATUS_SUBMITTED));
        if (!in_array($status, [ExitPermission::STATUS_DRAFT, ExitPermission::STATUS_SUBMITTED], true)) {
            $status = ExitPermission::STATUS_SUBMITTED;
        }
        $e->setStatus($status);

        $this->em->persist($e);
        $this->em->flush();

        
        // Notifications (manager + RH) + emails (best-effort)
        $employee = $user;
        $recipients = [];
        if ($e->getManager()) { $recipients[$e->getManager()->getId()] = $e->getManager(); }
        if ($e->getManager2()) { $recipients[$e->getManager2()->getId()] = $e->getManager2(); }

        // RH removed.

        foreach ($recipients as $to) {
            $n = new Notification();
            $n->setUser($to);
            $n->setTitle('Autorisation de sortie · Nouvelle demande');
            $n->setBody('Une autorisation de sortie a été soumise et attend traitement.');
            $n->setType('EXIT');
            $n->setActionUrl('/exit-permissions/detail/' . $e->getId());
            $n->setPayload($this->serialize($e));
            $this->em->persist($n);
            $this->em->flush();

            $this->bus->dispatch(new PublishNotificationMessage(
                recipientApiKey: $to->getApiKey(),
                title: $n->getTitle(),
                body: (string)$n->getBody(),
                type: $n->getType(),
                notificationId: (string)$n->getId(),
                createdAtIso: $n->getCreatedAt()->format(DATE_ATOM),
                actionUrl: $n->getActionUrl(),
                payload: $n->getPayload()
            ));

            $base = (string) ($_ENV['FRONTEND_URL'] ?? $_SERVER['FRONTEND_URL'] ?? 'http://localhost:8008');
            $url = rtrim($base, '/') . '/exit-permissions/detail/' . $e->getId();

            $html = $this->mailer->renderEmail(
                title: 'Nouvelle autorisation de sortie',
                intro: 'Une nouvelle demande est en attente de votre validation.',
                rows: [
                    ['Employé', $employee->getFullName() ?: $employee->getEmail()],
                    ['Date', (string)$e->getStartAt()?->format('Y-m-d')],
                    ['Heure', (string)$e->getStartAt()?->format('H:i') . ' → ' . (string)$e->getEndAt()?->format('H:i')],
                ],
                ctaUrl: $url,
                ctaLabel: 'Ouvrir la demande'
            );
            if ($this->settings->canSendEmail($to, 'EXIT')) { $this->mailer->notify($to->getEmail(), 'Nouvelle autorisation de sortie', $html); }
        }

        return $this->jsonOk($this->serialize($e), 201);
    }

        #[Route('/api/exit-permissions/pending', methods:['GET'])]
    public function pending(Request $r): JsonResponse {
        $token = $this->requireUser($r);
        $me = $this->getCurrentUser($r);

        $isAdmin = $this->hasRole($token, 'ROLE_ADMIN');

        $pg = $this->parsePagination($r);
        $st1 = ExitPermission::STATUS_SUBMITTED;
        $st2 = ExitPermission::STATUS_MANAGER_APPROVED;

        $qb = $this->em->createQueryBuilder()
            ->select('ep', 'u')
            ->from(ExitPermission::class, 'ep')
            ->leftJoin('ep.user', 'u')
            ->orderBy('ep.id', 'DESC');

        $countQb = $this->em->createQueryBuilder()
            ->select('COUNT(ep2.id)')
            ->from(ExitPermission::class, 'ep2');
        // For relationship-based filtering we need to be able to reference the employee's manager.
        $countQb->leftJoin('ep2.user', 'u2');

        if ($isAdmin) {
            $qb->where('ep.status IN (:sts)')
                ->setParameter('sts', [$st1, $st2]);
            $countQb->where('ep2.status IN (:sts)')
                ->setParameter('sts', [$st1, $st2]);
        } else {
            // Relationship-based validation: show only items that still need THIS user's signature.
            // NOTE: Use IDENTITY() comparisons to avoid edge-cases with proxy/detached entities.
            $meId = (int)$me->getId();

            $qb->where('ep.status IN (:sts)')
                ->andWhere('(
                    (IDENTITY(ep.manager) = :meId)
                    OR
                    (IDENTITY(ep.manager2) = :meId)
                    OR
                    (u IS NOT NULL AND IDENTITY(u.manager) = :meId)
                    OR
                    (u IS NOT NULL AND IDENTITY(u.manager2) = :meId)
                )')
                ->setParameter('sts', [$st1, $st2])
                ->setParameter('meId', $meId);

            $countQb->where('ep2.status IN (:sts)')
                ->andWhere('(
                    (IDENTITY(ep2.manager) = :meId)
                    OR
                    (IDENTITY(ep2.manager2) = :meId)
                    OR
                    (u2 IS NOT NULL AND IDENTITY(u2.manager) = :meId)
                    OR
                    (u2 IS NOT NULL AND IDENTITY(u2.manager2) = :meId)
                )')
                ->setParameter('sts', [$st1, $st2])
                ->setParameter('meId', $meId);
        }

        if ($pg['enabled']) {
            $qb->setFirstResult($pg['offset'])->setMaxResults($pg['limit']);
        }

        $items = $qb->getQuery()->getResult();
        $total = (int)$countQb->getQuery()->getSingleScalarResult();

        if (!$pg['enabled']) {
            return $this->jsonOk(['items'=>array_map([$this,'serialize'], $items)]);
        }

        return $this->jsonOk([
            'items'=>array_map([$this,'serialize'], $items),
            'meta'=>[
                'page'=>$pg['page'],
                'limit'=>$pg['limit'],
                'total'=>$total,
                'pages'=>(int)ceil($total / max(1,$pg['limit'])),
            ]
        ]);
    }

        #[Route('/api/exit-permissions/{id}/decision', requirements: ['id' => '\\d+'], methods: ['POST'])]
    public function decide(int $id, Request $request): JsonResponse
    {
        $u = $this->requireUser($request);
        $me = $this->getCurrentUser($request);

        /** @var ExitPermission|null $e */
        $e = $this->em->getRepository(ExitPermission::class)->find($id);
        if (!$e) return $this->json(['error' => 'not_found'], 404);

        $isAdmin = $this->hasRole($u, 'ROLE_ADMIN');
        $isMgr1 = $e->getManager()?->getId() === $me->getId();
        $isMgr2 = $e->getManager2()?->getId() === $me->getId();
        if (!$isAdmin && !$isMgr1 && !$isMgr2) {
            return $this->json(['error' => 'forbidden'], 403);
        }
        if (!in_array($e->getStatus(), [ExitPermission::STATUS_SUBMITTED, ExitPermission::STATUS_MANAGER_APPROVED], true)) {
            return $this->json(['error' => 'invalid_status'], 400);
        }

        $data = json_decode((string)$request->getContent(), true) ?: [];
        $decision = strtoupper((string)($data['decision'] ?? ''));
        if (!in_array($decision, ['APPROVE', 'REJECT'], true)) {
            return $this->json(['error' => 'decision_required'], 400);
        }

        $comment = isset($data['comment']) ? trim((string)$data['comment']) : null;
        $now = new \DateTimeImmutable();

        if ($decision === 'REJECT') {
            if ($isMgr2 && !$isAdmin) {
                $e->setManager2SignedAt($now);
                $e->setManager2Comment($comment);
            } else {
                $e->setManagerSignedAt($now);
                $e->setManagerComment($comment);
            }
            $e->setStatus(ExitPermission::STATUS_REJECTED);
            $this->em->flush();
        } else {
            if ($isMgr2 && !$isAdmin) {
                if ($e->getManager2SignedAt()) { return $this->json(['error'=>'already_signed'],400); }
                $e->setManager2SignedAt($now);
                $e->setManager2Comment($comment);
            } else {
                if ($e->getManagerSignedAt()) { return $this->json(['error'=>'already_signed'],400); }
                $e->setManagerSignedAt($now);
                $e->setManagerComment($comment);
            }

            if ($e->isFullyApproved()) {
                $e->setStatus(ExitPermission::STATUS_APPROVED);
            } else {
                $e->setStatus(ExitPermission::STATUS_MANAGER_APPROVED);
            }
            $this->em->flush();
        }

        
        // Notifications (user + managers + RH) + emails (best-effort)
        $st = $this->mailer->presentStatus('EXIT', $e->getStatus());
        $statusFr = $st['label'];

        $recipients = [];
        // employee
        if ($e->getUser()) { $recipients[$e->getUser()->getId()] = $e->getUser(); }
        // managers
        if ($e->getManager()) { $recipients[$e->getManager()->getId()] = $e->getManager(); }
        if ($e->getManager2()) { $recipients[$e->getManager2()->getId()] = $e->getManager2(); }
        // RH removed.

        foreach ($recipients as $to) {
            $n = new Notification();
            $n->setUser($to);
            $n->setTitle('Autorisation de sortie · Mise à jour');
            $n->setBody('Statut: ' . $statusFr);
            $n->setType('EXIT');
            $n->setActionUrl('/exit-permissions/detail/' . $e->getId());
            $n->setPayload($this->serialize($e));
            $this->em->persist($n);
            $this->em->flush();

            $this->bus->dispatch(new PublishNotificationMessage(
                recipientApiKey: $to->getApiKey(),
                title: $n->getTitle(),
                body: (string)$n->getBody(),
                type: $n->getType(),
                notificationId: (string)$n->getId(),
                createdAtIso: $n->getCreatedAt()->format(DATE_ATOM),
                actionUrl: $n->getActionUrl(),
                payload: $n->getPayload()
            ));

            $base = (string) ($_ENV['FRONTEND_URL'] ?? $_SERVER['FRONTEND_URL'] ?? 'http://localhost:8008');
            $url = rtrim($base, '/') . '/exit-permissions/detail/' . $e->getId();

            $employee = $e->getUser();
            $empName = $employee ? ($employee->getFullName() ?: $employee->getEmail()) : '—';

            $html = $this->mailer->renderEmail(
                title: 'Autorisation de sortie - ' . $statusFr,
                intro: 'Le statut de la demande a été mis à jour.',
                rows: [
                    ['Employé', $empName],
                    ['Date', (string)$e->getStartAt()?->format('Y-m-d')],
                    ['Heure', (string)$e->getStartAt()?->format('H:i') . ' → ' . (string)$e->getEndAt()?->format('H:i')],
                    ['Statut', ['html' => $this->mailer->renderInlineBadges($st['badges']).'<div style="margin-top:6px;color:#374151;font-size:13px;">'.htmlspecialchars($statusFr, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8').'</div>']],
                ],
                ctaUrl: $url,
                ctaLabel: 'Ouvrir la demande',
                finePrint: $comment ? ('Commentaire: ' . $comment) : null
            );
            if ($this->settings->canSendEmail($to, 'EXIT')) { $this->mailer->notify($to->getEmail(), 'Autorisation de sortie - ' . $statusFr, $html); }
        }

return $this->jsonOk($this->serialize($e));
    }

    private function serialize(ExitPermission $e): array
    {
        return [
            'id' => $e->getId(),
            'user' => [
                'id' => $e->getUser()?->getId(),
                'fullName' => $e->getUser()?->getFullName(),
                'email' => $e->getUser()?->getEmail(),
            ],
            'manager' => $e->getManager() ? [
                'id' => $e->getManager()?->getId(),
                'fullName' => $e->getManager()?->getFullName(),
                'email' => $e->getManager()?->getEmail(),
            ] : null,
            'manager2' => $e->getManager2() ? [
                'id' => $e->getManager2()?->getId(),
                'fullName' => $e->getManager2()?->getFullName(),
                'email' => $e->getManager2()?->getEmail(),
            ] : null,
            'managerSignedAt' => $e->getManagerSignedAt()?->format('c'),
            'managerComment' => $e->getManagerComment(),
            'manager2SignedAt' => $e->getManager2SignedAt()?->format('c'),
            'manager2Comment' => $e->getManager2Comment(),
            'startAt' => $e->getStartAt()->format('c'),
            'endAt' => $e->getEndAt()->format('c'),
            'reason' => $e->getReason(),
            'status' => $e->getStatus(),
            'createdAt' => $e->getCreatedAt()->format('c'),
        ];
    }
}
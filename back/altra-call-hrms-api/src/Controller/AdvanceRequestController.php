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
        $pg = $this->parsePagination($request);

        if (!$pg['enabled']) {
            $rows = $this->em->getRepository(AdvanceRequest::class)
                ->findBy(['user' => $user], ['id' => 'DESC']);
            return $this->jsonOk(array_map(fn(AdvanceRequest $a) => $this->serialize($a), $rows));
        }

        $qb = $this->em->createQueryBuilder()
            ->select('a')
            ->from(AdvanceRequest::class, 'a')
            ->where('a.user = :u')
            ->setParameter('u', $user)
            ->orderBy('a.id', 'DESC')
            ->setFirstResult($pg['offset'])
            ->setMaxResults($pg['limit']);

        $rows = $qb->getQuery()->getResult();

        $countQb = $this->em->createQueryBuilder()
            ->select('COUNT(a2.id)')
            ->from(AdvanceRequest::class, 'a2')
            ->where('a2.user = :u')
            ->setParameter('u', $user);

        $total = (int)$countQb->getQuery()->getSingleScalarResult();

        return $this->jsonOk([
            'items' => array_map(fn(AdvanceRequest $a) => $this->serialize($a), $rows),
            'meta' => [
                'page' => $pg['page'],
                'limit' => $pg['limit'],
                'total' => $total,
                'pages' => (int)ceil($total / max(1,$pg['limit'])),
            ]
        ]);
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
        // Allow both manager1 and manager2 to view the detail
        $isManager = $a->getManager()?->getId() === $me->getId();
        $isManager2 = $a->getManager2()?->getId() === $me->getId();

        if (!$isAdmin && !$isOwner && !$isManager && !$isManager2) {
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

        $periodYear = (int)($data['periodYear'] ?? (new \DateTimeImmutable())->format('Y'));
        $periodMonth = (int)($data['periodMonth'] ?? (new \DateTimeImmutable())->format('n'));
        if ($periodYear < 2000 || $periodYear > 2100 || $periodMonth < 1 || $periodMonth > 12) {
            return $this->json(['error' => 'invalid_period'], 400);
        }

        // Enforce business rule: advances are only allowed for the current month.
        $now = new \DateTimeImmutable();
        $cy = (int)$now->format('Y');
        $cm = (int)$now->format('n');
        if ($periodYear !== $cy || $periodMonth !== $cm) {
            return $this->json(['error' => 'advance_only_current_month', 'currentYear' => $cy, 'currentMonth' => $cm], 400);
        }
        $periodLabel = sprintf('%02d/%04d', $periodMonth, $periodYear);

        $netSalary = $user->getNetSalary();
        if ($netSalary === null || $netSalary <= 0) {
            return $this->json(['error' => 'net_salary_missing'], 400);
        }
        $maxAllowed = round($netSalary * 0.40, 2);
        if ($amount > $maxAllowed + 0.00001) {
            return $this->json(['error' => 'amount_exceeds_limit', 'max' => $maxAllowed], 400);
        }

        // Enforce: one advance per user per month (reuse draft if exists)
        $repo = $this->em->getRepository(AdvanceRequest::class);
        /** @var AdvanceRequest|null $existing */
        $existing = $repo->findOneBy(['user' => $user, 'periodYear' => $periodYear, 'periodMonth' => $periodMonth]);
        if ($existing) {
            if ($existing->getStatus() !== AdvanceRequest::STATUS_DRAFT) {
                return $this->json(['error' => 'already_requested_for_month', 'existingId' => $existing->getId(), 'period' => $periodLabel], 409);
            }
            // Update existing draft instead of creating a new one
            $a = $existing;
            $a->setAmount($amount);
            $a->setCurrency((string)($data['currency'] ?? $a->getCurrency() ?? 'TND'));
            $a->setReason(isset($data['reason']) ? (string)$data['reason'] : $a->getReason());
            $status = strtoupper((string)($data['status'] ?? AdvanceRequest::STATUS_SUBMITTED));
            if (!in_array($status, [AdvanceRequest::STATUS_DRAFT, AdvanceRequest::STATUS_SUBMITTED], true)) {
                $status = AdvanceRequest::STATUS_SUBMITTED;
            }
            $a->setStatus($status);
            $a->touch();
            $this->em->flush();
        } else {

        $a = new AdvanceRequest();
        $a->setUser($user);
        $a->setManager($user->getManager());
        $a->setManager2($user->getManager2());
        $a->setAmount($amount);
        $a->setCurrency((string)($data['currency'] ?? 'TND'));
        $a->setReason(isset($data['reason']) ? (string)$data['reason'] : null);
        $a->setPeriod($periodYear, $periodMonth);

        $status = strtoupper((string)($data['status'] ?? AdvanceRequest::STATUS_SUBMITTED));
        if (!in_array($status, [AdvanceRequest::STATUS_DRAFT, AdvanceRequest::STATUS_SUBMITTED], true)) {
            $status = AdvanceRequest::STATUS_SUBMITTED;
        }
        $a->setStatus($status);

        $this->em->persist($a);
        $this->em->flush();

                }

        // Notify manager(s) only when the request is actually submitted (manager1 + manager2)
        if ($a->getStatus() === AdvanceRequest::STATUS_SUBMITTED) {
            $recipients = [];
            if ($a->getManager()) { $recipients[$a->getManager()->getId()] = $a->getManager(); }
            if ($a->getManager2()) { $recipients[$a->getManager2()->getId()] = $a->getManager2(); }

            foreach ($recipients as $mgr) {
                $n = new Notification();
                $n->setUser($mgr);
                $n->setTitle('Avance · Nouvelle demande (' . $periodLabel . ')');
                $n->setActionUrl('/advances/detail/' . $a->getId());
                $n->setPayload($this->serialize($a));
                $st = $this->mailer->presentStatus('ADVANCE', $a->getStatus());
                $n->setBody('Période: ' . $periodLabel . ' · Montant: ' . $a->getAmount() . ' ' . $a->getCurrency() . ' · Statut: ' . $st['label']);
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
                    $st = $this->mailer->presentStatus('ADVANCE', $a->getStatus());
                    $html = $this->mailer->renderEmail(
                        title: "Nouvelle demande d'avance",
                        intro: 'Une nouvelle demande est en attente de votre validation.',
                        rows: [
                            ['Employé', $empName],
                            ['Période', $periodLabel],
                            ['Montant', $a->getAmount().' '.$a->getCurrency()],
                            ['Statut', ['html' => $this->mailer->renderInlineBadges($st['badges']).'<div style="margin-top:6px;color:#374151;font-size:13px;">'.htmlspecialchars($st['label'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8').'</div>']],
                        ],
                        ctaUrl: $url,
                        ctaLabel: 'Ouvrir la demande'
                    );
                    if ($this->settings->canSendEmail($mgr, 'ADVANCE')) { $this->mailer->notify($mgr->getEmail(), 'Nouvelle demande d\'avance', $html); }
                } catch (\Throwable) { /* best-effort */ }
            }


            // RH removed: only employee + managers are notified.

        }

        return $this->jsonOk($this->serialize($a), 201);
    }

    #[Route('/api/advances/pending', methods: ['GET'])]
    public function pending(Request $request): JsonResponse
    {
        $token = $this->requireUser($request);
        $me = $this->getCurrentUser($request);

        $isAdmin = $this->hasRole($token, 'ROLE_ADMIN');

        $pg = $this->parsePagination($request);

        $st1 = AdvanceRequest::STATUS_SUBMITTED;
        $st2 = AdvanceRequest::STATUS_MANAGER_APPROVED;

        $qb = $this->em->createQueryBuilder()
            ->select('a', 'u')
            ->from(AdvanceRequest::class, 'a')
            ->leftJoin('a.user', 'u')
            ->orderBy('a.id', 'DESC');

        $countQb = $this->em->createQueryBuilder()
            ->select('COUNT(a2.id)')
            ->from(AdvanceRequest::class, 'a2')
            ->leftJoin('a2.user', 'u2');

        if ($isAdmin) {
            $qb->where('a.status IN (:sts)')
                ->setParameter('sts', [$st1, $st2]);
            $countQb->where('a2.status IN (:sts)')
                ->setParameter('sts', [$st1, $st2]);
        } else {
            // Relationship-based validation: show only items that still need THIS user's signature (manager1 OR manager2)
            // NOTE: Use IDENTITY() comparisons to avoid edge-cases with proxy/detached entities.
            $meId = (int)$me->getId();

            $qb->where('a.status IN (:sts)')
                ->andWhere('(
                    (IDENTITY(a.manager) = :meId)
                    OR
                    (IDENTITY(a.manager2) = :meId)
                    OR
                    (u IS NOT NULL AND IDENTITY(u.manager) = :meId)
                    OR
                    (u IS NOT NULL AND IDENTITY(u.manager2) = :meId)
                )')
                ->setParameter('sts', [$st1, $st2])
                ->setParameter('meId', $meId);

            $countQb->where('a2.status IN (:sts)')
                ->andWhere('(
                    (IDENTITY(a2.manager) = :meId)
                    OR
                    (IDENTITY(a2.manager2) = :meId)
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

        $rows = $qb->getQuery()->getResult();
        $total = (int)$countQb->getQuery()->getSingleScalarResult();

        if (!$pg['enabled']) {
            return $this->jsonOk(array_map(fn(AdvanceRequest $a) => $this->serialize($a), $rows));
        }

        return $this->jsonOk([
            'items' => array_map(fn(AdvanceRequest $a) => $this->serialize($a), $rows),
            'meta' => [
                'page' => $pg['page'],
                'limit' => $pg['limit'],
                'total' => $total,
                'pages' => (int)ceil($total / max(1, $pg['limit'])),
            ],
        ]);
    }

    #[Route('/api/advances/{id}/decision', requirements: ['id' => '\\d+'], methods: ['POST'])]
    public function decide(int $id, Request $request): JsonResponse
    {
        $u = $this->requireUser($request);
        $me = $this->getCurrentUser($request);

        /** @var AdvanceRequest|null $a */
        $a = $this->em->getRepository(AdvanceRequest::class)->find($id);
        if (!$a) return $this->json(['error' => 'not_found'], 404);

        $isAdmin = $this->hasRole($u, 'ROLE_ADMIN');
        $isMgr1 = $a->getManager()?->getId() === $me->getId();
        $isMgr2 = $a->getManager2()?->getId() === $me->getId();
        if (!$isAdmin && !$isMgr1 && !$isMgr2) {
            return $this->json(['error' => 'forbidden'], 403);
        }
        if (!in_array($a->getStatus(), [AdvanceRequest::STATUS_SUBMITTED, AdvanceRequest::STATUS_MANAGER_APPROVED], true)) {
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
                $a->setManager2SignedAt($now);
                $a->setManager2Comment($comment);
            } else {
                // admin can reject as well -> store on managerComment for trace
                $a->setManagerSignedAt($now);
                $a->setManagerComment($comment);
            }
            $a->setStatus(AdvanceRequest::STATUS_REJECTED);
            $this->em->flush();
        } else {
            if ($isMgr2 && !$isAdmin) {
                if ($a->getManager2SignedAt()) {
                    return $this->json(['error' => 'already_signed'], 400);
                }
                $a->setManager2SignedAt($now);
                $a->setManager2Comment($comment);
            } else {
                if ($a->getManagerSignedAt()) {
                    return $this->json(['error' => 'already_signed'], 400);
                }
                $a->setManagerSignedAt($now);
                $a->setManagerComment($comment);
            }

            if ($a->isFullyApproved()) {
                $a->setStatus(AdvanceRequest::STATUS_APPROVED);
                $this->em->flush();
            } else {
                $a->setStatus(AdvanceRequest::STATUS_MANAGER_APPROVED);
                $this->em->flush();

                // Notify the other manager if still pending
                $next = null;
                if ($a->getManager() && $a->getManagerSignedAt() === null) $next = $a->getManager();
                if ($a->getManager2() && $a->getManager2SignedAt() === null) $next = $a->getManager2();
                if ($next) {
                    $n = new Notification();
                    $n->setUser($next);
                    $n->setTitle('Avance · Validation requise');
                    $n->setActionUrl('/advances/detail/' . $a->getId());
                    $n->setPayload($this->serialize($a));
                    $n->setBody('Une demande d\'avance attend votre validation (double validation requise).');
                    $n->setType('ADVANCE');
                    $this->em->persist($n);
                    $this->em->flush();
                    $this->bus->dispatch(new PublishNotificationMessage(
                        recipientApiKey: $next->getApiKey(),
                        title: $n->getTitle(),
                        body: (string)$n->getBody(),
                        type: $n->getType(),
                        notificationId: (string)$n->getId(),
                        createdAtIso: $n->getCreatedAt()->format(DATE_ATOM),
                        actionUrl: $n->getActionUrl(),
                        payload: $n->getPayload()
                    ));
                }
            }
        }

        $periodLabel = sprintf('%02d/%04d', $a->getPeriodMonth(), $a->getPeriodYear());

        // Notify employee only for final decision (APPROVED or REJECTED)
        if ($a->getUser() && in_array($a->getStatus(), [AdvanceRequest::STATUS_APPROVED, AdvanceRequest::STATUS_REJECTED], true)) {
            $emp = $a->getUser();
            $n = new Notification();
            $n->setUser($emp);
            $n->setTitle('Avance · Décision (' . $periodLabel . ')');
            $n->setActionUrl('/advances/detail/' . $a->getId());
            $n->setPayload($this->serialize($a));
            $n->setBody($a->getStatus() === AdvanceRequest::STATUS_APPROVED ? 'Votre demande d\'avance a été approuvée (double validation).' : 'Votre demande d\'avance a été refusée.');
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
                $st = $this->mailer->presentStatus('ADVANCE', $a->getStatus());
                $html = $this->mailer->renderEmail(
                    title: 'Décision sur votre avance',
                    intro: $a->getStatus() === AdvanceRequest::STATUS_APPROVED ? "Votre demande d'avance a été approuvée." : "Votre demande d'avance a été refusée.",
                    rows: [
                        ['Employé', $empName],
                        ['Période', $periodLabel],
                        ['Montant', $a->getAmount().' '.$a->getCurrency()],
                        ['Statut', ['html' => $this->mailer->renderInlineBadges($st['badges']).'<div style="margin-top:6px;color:#374151;font-size:13px;">'.htmlspecialchars($st['label'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8').'</div>']],
                    ],
                    ctaUrl: $url,
                    ctaLabel: 'Ouvrir la demande'
                );
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
            'manager2' => $a->getManager2() ? [
                'id' => $a->getManager2()?->getId(),
                'fullName' => $a->getManager2()?->getFullName(),
                'email' => $a->getManager2()?->getEmail(),
            ] : null,
            'managerSignedAt' => $a->getManagerSignedAt()?->format('c'),
            'manager2SignedAt' => $a->getManager2SignedAt()?->format('c'),
            'managerComment' => $a->getManagerComment(),
            'manager2Comment' => $a->getManager2Comment(),
            'amount' => $a->getAmount(),
            'currency' => $a->getCurrency(),
            'reason' => $a->getReason(),
            'status' => $a->getStatus(),
            'periodYear' => $a->getPeriodYear(),
            'periodMonth' => $a->getPeriodMonth(),
            'createdAt' => $a->getCreatedAt()->format('c'),
            'updatedAt' => $a->getUpdatedAt()->format('c'),
        ];
    }
}

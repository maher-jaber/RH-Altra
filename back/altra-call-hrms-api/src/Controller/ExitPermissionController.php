<?php

namespace App\Controller;

use App\Entity\ExitPermission;
use App\Entity\User;
use App\Service\SettingsService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class ExitPermissionController extends ApiBase
{
    public function __construct(private EntityManagerInterface $em, private SettingsService $settings) {}

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

        return $this->jsonOk($this->serialize($e), 201);
    }

        #[Route('/api/exit-permissions/pending', methods:['GET'])]
    public function pending(Request $r): JsonResponse {
        $token = $this->requireUser($r);
        $me = $this->getCurrentUser($r);

        $isAdmin = $this->hasRole($token, 'ROLE_ADMIN');
        $isManager = $this->hasRole($token, 'ROLE_SUPERIOR');
        if (!$isAdmin && !$isManager) {
            return $this->json(['error'=>'forbidden'],403);
        }

        $pg = $this->parsePagination($r);
        $st1 = ExitPermission::STATUS_SUBMITTED;
        $st2 = ExitPermission::STATUS_MANAGER_APPROVED;

        $qb = $this->em->createQueryBuilder()
            ->select('ep')
            ->from(ExitPermission::class, 'ep')
            ->orderBy('ep.id', 'DESC');

        $countQb = $this->em->createQueryBuilder()
            ->select('COUNT(ep2.id)')
            ->from(ExitPermission::class, 'ep2');

        if ($isAdmin) {
            $qb->where('ep.status IN (:sts)')
                ->setParameter('sts', [$st1, $st2]);
            $countQb->where('ep2.status IN (:sts)')
                ->setParameter('sts', [$st1, $st2]);
        } else {
            $qb->where('ep.status IN (:sts)')
                ->andWhere('(
                    (ep.manager = :me AND ep.managerSignedAt IS NULL)
                    OR
                    (ep.manager2 = :me AND ep.manager2SignedAt IS NULL)
                )')
                ->setParameter('sts', [$st1, $st2])
                ->setParameter('me', $me);

            $countQb->where('ep2.status IN (:sts)')
                ->andWhere('(
                    (ep2.manager = :me AND ep2.managerSignedAt IS NULL)
                    OR
                    (ep2.manager2 = :me AND ep2.manager2SignedAt IS NULL)
                )')
                ->setParameter('sts', [$st1, $st2])
                ->setParameter('me', $me);
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
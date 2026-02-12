<?php

namespace App\Controller;

use App\Entity\AdvanceRequest;
use App\Entity\DailyReport;
use App\Entity\ExitPermission;
use App\Entity\LeaveRequest;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Admin / HR: rich "People Hub" endpoints.
 */
class HrPeopleHubController extends ApiBase
{
    public function __construct(private EntityManagerInterface $em) {}

    private function requireHrOrAdmin(Request $request): void
    {
        $u = $this->requireUser($request);
        if (!$this->hasRole($u, 'ROLE_ADMIN') && !$this->hasRole($u, 'ROLE_HR')) {
            throw $this->createAccessDeniedException('Forbidden');
        }
    }

    private function userArr(User $u): array
    {
        return [
            'id' => $u->getId(),
            'fullName' => $u->getFullName(),
            'email' => $u->getEmail(),
            'roles' => $u->getRoles(),
            'department' => $u->getDepartment() ? [
                'id' => $u->getDepartment()->getId(),
                'name' => $u->getDepartment()->getName(),
            ] : null,
            'manager' => $u->getManager() ? [
                'id' => $u->getManager()->getId(),
                'fullName' => $u->getManager()->getFullName(),
                'email' => $u->getManager()->getEmail(),
            ] : null,
        ];
    }

    #[Route('/api/hr/employees', methods: ['GET'])]
    public function employees(Request $request): JsonResponse
    {
        $this->requireHrOrAdmin($request);
        $search = trim((string)$request->query->get('search', ''));

        $qb = $this->em->createQueryBuilder()
            ->select('u', 'd', 'm')
            ->from(User::class, 'u')
            ->leftJoin('u.department', 'd')
            ->leftJoin('u.manager', 'm')
            ->orderBy('u.fullName', 'ASC');

        if ($search !== '') {
            $qb->andWhere('LOWER(u.fullName) LIKE :q OR LOWER(u.email) LIKE :q')
               ->setParameter('q', '%' . mb_strtolower($search) . '%');
        }

        $rows = $qb->getQuery()->getResult();

        return $this->jsonOk([
            'items' => array_map(fn(User $u) => $this->userArr($u), $rows),
        ]);
    }

    #[Route('/api/hr/calendar', methods: ['GET'])]
    public function calendar(Request $request): JsonResponse
    {
        $this->requireHrOrAdmin($request);
        $start = (string)$request->query->get('start', '');
        $end = (string)$request->query->get('end', '');
        if (!$start || !$end) {
            return $this->jsonOk(['items' => []]);
        }
        $userId = (int)$request->query->get('userId', 0);

        $from = new \DateTimeImmutable($start . ' 00:00:00');
        $to = new \DateTimeImmutable($end . ' 23:59:59');

        $items = [];

        // Leaves (overlap range)
        $qb = $this->em->createQueryBuilder()
            ->select('l', 'u', 'd', 't')
            ->from(LeaveRequest::class, 'l')
            ->join('l.user', 'u')
            ->leftJoin('u.department', 'd')
            ->leftJoin('l.type', 't')
            ->andWhere('l.startDate <= :to AND l.endDate >= :from')
            ->setParameter('from', $from)
            ->setParameter('to', $to)
            ->orderBy('l.startDate', 'ASC');
        if ($userId > 0) {
            $qb->andWhere('u.id = :uid')->setParameter('uid', $userId);
        }
        foreach ($qb->getQuery()->getResult() as $l) {
            /** @var LeaveRequest $l */
            $u = $l->getUser();
            $items[] = [
                'id' => 'LEAVE-' . $l->getId(),
                'entityId' => $l->getId(),
                'kind' => 'LEAVE',
                'title' => sprintf('%s · %s', $u?->getFullName() ?: ($u?->getEmail() ?: 'Employé'), $l->getType()?->getLabel() ?: 'Congé'),
                'start' => $l->getStartDate()->format('Y-m-d') . ' 00:00:00',
                'end' => $l->getEndDate()->format('Y-m-d') . ' 00:00:00',
                'status' => $l->getStatus(),
                'user' => $this->userArr($u),
                'meta' => [
                    'typeLabel' => $l->getType()?->getLabel(),
                ],
            ];
        }

        // Exits (overlap range)
        $qb = $this->em->createQueryBuilder()
            ->select('x', 'u', 'd')
            ->from(ExitPermission::class, 'x')
            ->join('x.user', 'u')
            ->leftJoin('u.department', 'd')
            ->andWhere('x.startAt <= :to AND x.endAt >= :from')
            ->setParameter('from', $from)
            ->setParameter('to', $to)
            ->orderBy('x.startAt', 'ASC');
        if ($userId > 0) {
            $qb->andWhere('u.id = :uid')->setParameter('uid', $userId);
        }
        foreach ($qb->getQuery()->getResult() as $x) {
            /** @var ExitPermission $x */
            $u = $x->getUser();
            $items[] = [
                'id' => 'EXIT-' . $x->getId(),
                'entityId' => $x->getId(),
                'kind' => 'EXIT',
                'title' => sprintf('%s · Sortie', $u?->getFullName() ?: ($u?->getEmail() ?: 'Employé')),
                'start' => $x->getStartAt()->format('Y-m-d H:i:s'),
                'end' => $x->getEndAt()->format('Y-m-d H:i:s'),
                'status' => $x->getStatus(),
                'user' => $this->userArr($u),
            ];
        }

        // Advances (use createdAt for calendar + month period in meta)
        $qb = $this->em->createQueryBuilder()
            ->select('a', 'u', 'd')
            ->from(AdvanceRequest::class, 'a')
            ->join('a.user', 'u')
            ->leftJoin('u.department', 'd')
            ->andWhere('a.createdAt BETWEEN :from AND :to')
            ->setParameter('from', $from)
            ->setParameter('to', $to)
            ->orderBy('a.createdAt', 'ASC');
        if ($userId > 0) {
            $qb->andWhere('u.id = :uid')->setParameter('uid', $userId);
        }
        foreach ($qb->getQuery()->getResult() as $a) {
            /** @var AdvanceRequest $a */
            $u = $a->getUser();
            $items[] = [
                'id' => 'ADVANCE-' . $a->getId(),
                'entityId' => $a->getId(),
                'kind' => 'ADVANCE',
                'title' => sprintf('%s · Avance %s %s', $u?->getFullName() ?: ($u?->getEmail() ?: 'Employé'), $a->getAmount(), $a->getCurrency()),
                'start' => $a->getCreatedAt()->format('Y-m-d H:i:s'),
                'end' => $a->getCreatedAt()->format('Y-m-d H:i:s'),
                'status' => $a->getStatus(),
                'user' => $this->userArr($u),
                'meta' => [
                    'periodYear' => $a->getPeriodYear(),
                    'periodMonth' => $a->getPeriodMonth(),
                ],
            ];
        }

        // Daily reports (optional): date within range
        $qb = $this->em->createQueryBuilder()
            ->select('r', 'u', 'd')
            ->from(DailyReport::class, 'r')
            ->join('r.user', 'u')
            ->leftJoin('u.department', 'd')
            ->andWhere('r.day BETWEEN :d1 AND :d2')
            ->setParameter('d1', $from)
            ->setParameter('d2', $to)
            ->orderBy('r.day', 'ASC');
        if ($userId > 0) {
            $qb->andWhere('u.id = :uid')->setParameter('uid', $userId);
        }
        foreach ($qb->getQuery()->getResult() as $r) {
            /** @var DailyReport $r */
            $u = $r->getUser();
            $items[] = [
                'id' => 'REPORT-' . $r->getId(),
                'entityId' => $r->getId(),
                'kind' => 'REPORT',
                'title' => sprintf('%s · CR', $u?->getFullName() ?: ($u?->getEmail() ?: 'Employé')),
                'start' => $r->getDay()->format('Y-m-d 00:00:00'),
                'end' => $r->getDay()->format('Y-m-d 00:00:00'),
                'user' => $this->userArr($u),
            ];
        }

        return $this->jsonOk(['items' => $items]);
    }

    #[Route('/api/hr/leaves', methods: ['GET'])]
    public function leaves(Request $request): JsonResponse
    {
        $this->requireHrOrAdmin($request);
        $pg = $this->parsePagination($request);
        $from = trim((string)$request->query->get('from', ''));
        $to = trim((string)$request->query->get('to', ''));
        $status = trim((string)$request->query->get('status', ''));
        $search = trim((string)$request->query->get('search', ''));
        $userId = (int)$request->query->get('userId', 0);

        $fromDt = $from ? new \DateTimeImmutable($from . ' 00:00:00') : null;
        $toDt = $to ? new \DateTimeImmutable($to . ' 23:59:59') : null;

        $qb = $this->em->createQueryBuilder()
            ->select('l', 'u', 'd', 't')
            ->from(LeaveRequest::class, 'l')
            ->join('l.user', 'u')
            ->leftJoin('u.department', 'd')
            ->leftJoin('l.type', 't')
            ->orderBy('l.id', 'DESC');

        if ($fromDt && $toDt) {
            $qb->andWhere('l.startDate <= :to AND l.endDate >= :from')
               ->setParameter('from', $fromDt)
               ->setParameter('to', $toDt);
        }
        if ($status !== '') {
            $qb->andWhere('l.status = :st')->setParameter('st', $status);
        }
        if ($userId > 0) {
            $qb->andWhere('u.id = :uid')->setParameter('uid', $userId);
        }
        if ($search !== '') {
            $qb->andWhere('LOWER(u.fullName) LIKE :q OR LOWER(u.email) LIKE :q')
               ->setParameter('q', '%' . mb_strtolower($search) . '%');
        }

        if ($pg['enabled']) {
            $qb->setFirstResult($pg['offset'])->setMaxResults($pg['limit']);
        }
        $rows = $qb->getQuery()->getResult();

        $items = array_map(function (LeaveRequest $l) {
            $u = $l->getUser();
            return [
                'id' => $l->getId(),
                'status' => $l->getStatus(),
                'startDate' => $l->getStartDate()->format('Y-m-d'),
                'endDate' => $l->getEndDate()->format('Y-m-d'),
                'type' => $l->getType()?->getCode(),
                'typeLabel' => $l->getType()?->getLabel(),
                'user' => $this->userArr($u),
            ];
        }, $rows);

        if (!$pg['enabled']) {
            return $this->jsonOk(['items' => $items]);
        }

        // total count
        $countQb = $this->em->createQueryBuilder()
            ->select('COUNT(l2.id)')
            ->from(LeaveRequest::class, 'l2')
            ->join('l2.user', 'u2');
        if ($fromDt && $toDt) {
            $countQb->andWhere('l2.startDate <= :to AND l2.endDate >= :from')
                    ->setParameter('from', $fromDt)
                    ->setParameter('to', $toDt);
        }
        if ($status !== '') {
            $countQb->andWhere('l2.status = :st')->setParameter('st', $status);
        }
        if ($userId > 0) {
            $countQb->andWhere('u2.id = :uid')->setParameter('uid', $userId);
        }
        if ($search !== '') {
            $countQb->andWhere('LOWER(u2.fullName) LIKE :q OR LOWER(u2.email) LIKE :q')
                    ->setParameter('q', '%' . mb_strtolower($search) . '%');
        }
        $total = (int)$countQb->getQuery()->getSingleScalarResult();

        return $this->jsonOk([
            'items' => $items,
            'meta' => [
                'page' => $pg['page'],
                'limit' => $pg['limit'],
                'total' => $total,
                'pages' => (int)ceil($total / max(1, $pg['limit'])),
            ]
        ]);
    }

    #[Route('/api/hr/advances', methods: ['GET'])]
    public function advances(Request $request): JsonResponse
    {
        $this->requireHrOrAdmin($request);
        $pg = $this->parsePagination($request);
        $from = trim((string)$request->query->get('from', ''));
        $to = trim((string)$request->query->get('to', ''));
        $status = trim((string)$request->query->get('status', ''));
        $search = trim((string)$request->query->get('search', ''));
        $userId = (int)$request->query->get('userId', 0);

        $fromDt = $from ? new \DateTimeImmutable($from . ' 00:00:00') : null;
        $toDt = $to ? new \DateTimeImmutable($to . ' 23:59:59') : null;

        $qb = $this->em->createQueryBuilder()
            ->select('a', 'u', 'd')
            ->from(AdvanceRequest::class, 'a')
            ->join('a.user', 'u')
            ->leftJoin('u.department', 'd')
            ->orderBy('a.id', 'DESC');

        if ($fromDt && $toDt) {
            $qb->andWhere('a.createdAt BETWEEN :from AND :to')
               ->setParameter('from', $fromDt)
               ->setParameter('to', $toDt);
        }
        if ($status !== '') {
            $qb->andWhere('a.status = :st')->setParameter('st', $status);
        }
        if ($userId > 0) {
            $qb->andWhere('u.id = :uid')->setParameter('uid', $userId);
        }
        if ($search !== '') {
            $qb->andWhere('LOWER(u.fullName) LIKE :q OR LOWER(u.email) LIKE :q')
               ->setParameter('q', '%' . mb_strtolower($search) . '%');
        }
        if ($pg['enabled']) {
            $qb->setFirstResult($pg['offset'])->setMaxResults($pg['limit']);
        }
        $rows = $qb->getQuery()->getResult();

        $items = array_map(function (AdvanceRequest $a) {
            $u = $a->getUser();
            return [
                'id' => $a->getId(),
                'amount' => $a->getAmount(),
                'currency' => $a->getCurrency(),
                'reason' => $a->getReason(),
                'status' => $a->getStatus(),
                'periodYear' => $a->getPeriodYear(),
                'periodMonth' => $a->getPeriodMonth(),
                'createdAt' => $a->getCreatedAt()->format('Y-m-d H:i:s'),
                'user' => $this->userArr($u),
            ];
        }, $rows);

        if (!$pg['enabled']) {
            return $this->jsonOk(['items' => $items]);
        }

        $countQb = $this->em->createQueryBuilder()
            ->select('COUNT(a2.id)')
            ->from(AdvanceRequest::class, 'a2')
            ->join('a2.user', 'u2');
        if ($fromDt && $toDt) {
            $countQb->andWhere('a2.createdAt BETWEEN :from AND :to')
                    ->setParameter('from', $fromDt)
                    ->setParameter('to', $toDt);
        }
        if ($status !== '') {
            $countQb->andWhere('a2.status = :st')->setParameter('st', $status);
        }
        if ($userId > 0) {
            $countQb->andWhere('u2.id = :uid')->setParameter('uid', $userId);
        }
        if ($search !== '') {
            $countQb->andWhere('LOWER(u2.fullName) LIKE :q OR LOWER(u2.email) LIKE :q')
                    ->setParameter('q', '%' . mb_strtolower($search) . '%');
        }
        $total = (int)$countQb->getQuery()->getSingleScalarResult();

        return $this->jsonOk([
            'items' => $items,
            'meta' => [
                'page' => $pg['page'],
                'limit' => $pg['limit'],
                'total' => $total,
                'pages' => (int)ceil($total / max(1, $pg['limit'])),
            ]
        ]);
    }

    #[Route('/api/hr/exits', methods: ['GET'])]
    public function exits(Request $request): JsonResponse
    {
        $this->requireHrOrAdmin($request);
        $pg = $this->parsePagination($request);
        $from = trim((string)$request->query->get('from', ''));
        $to = trim((string)$request->query->get('to', ''));
        $status = trim((string)$request->query->get('status', ''));
        $search = trim((string)$request->query->get('search', ''));
        $userId = (int)$request->query->get('userId', 0);

        $fromDt = $from ? new \DateTimeImmutable($from . ' 00:00:00') : null;
        $toDt = $to ? new \DateTimeImmutable($to . ' 23:59:59') : null;

        $qb = $this->em->createQueryBuilder()
            ->select('x', 'u', 'd')
            ->from(ExitPermission::class, 'x')
            ->join('x.user', 'u')
            ->leftJoin('u.department', 'd')
            ->orderBy('x.id', 'DESC');

        if ($fromDt && $toDt) {
            $qb->andWhere('x.startAt <= :to AND x.endAt >= :from')
               ->setParameter('from', $fromDt)
               ->setParameter('to', $toDt);
        }
        if ($status !== '') {
            $qb->andWhere('x.status = :st')->setParameter('st', $status);
        }
        if ($userId > 0) {
            $qb->andWhere('u.id = :uid')->setParameter('uid', $userId);
        }
        if ($search !== '') {
            $qb->andWhere('LOWER(u.fullName) LIKE :q OR LOWER(u.email) LIKE :q')
               ->setParameter('q', '%' . mb_strtolower($search) . '%');
        }
        if ($pg['enabled']) {
            $qb->setFirstResult($pg['offset'])->setMaxResults($pg['limit']);
        }
        $rows = $qb->getQuery()->getResult();

        $items = array_map(function (ExitPermission $x) {
            $u = $x->getUser();
            return [
                'id' => $x->getId(),
                'startAt' => $x->getStartAt()->format('Y-m-d H:i:s'),
                'endAt' => $x->getEndAt()->format('Y-m-d H:i:s'),
                'reason' => $x->getReason(),
                'status' => $x->getStatus(),
                'createdAt' => $x->getCreatedAt()->format('Y-m-d H:i:s'),
                'user' => $this->userArr($u),
            ];
        }, $rows);

        if (!$pg['enabled']) {
            return $this->jsonOk(['items' => $items]);
        }

        $countQb = $this->em->createQueryBuilder()
            ->select('COUNT(x2.id)')
            ->from(ExitPermission::class, 'x2')
            ->join('x2.user', 'u2');
        if ($fromDt && $toDt) {
            $countQb->andWhere('x2.startAt <= :to AND x2.endAt >= :from')
                    ->setParameter('from', $fromDt)
                    ->setParameter('to', $toDt);
        }
        if ($status !== '') {
            $countQb->andWhere('x2.status = :st')->setParameter('st', $status);
        }
        if ($userId > 0) {
            $countQb->andWhere('u2.id = :uid')->setParameter('uid', $userId);
        }
        if ($search !== '') {
            $countQb->andWhere('LOWER(u2.fullName) LIKE :q OR LOWER(u2.email) LIKE :q')
                    ->setParameter('q', '%' . mb_strtolower($search) . '%');
        }
        $total = (int)$countQb->getQuery()->getSingleScalarResult();

        return $this->jsonOk([
            'items' => $items,
            'meta' => [
                'page' => $pg['page'],
                'limit' => $pg['limit'],
                'total' => $total,
                'pages' => (int)ceil($total / max(1, $pg['limit'])),
            ]
        ]);
    }

    #[Route('/api/hr/reports', methods: ['GET'])]
    public function reports(Request $request): JsonResponse
    {
        $this->requireHrOrAdmin($request);
        $pg = $this->parsePagination($request);
        $from = trim((string)$request->query->get('from', ''));
        $to = trim((string)$request->query->get('to', ''));
        $search = trim((string)$request->query->get('search', ''));
        $userId = (int)$request->query->get('userId', 0);

        $fromDt = $from ? new \DateTimeImmutable($from . ' 00:00:00') : null;
        $toDt = $to ? new \DateTimeImmutable($to . ' 23:59:59') : null;

        $qb = $this->em->createQueryBuilder()
            ->select('r', 'u', 'd')
            ->from(DailyReport::class, 'r')
            ->join('r.user', 'u')
            ->leftJoin('u.department', 'd')
            ->orderBy('r.id', 'DESC');

        if ($fromDt && $toDt) {
            $qb->andWhere('r.day BETWEEN :from AND :to')
               ->setParameter('from', $fromDt)
               ->setParameter('to', $toDt);
        }
        if ($userId > 0) {
            $qb->andWhere('u.id = :uid')->setParameter('uid', $userId);
        }
        if ($search !== '') {
            $qb->andWhere('LOWER(u.fullName) LIKE :q OR LOWER(u.email) LIKE :q')
               ->setParameter('q', '%' . mb_strtolower($search) . '%');
        }
        if ($pg['enabled']) {
            $qb->setFirstResult($pg['offset'])->setMaxResults($pg['limit']);
        }
        $rows = $qb->getQuery()->getResult();

        $items = array_map(function (DailyReport $r) {
            $u = $r->getUser();

            // Try to decode structured content (tasks/hours/blockers/nextDayPlan) as JSON.
            $raw = (string)($r->getContent() ?? '');
            $decoded = null;
            if ($raw !== '') {
                $tmp = json_decode($raw, true);
                if (is_array($tmp) && (isset($tmp['tasks']) || isset($tmp['hours']) || isset($tmp['blockers']) || isset($tmp['nextDayPlan']))) {
                    $decoded = $tmp;
                }
            }

            return [
                'id' => $r->getId(),
                'date' => $r->getDay()->format('Y-m-d'),
                'tasks' => $decoded['tasks'] ?? ($raw ?: ''),
                'hours' => $decoded['hours'] ?? null,
                'blockers' => $decoded['blockers'] ?? null,
                'nextDayPlan' => $decoded['nextDayPlan'] ?? null,
                'summary' => $decoded['tasks'] ?? null,
                'content' => $raw,
                'user' => $this->userArr($u),
            ];
        }, $rows);

        if (!$pg['enabled']) {
            return $this->jsonOk(['items' => $items]);
        }

        $countQb = $this->em->createQueryBuilder()
            ->select('COUNT(r2.id)')
            ->from(DailyReport::class, 'r2')
            ->join('r2.user', 'u2');
        if ($fromDt && $toDt) {
            $countQb->andWhere('r2.day BETWEEN :from AND :to')
                    ->setParameter('from', $fromDt)
                    ->setParameter('to', $toDt);
        }
        if ($userId > 0) {
            $countQb->andWhere('u2.id = :uid')->setParameter('uid', $userId);
        }
        if ($search !== '') {
            $countQb->andWhere('LOWER(u2.fullName) LIKE :q OR LOWER(u2.email) LIKE :q')
                    ->setParameter('q', '%' . mb_strtolower($search) . '%');
        }
        $total = (int)$countQb->getQuery()->getSingleScalarResult();

        return $this->jsonOk([
            'items' => $items,
            'meta' => [
                'page' => $pg['page'],
                'limit' => $pg['limit'],
                'total' => $total,
                'pages' => (int)ceil($total / max(1, $pg['limit'])),
            ]
        ]);
    }
}

<?php

namespace App\Controller;

use App\Entity\AdvanceRequest;
use App\Entity\DailyReport;
use App\Entity\Department;
use App\Entity\ExitPermission;
use App\Entity\LeaveRequest;
use App\Entity\User;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class DashboardStatsController extends ApiBase
{
    #[Route('/api/stats/dashboard', methods:['GET'])]
    public function stats(Request $r, EntityManagerInterface $em, Connection $db): JsonResponse
    {
        $token = $this->requireUser($r);
        $me = $this->requireDbUser($r, $em);

        $isAdmin = $this->hasRole($token, 'ROLE_ADMIN');
        $isHr = $isAdmin;
        // RH removed. Manager access is relationship-based.
        $isManager = $isAdmin || $this->hasRole($token, 'ROLE_SUPERIOR') || $this->isManagerByRelation($em, $me);

        $kpis = [
            'pendingLeavesManager' => 0,
            'pendingLeavesHr' => 0,
            'pendingExits' => 0,
            'pendingAdvances' => 0,
            'dailyReportsToday' => 0,
            'employeesTotal' => null,
            'departmentsTotal' => null,
        ];

        if ($isManager) {
            $countQb = $em->createQueryBuilder()
                ->select('COUNT(lr.id)')
                ->from(LeaveRequest::class, 'lr')
                ->where('lr.status = :st')
                ->andWhere('((lr.manager = :me AND lr.managerSignedAt IS NULL) OR (lr.manager2 = :me AND lr.manager2SignedAt IS NULL))')
                ->setParameter('st', LeaveRequest::STATUS_SUBMITTED)
                ->setParameter('me', $me);
            $kpis['pendingLeavesManager'] = (int)$countQb->getQuery()->getSingleScalarResult();
        }

        // RH removed: no HR pending queue.

        if ($isManager) {
            $st1 = ExitPermission::STATUS_SUBMITTED;
            $st2 = ExitPermission::STATUS_MANAGER_APPROVED;

            $countQb = $em->createQueryBuilder()
                ->select('COUNT(ep.id)')
                ->from(ExitPermission::class, 'ep')
                ->where('ep.status IN (:sts)')
                ->setParameter('sts', [$st1, $st2]);

            if (!$isAdmin) {
                $countQb->andWhere('((ep.manager = :me AND ep.managerSignedAt IS NULL) OR (ep.manager2 = :me AND ep.manager2SignedAt IS NULL))')
                    ->setParameter('me', $me);
            }

            $kpis['pendingExits'] = (int)$countQb->getQuery()->getSingleScalarResult();
        }

        if ($isManager) {
            $st1 = AdvanceRequest::STATUS_SUBMITTED;
            $st2 = AdvanceRequest::STATUS_MANAGER_APPROVED;

            $countQb = $em->createQueryBuilder()
                ->select('COUNT(ar.id)')
                ->from(AdvanceRequest::class, 'ar')
                ->where('ar.status IN (:sts)')
                ->setParameter('sts', [$st1, $st2]);

            if (!$isAdmin) {
                $countQb->andWhere('((ar.manager = :me AND ar.managerSignedAt IS NULL) OR (ar.manager2 = :me AND ar.manager2SignedAt IS NULL))')
                    ->setParameter('me', $me);
            }

            $kpis['pendingAdvances'] = (int)$countQb->getQuery()->getSingleScalarResult();
        }

        $today = (new \DateTimeImmutable('today'))->format('Y-m-d');
        if ($isHr) {
            $kpis['dailyReportsToday'] = (int)$em->createQueryBuilder()
                ->select('COUNT(dr.id)')
                ->from(DailyReport::class, 'dr')
                ->where('dr.day = :d')
                ->setParameter('d', new \DateTimeImmutable($today))
                ->getQuery()->getSingleScalarResult();
        } else {
            $kpis['dailyReportsToday'] = (int)$em->createQueryBuilder()
                ->select('COUNT(dr.id)')
                ->from(DailyReport::class, 'dr')
                ->where('dr.day = :d')
                ->andWhere('dr.user = :me')
                ->setParameter('d', new \DateTimeImmutable($today))
                ->setParameter('me', $me)
                ->getQuery()->getSingleScalarResult();
        }

        if ($isHr) {
            $kpis['employeesTotal'] = (int)$em->createQueryBuilder()
                ->select('COUNT(u.id)')
                ->from(User::class, 'u')
                ->getQuery()->getSingleScalarResult();

            $kpis['departmentsTotal'] = (int)$em->createQueryBuilder()
                ->select('COUNT(d.id)')
                ->from(Department::class, 'd')
                ->getQuery()->getSingleScalarResult();
        }

        $series = $this->last12MonthsSeries($db, $me->getId(), $isHr);

        $leaveTypes = null;
        if ($isHr) {
            $qb = $em->createQueryBuilder();
            $qb->select('t.label as type, COUNT(l.id) as total')
                ->from(LeaveRequest::class, 'l')
                ->leftJoin('l.type', 't')
                ->groupBy('t.label')
                ->orderBy('total', 'DESC');
            $leaveTypes = $qb->getQuery()->getResult();
        }

        return $this->jsonOk([
            'kpis' => $kpis,
            'series' => $series,
            'leaveTypes' => $leaveTypes,
        ]);
    }

    private function last12MonthsSeries(Connection $db, string $userId, bool $global): array
    {
        $months = [];
        $cursor = new \DateTimeImmutable('first day of this month');
        for ($i = 11; $i >= 0; $i--) {
            $m = $cursor->modify('-' . $i . ' months');
            $months[] = $m->format('Y-m');
        }

        $start = (new \DateTimeImmutable('first day of this month'))->modify('-11 months')->setTime(0, 0, 0);
        $startStr = $start->format('Y-m-d H:i:s');

        $leaveSql = "SELECT DATE_FORMAT(created_at, '%Y-%m') ym, COUNT(id) c FROM leave_requests WHERE created_at >= :start";
        $leaveParams = ['start' => $startStr];
        if (!$global) { $leaveSql .= " AND user_id = :uid"; $leaveParams['uid'] = $userId; }
        $leaveSql .= " GROUP BY ym";

        $exitSql = "SELECT DATE_FORMAT(created_at, '%Y-%m') ym, COUNT(id) c FROM exit_permissions WHERE created_at >= :start";
        $exitParams = ['start' => $startStr];
        if (!$global) { $exitSql .= " AND user_id = :uid"; $exitParams['uid'] = $userId; }
        $exitSql .= " GROUP BY ym";

        $advSql = "SELECT DATE_FORMAT(created_at, '%Y-%m') ym, COUNT(id) c FROM advance_requests WHERE created_at >= :start";
        $advParams = ['start' => $startStr];
        if (!$global) { $advSql .= " AND user_id = :uid"; $advParams['uid'] = $userId; }
        $advSql .= " GROUP BY ym";

        $leaveRows = $db->fetchAllAssociative($leaveSql, $leaveParams);
        $exitRows = $db->fetchAllAssociative($exitSql, $exitParams);
        $advRows = $db->fetchAllAssociative($advSql, $advParams);

        $mapLeaves = [];
        foreach ($leaveRows as $r) { $mapLeaves[$r['ym']] = (int)$r['c']; }
        $mapExits = [];
        foreach ($exitRows as $r) { $mapExits[$r['ym']] = (int)$r['c']; }
        $mapAdv = [];
        foreach ($advRows as $r) { $mapAdv[$r['ym']] = (int)$r['c']; }

        $out = [];
        foreach ($months as $ym) {
            $out[] = [
                'month' => $ym,
                'leaves' => $mapLeaves[$ym] ?? 0,
                'exits' => $mapExits[$ym] ?? 0,
                'advances' => $mapAdv[$ym] ?? 0,
            ];
        }
        return $out;
    }
}

<?php
namespace App\Controller;

use App\Entity\LeaveRequest;
use App\Entity\LeaveType;
use App\Service\SettingsService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class LeaveBalanceController extends ApiBase
{
    #[Route('/api/leaves/balance', methods: ['GET'])]
    public function balance(Request $request, EntityManagerInterface $em, SettingsService $settings): JsonResponse
    {
        $u = $this->requireDbUser($request, $em);
        $year = (int)($request->query->get('year') ?? (new \DateTimeImmutable())->format('Y'));
        $from = new \DateTimeImmutable($year . '-01-01');
        $to = new \DateTimeImmutable($year . '-12-31');

        $types = $em->getRepository(LeaveType::class)->findAll();
        $items = [];
        $accrual = $settings->leaveAccrualPerMonth();
        $today = new \DateTimeImmutable('today');

        foreach ($types as $t) {
            $qb = $em->createQueryBuilder();
            $qb->select('COALESCE(SUM(l.daysCount),0)')
                ->from(LeaveRequest::class, 'l')
                ->where('l.user = :u')
                ->andWhere('l.type = :t')
                ->andWhere('l.status = :s')
                ->andWhere('l.startDate >= :from AND l.endDate <= :to')
                ->setParameters([
                    'u' => $u,
                    't' => $t,
                    's' => LeaveRequest::STATUS_HR_APPROVED,
                    'from' => $from,
                    'to' => $to,
                ]);
            $used = (float)$qb->getQuery()->getSingleScalarResult();
            $allow = (float)$t->getAnnualAllowance();

            // If monthly accrual is enabled, compute allowance for ANNUAL leave dynamically
            // based on hire date and initial leave balance.
            if ($accrual > 0 && $t->getCode() === 'ANNUAL') {
                $hire = $u->getHireDate() ?: $u->getCreatedAt();
                $periodStart = $from;
                if ($hire > $periodStart) $periodStart = new \DateTimeImmutable($hire->format('Y-m-01'));
                // Accrue only up to "today" for current year (no future accrual)
                $periodEnd = $to;
                if ((int)$today->format('Y') === $year && $today < $periodEnd) {
                    $periodEnd = $today;
                }

                // months count inclusive by calendar month
                $months = 0;
                if ($periodEnd >= $periodStart) {
                    $y1 = (int)$periodStart->format('Y');
                    $m1 = (int)$periodStart->format('m');
                    $y2 = (int)$periodEnd->format('Y');
                    $m2 = (int)$periodEnd->format('m');
                    $months = ($y2 - $y1) * 12 + ($m2 - $m1) + 1;
                    if ($months < 0) $months = 0;
                }

                $allow = (float)$u->getLeaveInitialBalance() + ($months * $accrual);
            }
            $remaining = ($allow > 0) ? max(0.0, $allow - $used) : null;

            $items[] = [
                'type' => [
                    'id' => (string)$t->getId(),
                    'code' => $t->getCode(),
                    'label' => $t->getLabel(),
                    'annualAllowance' => $allow,
                    'requiresCertificate' => $t->getRequiresCertificate(),
                ],
                'year' => $year,
                'usedDays' => $used,
                'remainingDays' => $remaining,
            ];
        }

        return $this->jsonOk(['items' => $items]);
    }
}

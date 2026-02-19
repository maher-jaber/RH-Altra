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
        $today = new \DateTimeImmutable('today');

        $countsSickAsAnnual = $settings->sickLeaveCountsAsAnnual($u);

        // Preload Annual/Sick type entities (if present) for cross-type calculations.
        $annualType = null;
        $sickType = null;
        foreach ($types as $t0) {
            if ($t0->getCode() === 'ANNUAL') $annualType = $t0;
            if ($t0->getCode() === 'SICK') $sickType = $t0;
        }

        // Helper to sum used days for a given type (and year window).
        $sumUsed = function(LeaveType $t) use ($em, $u, $from, $to): float {
            $qb = $em->createQueryBuilder();
            $qb->select('COALESCE(SUM(l.daysCount),0)')
                ->from(LeaveRequest::class, 'l')
                ->where('l.user = :u')
                ->andWhere('l.type = :t')
                ->andWhere('l.status IN (:sts)')
                ->andWhere('l.startDate >= :from AND l.endDate <= :to')
                ->setParameters([
                    'u' => $u,
                    't' => $t,
                    'sts' => [LeaveRequest::STATUS_SUBMITTED, LeaveRequest::STATUS_MANAGER_APPROVED, LeaveRequest::STATUS_HR_APPROVED],
                    'from' => $from,
                    'to' => $to,
                ]);
            return (float)$qb->getQuery()->getSingleScalarResult();
        };

        // Compute annual allowance and "annual used" possibly including sick.
        $annualAllowance = null;
        $annualUsed = null;
        $annualRemaining = null;

        if ($annualType) {
            $annualAllowance = $settings->accruedAnnualAllowanceForUser($u, $year, $today);
            $annualUsed = $sumUsed($annualType);
            if ($countsSickAsAnnual && $sickType) {
                $annualUsed += $sumUsed($sickType);
            }
            $annualRemaining = max(0.0, (float)$annualAllowance - (float)$annualUsed);
        }

        foreach ($types as $t) {
            $allow = (float)$t->getAnnualAllowance();
            $used = $sumUsed($t);

            if ($t->getCode() === 'ANNUAL' && $annualType) {
                $allow = (float)$annualAllowance;
                $used = (float)$annualUsed;
            }

            if ($t->getCode() === 'SICK' && $countsSickAsAnnual && $annualType) {
                // In this mode, sick leave consumes the annual balance (no separate allowance).
                $allow = (float)$annualAllowance;
                // Show the same remaining balance as annual, but keep used as "annual used" for clarity.
                $used = (float)$annualUsed;
            }

            if ($t->getCode() === 'SICK' && !$countsSickAsAnnual) {
                // Separate sick balance: allowance is configured by contract type (settings).
                $ct = method_exists($u, 'getContractType') ? $u->getContractType() : null;
                $allow = (float)$settings->sickLeaveAnnualQuotaForContract($ct);
                $used = (float)$sumUsed($t);
            }

            $remaining = ($allow > 0) ? max(0.0, $allow - $used) : null;

            // If sick counts as annual, keep remaining aligned with annual computed remaining.
            if ($t->getCode() === 'SICK' && $countsSickAsAnnual && $annualType) {
                $remaining = $annualRemaining;
            }
            if ($t->getCode() === 'ANNUAL' && $annualType) {
                $remaining = $annualRemaining;
            }

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

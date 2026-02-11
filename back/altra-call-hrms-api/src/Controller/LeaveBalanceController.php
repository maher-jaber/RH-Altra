<?php
namespace App\Controller;

use App\Entity\LeaveRequest;
use App\Entity\LeaveType;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class LeaveBalanceController extends ApiBase
{
    #[Route('/api/leaves/balance', methods: ['GET'])]
    public function balance(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $u = $this->requireDbUser($request, $em);
        $year = (int)($request->query->get('year') ?? (new \DateTimeImmutable())->format('Y'));
        $from = new \DateTimeImmutable($year . '-01-01');
        $to = new \DateTimeImmutable($year . '-12-31');

        $types = $em->getRepository(LeaveType::class)->findAll();
        $items = [];
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

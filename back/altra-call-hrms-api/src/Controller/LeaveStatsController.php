<?php
namespace App\Controller;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\HttpFoundation\JsonResponse;

class LeaveStatsController extends ApiBase
{
    #[Route('/api/stats/leaves', methods:['GET'])]
    public function stats(Request $r, EntityManagerInterface $em): JsonResponse
    {
        // RH removed: stats are admin-only.
        $this->requireRole($r,'ROLE_ADMIN');

        $qb = $em->createQueryBuilder();
        $qb->select('t.label as type, COUNT(l.id) as total')
            ->from('App\Entity\LeaveRequest','l')
            ->join('l.type','t')
            ->groupBy('t.label');

        return $this->jsonOk(['items'=>$qb->getQuery()->getResult()]);
    }
}

<?php
namespace App\Controller;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

class LeaveTeamCalendarController extends ApiBase
{
    #[Route('/api/leaves/team-calendar', methods:['GET'])]
    public function team(Request $r, EntityManagerInterface $em): JsonResponse
    {
        $u = $this->requireUser($r);

        // manager/hr/admin can view department calendar; employee only own calendar
        $isPriv = in_array('ROLE_MANAGER',$u->roles,true) || in_array('ROLE_HR',$u->roles,true) || in_array('ROLE_ADMIN',$u->roles,true);

        if (!$isPriv) {
            $items = $em->getConnection()->fetchAllAssociative("SELECT lr.id, lr.start_date as startDate, lr.end_date as endDate, lr.days_count as daysCount, lr.status, lt.label as typeLabel, u.full_name as fullName FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.type_id JOIN users u ON u.id = lr.user_id WHERE lr.status='HR_APPROVED' AND lr.user_id = ?", [$u->id]);
            return $this->jsonOk(['items'=>array_map(fn($x)=>[
                'id'=>(string)$x['id'],
                'startDate'=>$x['startDate'],
                'endDate'=>$x['endDate'],
                'daysCount'=>(float)$x['daysCount'],
                'status'=>$x['status'],
                'type'=>['label'=>$x['typeLabel']],
                'user'=>['fullName'=>$x['fullName']],
            ],$items)]);
        }

        $items = $em->getConnection()->fetchAllAssociative("
            SELECT lr.id, lr.start_date as startDate, lr.end_date as endDate, lr.days_count as daysCount, lr.status,
                   lt.label as typeLabel, u.full_name as fullName
            FROM leave_requests lr
            JOIN leave_types lt ON lt.id = lr.type_id
            JOIN users u ON u.id = lr.user_id
            WHERE lr.status='HR_APPROVED' AND u.department_id = (SELECT department_id FROM users WHERE id = ?)
        ", [$u->id]);

        return $this->jsonOk(['items'=>array_map(fn($x)=>[
            'id'=>(string)$x['id'],
            'startDate'=>$x['startDate'],
            'endDate'=>$x['endDate'],
            'daysCount'=>(float)$x['daysCount'],
            'status'=>$x['status'],
            'type'=>['label'=>$x['typeLabel']],
            'user'=>['fullName'=>$x['fullName']],
        ],$items)]);
    }
}

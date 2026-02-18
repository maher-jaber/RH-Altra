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
        $isPriv = in_array('ROLE_MANAGER',$u->roles,true) || in_array('ROLE_SUPERIOR',$u->roles,true) || in_array('ROLE_ADMIN',$u->roles,true);

        if (!$isPriv) {
            // Schema note:
            // leave_requests stores the requester by api_key and the type by its string code.
            $items = $em->getConnection()->fetchAllAssociative(
                "SELECT lr.id,
                        lr.start_date as startDate,
                        lr.end_date as endDate,
                        lr.days_count as daysCount,
                        lr.status,
                        COALESCE(lt.label, lr.type) as typeLabel,
                        u.full_name as fullName
                 FROM leave_requests lr
                 JOIN users u ON u.api_key = lr.created_by_api_key
                 LEFT JOIN leave_types lt ON lt.code = lr.type
                 WHERE lr.status='HR_APPROVED' AND lr.created_by_api_key = ?",
                [$u->apiKey]
            );
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

        $items = $em->getConnection()->fetchAllAssociative(
            "SELECT lr.id,
                    lr.start_date as startDate,
                    lr.end_date as endDate,
                    lr.days_count as daysCount,
                    lr.status,
                    COALESCE(lt.label, lr.type) as typeLabel,
                    u.full_name as fullName
             FROM leave_requests lr
             JOIN users u ON u.api_key = lr.created_by_api_key
             LEFT JOIN leave_types lt ON lt.code = lr.type
             WHERE lr.status='HR_APPROVED'
               AND u.department_id = (SELECT department_id FROM users WHERE api_key = ?)
            ",
            [$u->apiKey]
        );

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

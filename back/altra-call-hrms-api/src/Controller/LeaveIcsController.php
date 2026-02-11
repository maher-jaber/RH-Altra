<?php
namespace App\Controller;

use App\Entity\LeaveRequest;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class LeaveIcsController extends ApiBase
{
    private function icsHeader(): string
    {
        return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ALTRACALL HRMS//LEAVES//FR\r\nCALSCALE:GREGORIAN\r\n";
    }

    private function icsFooter(): string { return "END:VCALENDAR\r\n"; }

    private function vevent(string $uid, string $summary, string $start, string $end): string
    {
        return "BEGIN:VEVENT\r\nUID:{$uid}\r\nDTSTAMP:".gmdate('Ymd\THis\Z')."\r\nDTSTART;VALUE=DATE:{$start}\r\nDTEND;VALUE=DATE:{$end}\r\nSUMMARY:{$summary}\r\nEND:VEVENT\r\n";
    }

    #[Route('/api/leaves/ics/my', methods:['GET'])]
    public function my(Request $r, EntityManagerInterface $em): Response
    {
        $u = $this->requireUser($r);
        // Use SQL to stay consistent with our leave_requests schema (api_key + type code).
        $conn = $em->getConnection();
        $rows = $conn->fetchAllAssociative(
            "SELECT lr.id, lr.start_date, lr.end_date, COALESCE(lt.label, lr.type) as type_label
             FROM leave_requests lr
             LEFT JOIN leave_types lt ON lt.code = lr.type
             WHERE lr.status='HR_APPROVED' AND lr.created_by_api_key = ?
             ORDER BY lr.created_at DESC",
            [$u->apiKey]
        );

        $ics = $this->icsHeader();
        foreach($rows as $row){
            $start = (new \DateTimeImmutable($row['start_date']))->format('Ymd');
            // DTEND is exclusive -> +1 day
            $end = (new \DateTimeImmutable($row['end_date']))->modify('+1 day')->format('Ymd');
            $ics .= $this->vevent('leave-'.$row['id'], 'Congé - '.$row['type_label'], $start, $end);
        }
        $ics .= $this->icsFooter();

        return new Response($ics,200,['Content-Type'=>'text/calendar; charset=utf-8']);
    }

    #[Route('/api/leaves/ics/department', methods:['GET'])]
    public function department(Request $r, EntityManagerInterface $em): Response
    {
        $u = $this->requireUser($r);
        // only manager/hr/admin
        if(!in_array('ROLE_HR',$u->roles,true) && !in_array('ROLE_ADMIN',$u->roles,true) && !in_array('ROLE_MANAGER',$u->roles,true)) {
            return new Response('forbidden',403);
        }

        // fetch users in same department (join by api_key)
        $conn = $em->getConnection();
        $rows = $conn->fetchAllAssociative(
            "SELECT lr.id, lr.start_date, lr.end_date, u2.full_name
             FROM leave_requests lr
             JOIN users u2 ON u2.api_key = lr.created_by_api_key
             WHERE u2.department_id = (SELECT department_id FROM users WHERE api_key = ?)
               AND lr.status = 'HR_APPROVED'",
            [$u->apiKey]
        );

        $ics = $this->icsHeader();
        foreach($rows as $row){
            $start = (new \DateTimeImmutable($row['start_date']))->format('Ymd');
            $end = (new \DateTimeImmutable($row['end_date']))->modify('+1 day')->format('Ymd');
            $ics .= $this->vevent('leave-'.$row['id'], 'Congé - '.$row['full_name'], $start, $end);
        }
        $ics .= $this->icsFooter();

        return new Response($ics,200,['Content-Type'=>'text/calendar; charset=utf-8']);
    }
}

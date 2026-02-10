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
        $rows = $em->getRepository(LeaveRequest::class)->findBy(['user'=>$u->id, 'status'=>'HR_APPROVED'], ['id'=>'DESC']);

        $ics = $this->icsHeader();
        foreach($rows as $lr){
            $start = $lr->getStartDate()->format('Ymd');
            // DTEND is exclusive -> +1 day
            $end = (new \DateTimeImmutable($lr->getEndDate()->format('Y-m-d')))->modify('+1 day')->format('Ymd');
            $ics .= $this->vevent('leave-'.$lr->getId(), 'Congé - '.$lr->getType()->getLabel(), $start, $end);
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

        // fetch users in same department
        $sql = "SELECT l.* FROM leave_requests l JOIN users u2 ON u2.id = l.user_id WHERE u2.department_id = (SELECT department_id FROM users WHERE id = ?) AND l.status = 'HR_APPROVED'";
        $conn = $em->getConnection();
        $rows = $conn->fetchAllAssociative($sql, [$u->id]);

        $ics = $this->icsHeader();
        foreach($rows as $row){
            $start = (new \DateTimeImmutable($row['start_date']))->format('Ymd');
            $end = (new \DateTimeImmutable($row['end_date']))->modify('+1 day')->format('Ymd');
            $ics .= $this->vevent('leave-'.$row['id'], 'Congé (Département)', $start, $end);
        }
        $ics .= $this->icsFooter();

        return new Response($ics,200,['Content-Type'=>'text/calendar; charset=utf-8']);
    }
}

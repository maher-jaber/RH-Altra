<?php
namespace App\Controller;

use App\Entity\LeaveRequest;
use App\Service\LeavePdfService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class LeavePdfController extends ApiBase
{
    #[Route('/api/leaves/{id}/pdf', methods:['GET'])]
    public function pdf(string $id, \Symfony\Component\HttpFoundation\Request $r, EntityManagerInterface $em, LeavePdfService $svc): Response
    {
        $this->requireUser($r);
        $lr = $em->getRepository(LeaveRequest::class)->find($id);
if (!$lr) {
    return new Response('Not found', 404);
}
$u = $this->requireUser($r);
$isOwner = $lr->getUser()?->getId() === $u->getId();
$isHr = in_array('ROLE_HR', $u->roles, true) || in_array('ROLE_ADMIN', $u->roles, true);
$isMgr = $lr->getManager()?->getId() === $u->getId();
if (!$isOwner && !$isHr && !$isMgr) {
    return new Response('Forbidden', 403);
}

        $file = $svc->generate($lr);

        return new Response(file_get_contents($file),200,[
            'Content-Type'=>'application/pdf',
            'Content-Disposition'=>'attachment; filename="leave.pdf"'
        ]);
    }
}

<?php
namespace App\Controller;

use App\Entity\LeaveRequest;
use App\Entity\LeaveAudit;
use App\Entity\LeaveArchive;
use App\Service\LeavePdfService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class LeaveSignatureController extends ApiBase
{
    #[Route('/api/leaves/{id}/sign/manager', methods:['POST'])]
    public function signManager(string $id, Request $r, EntityManagerInterface $em): JsonResponse
    {
        $u = $this->requireUser($r);
        $lr = $em->getRepository(LeaveRequest::class)->find($id);
        if(!$lr) return $this->json(['error'=>'not_found'],404);

        // only request manager or admin
        $isManager = $lr->getManager() && ((string)$lr->getManager()->getId() === (string)$u->id);
        if(!$isManager && !in_array('ROLE_ADMIN',$u->roles,true) && !in_array('ROLE_HR',$u->roles,true)) {
            return $this->json(['error'=>'forbidden'],403);
        }

        $data = json_decode((string)$r->getContent(), true) ?: [];
        $lr->setManagerSignedAt(new \DateTimeImmutable());
        $lr->setManagerSignerName((string)($data['name'] ?? $u->fullName));
        $lr->setManagerSignature($data['signature'] ?? null);

        $audit = (new LeaveAudit())
            ->setLeaveRequest($lr)
            ->setAction('SIGN_MANAGER')
            ->setActor($u->id)
            ->setComment($data['comment'] ?? null);
        $em->persist($audit);
        $em->flush();

        return $this->jsonOk(['ok'=>true]);
    }

    #[Route('/api/leaves/{id}/sign/hr', methods:['POST'])]
    public function signHr(string $id, Request $r, EntityManagerInterface $em, LeavePdfService $pdf): JsonResponse
    {
        $u = $this->requireRole($r, 'ROLE_HR');
        $lr = $em->getRepository(LeaveRequest::class)->find($id);
        if(!$lr) return $this->json(['error'=>'not_found'],404);

        $data = json_decode((string)$r->getContent(), true) ?: [];
        $lr->setHrSignedAt(new \DateTimeImmutable());
        $lr->setHrSignerName((string)($data['name'] ?? $u->fullName));
        $lr->setHrSignature($data['signature'] ?? null);

        $audit = (new LeaveAudit())
            ->setLeaveRequest($lr)
            ->setAction('SIGN_HR')
            ->setActor($u->id)
            ->setComment($data['comment'] ?? null);
        $em->persist($audit);

        // archive PDF (legal)
        $pdfFile = $pdf->generate($lr);
        $archiveDir = $this->getParameter('kernel.project_dir').'/var/archives';
        if(!is_dir($archiveDir)) @mkdir($archiveDir,0775,true);
        $dest = $archiveDir.'/leave_'.$lr->getId().'_'.date('Ymd_His').'.pdf';
        copy($pdfFile, $dest);
        $sha = hash_file('sha256',$dest);

        $arch = new LeaveArchive();
        $arch->setLeaveRequest($lr)->setPath(str_replace($this->getParameter('kernel.project_dir').'/', '', $dest))->setSha256($sha);
        $em->persist($arch);

        $em->flush();
        return $this->jsonOk(['ok'=>true,'sha256'=>$sha]);
    }

    #[Route('/api/leaves/{id}/archive', methods:['GET'])]
    public function downloadArchive(string $id, Request $r, EntityManagerInterface $em): Response
    {
        $this->requireUser($r);
        $lr = $em->getRepository(LeaveRequest::class)->find($id);
        if(!$lr) return new Response('not_found',404);

        $arch = $em->getRepository(LeaveArchive::class)->findOneBy(['leaveRequest'=>$lr], ['id'=>'DESC']);
        if(!$arch) return new Response('no_archive',404);

        $path = $this->getParameter('kernel.project_dir').'/'.$arch->getPath();
        if(!file_exists($path)) return new Response('missing_file',404);

        return new Response(file_get_contents($path),200,[
            'Content-Type'=>'application/pdf',
            'Content-Disposition'=>'attachment; filename="leave_archive.pdf"',
            'X-Archive-SHA256'=>$arch->getSha256()
        ]);
    }
}

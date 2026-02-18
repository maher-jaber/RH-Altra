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

        // only request manager (manager or manager2) or admin
        $isM1 = $lr->getManager() && ((string)$lr->getManager()->getId() === (string)$u->id);
        $isM2 = $lr->getManager2() && ((string)$lr->getManager2()->getId() === (string)$u->id);
        $isAdmin = in_array('ROLE_ADMIN',$u->roles,true);

        if(!$isM1 && !$isM2 && !$isAdmin) {
            return $this->json(['error'=>'forbidden'],403);
        }

        $data = json_decode((string)$r->getContent(), true) ?: [];
        $now = new \DateTimeImmutable();

        if($isM2 && !$isAdmin){
            // Manager 2: sign without overwriting legacy manager signature fields
            if($lr->getManager2SignedAt()) return $this->json(['error'=>'already_signed'],409);
            $lr->setManager2SignedAt($now);
            if(isset($data['comment'])) { $lr->setManager2Comment((string)$data['comment']); }
        } else {
            // Manager 1 (or admin acting as manager)
            if($lr->getManagerSignedAt()) return $this->json(['error'=>'already_signed'],409);
            $lr->setManagerSignedAt($now);
            $lr->setManagerSignerName((string)($data['name'] ?? $u->fullName));
            $lr->setManagerSignature($data['signature'] ?? null);
            if(isset($data['comment'])) { $lr->setManagerComment((string)$data['comment']); }
        }

        $audit = (new LeaveAudit())
            ->setLeaveRequest($lr)
            ->setAction('SIGN_MANAGER')
            ->setActor($u->id)
            ->setComment($data['comment'] ?? null);
        $em->persist($audit);
        $em->flush();

        return $this->jsonOk(['ok'=>true]);
    }


    // RH removed: no HR signature endpoint.

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

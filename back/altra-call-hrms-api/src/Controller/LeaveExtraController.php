<?php
namespace App\Controller;

use App\Entity\LeaveRequest;
use App\Entity\LeaveAttachment;
use App\Entity\LeaveAudit;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

class LeaveExtraController extends ApiBase
{
    #[Route('/api/leaves/{id}/attachments', methods:['POST'])]
    public function upload(string $id, Request $r, EntityManagerInterface $em): JsonResponse
    {
        $u = $this->requireUser($r);
        $lr = $em->getRepository(LeaveRequest::class)->find($id);
        if(!$lr || $lr->getUser()?->getId()!==$u->getId()) return $this->json(['error'=>'forbidden'],403);

        $files = $r->files->all('files');
        $dir = $this->getParameter('kernel.project_dir').'/var/uploads/attachments';
        if(!is_dir($dir)) @mkdir($dir,0775,true);

        foreach($files as $file){
            $name = bin2hex(random_bytes(8)).'_'.preg_replace('/[^a-zA-Z0-9._-]/','_',$file->getClientOriginalName());
            $file->move($dir,$name);

            $att = new LeaveAttachment();
            $att->setLeaveRequest($lr)
                ->setOriginalName($file->getClientOriginalName())
                ->setPath('var/uploads/attachments/'.$name);
            $em->persist($att);
        }

        $audit = (new LeaveAudit())
            ->setLeaveRequest($lr)
            ->setAction('UPLOAD_ATTACHMENT')
            ->setActor($u->getEmail());
        $em->persist($audit);

        $em->flush();
        return $this->jsonOk(['status'=>'ok']);
    }

    #[Route('/api/leaves/{id}/audit', methods:['GET'])]
    public function audit(string $id, Request $r, EntityManagerInterface $em): JsonResponse
    {
        $this->requireUser($r);
        $items = $em->getRepository(LeaveAudit::class)->findBy(['leaveRequest'=>$id],['id'=>'DESC']);
        return $this->jsonOk(['items'=>array_map(fn($a)=>[
            'action'=>$a->action,
            'actor'=>$a->actor,
            'comment'=>$a->comment,
            'date'=>$a->getCreatedAt()->format('Y-m-d H:i')
        ],$items)]);
    }
}

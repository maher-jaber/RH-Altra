<?php
namespace App\Controller;

use App\Entity\Notification;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class NotificationController extends ApiBase
{
    #[Route('/api/notifications', methods:['GET'])]
    public function list(Request $r, EntityManagerInterface $em): JsonResponse {
        $u=$this->requireUser($r);
        $items=$em->getRepository(Notification::class)->findBy(['user'=>$u],['id'=>'DESC']);
        $out=array_map(fn(Notification $n)=>[
            'id'=>(string)$n->getId(),
            'title'=>$n->getTitle(),
            'body'=>$n->getBody(),
            'type'=>$n->getType(),
            'isRead'=>$n->isRead(),
        ], $items);
        return $this->jsonOk(['items'=>$out]);
    }

    #[Route('/api/notifications/{id}/read', methods:['POST'])]
    public function readOne(string $id, Request $r, EntityManagerInterface $em): JsonResponse {
        $u=$this->requireUser($r);
        $n=$em->getRepository(Notification::class)->find($id);
        if(!$n) return $this->json(['error'=>'not_found'],404);
        if($n->getUser()->getId()!==$u->getId()) return $this->json(['error'=>'forbidden'],403);
        $n->markRead();
        $em->flush();
        return $this->jsonOk(['ok'=>true]);
    }
}

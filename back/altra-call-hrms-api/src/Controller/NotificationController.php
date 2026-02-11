<?php
namespace App\Controller;

use App\Entity\Notification;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class NotificationController extends ApiBase
{
    private function getCurrentUser(Request $request, EntityManagerInterface $em): User
    {
        $u = $this->requireUser($request);
        /** @var User|null $user */
        $user = $em->getRepository(User::class)->findOneBy(['apiKey' => $u->apiKey]);
        if (!$user) {
            throw $this->createNotFoundException('User not found for this API key. Create the user via Admin first.');
        }
        return $user;
    }

    #[Route('/api/notifications', methods:['GET'])]
    public function list(Request $r, EntityManagerInterface $em): JsonResponse {
        $user = $this->getCurrentUser($r, $em);
        $items = $em->getRepository(Notification::class)->findBy(['user' => $user], ['id' => 'DESC']);
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
        $user = $this->getCurrentUser($r, $em);
        $n=$em->getRepository(Notification::class)->find($id);
        if(!$n) return $this->json(['error'=>'not_found'],404);
        if($n->getUser()->getId()!==$user->getId()) return $this->json(['error'=>'forbidden'],403);
        $n->markRead();
        $em->flush();
        return $this->jsonOk(['ok'=>true]);
    }
}

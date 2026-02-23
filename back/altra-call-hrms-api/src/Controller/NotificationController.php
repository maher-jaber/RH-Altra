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
        $pg = $this->parsePagination($r);

        if (!$pg['enabled']) {
            $items = $em->getRepository(Notification::class)->findBy(['user' => $user], ['id' => 'DESC']);
            $out=array_map(fn(Notification $n)=>[
                'id'=>(string)$n->getId(),
                'title'=>$n->getTitle(),
                'body'=>$n->getBody(),
                'type'=>$n->getType(),
                'isRead'=>$n->isRead(),
                'createdAt'=>$n->getCreatedAt()->format(DATE_ATOM),
                'actionUrl'=>$n->getActionUrl(),
                'payload'=>$n->getPayload(),
            ], $items);
            return $this->jsonOk(['items'=>$out]);
        }

        $qb = $em->createQueryBuilder()
            ->select('n')
            ->from(Notification::class, 'n')
            ->where('n.user = :u')
            ->setParameter('u', $user)
            ->orderBy('n.id', 'DESC')
            ->setFirstResult($pg['offset'])
            ->setMaxResults($pg['limit']);

        $items = $qb->getQuery()->getResult();

        $countQb = $em->createQueryBuilder()
            ->select('COUNT(n2.id)')
            ->from(Notification::class, 'n2')
            ->where('n2.user = :u')
            ->setParameter('u', $user);
        $total = (int)$countQb->getQuery()->getSingleScalarResult();

        $out=array_map(fn(Notification $n)=>[
            'id'=>(string)$n->getId(),
            'title'=>$n->getTitle(),
            'body'=>$n->getBody(),
            'type'=>$n->getType(),
            'isRead'=>$n->isRead(),
            'createdAt'=>$n->getCreatedAt()->format(DATE_ATOM),
            'actionUrl'=>$n->getActionUrl(),
            'payload'=>$n->getPayload(),
        ], $items);

        return $this->jsonOk([
            'items'=>$out,
            'meta'=>[
                'page'=>$pg['page'],
                'limit'=>$pg['limit'],
                'total'=>$total,
                'pages'=>(int)ceil($total / max(1,$pg['limit'])),
            ]
        ]);
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

        #[Route('/api/notifications/read-all', methods:['POST'])]
    public function readAll(Request $r, EntityManagerInterface $em): JsonResponse {
        $user = $this->getCurrentUser($r, $em);

        $qb = $em->createQueryBuilder()
            ->update(Notification::class, 'n')
            ->set('n.isRead', ':t')
            ->where('n.user = :u')
            ->andWhere('n.isRead = :f')
            ->setParameter('t', true)
            ->setParameter('f', false)
            ->setParameter('u', $user);

        $affected = (int)$qb->getQuery()->execute();
        return $this->jsonOk(['ok'=>true, 'updated'=>$affected]);
    }
}

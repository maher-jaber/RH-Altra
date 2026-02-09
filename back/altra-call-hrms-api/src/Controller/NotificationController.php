<?php

namespace App\Controller;

use App\Repository\NotificationRepository;
use App\Service\ApiResponse;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

class NotificationController extends ApiBase
{
    public function __construct(
        private NotificationRepository $repo,
        private EntityManagerInterface $em
    ) {}

    #[Route('/api/notifications', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $u = $this->requireUser($request);
        $list = $this->repo->findForRecipient($u->apiKey);
        return $this->jsonOk(array_map([ApiResponse::class, 'notif'], $list));
    }

    #[Route('/api/notifications/{id}/read', methods: ['POST'])]
    public function read(string $id, Request $request): JsonResponse
    {
        $u = $this->requireUser($request);
        $n = $this->repo->find($id);
        if (!$n || $n->getRecipientApiKey() !== $u->apiKey) {
            return $this->jsonOk(['error' => 'Not found'], 404);
        }
        $n->markRead();
        $this->em->flush();
        return $this->jsonOk(['ok' => true]);
    }
}

<?php

namespace App\Controller;

use App\Entity\LeaveRequest;
use App\Entity\Notification;
use App\Message\PublishNotificationMessage;
use App\Repository\LeaveRequestRepository;
use App\Repository\NotificationRepository;
use App\Service\ApiResponse;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Workflow\WorkflowInterface;

class LeaveController extends ApiBase
{
    public function __construct(
        private EntityManagerInterface $em,
        private LeaveRequestRepository $leaves,
        private NotificationRepository $notifs,
        private WorkflowInterface $leave_request,
        private MessageBusInterface $bus
    ) {}

    #[Route('/api/leave-requests', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $u = $this->requireUser($request);
        $payload = json_decode((string) $request->getContent(), true) ?: [];

        $l = new LeaveRequest();
        $l->setCreatedByApiKey($u->apiKey);
        $l->setType((string) ($payload['type'] ?? 'ANNUAL'));
        $l->setStartDate(new \DateTimeImmutable((string) ($payload['startDate'] ?? 'now')));
        $l->setEndDate(new \DateTimeImmutable((string) ($payload['endDate'] ?? 'now')));
        $l->setHalfDay(($payload['halfDay'] ?? null) ?: null);
        $l->setReason(($payload['reason'] ?? null) ?: null);

        $this->em->persist($l);
        $this->em->flush();

        return $this->jsonOk(ApiResponse::leave($l), 201);
    }

    #[Route('/api/leave-requests/my', methods: ['GET'])]
    public function my(Request $request): JsonResponse
    {
        $u = $this->requireUser($request);
        $list = $this->leaves->findByCreator($u->apiKey);
        return $this->jsonOk(array_map([ApiResponse::class, 'leave'], $list));
    }

    #[Route('/api/leave-requests/{id}/submit', methods: ['POST'])]
    public function submit(string $id, Request $request): JsonResponse
    {
        $u = $this->requireUser($request);
        $payload = json_decode((string) $request->getContent(), true) ?: [];
        $managerKey = trim((string)($payload['managerKey'] ?? ''));

        $l = $this->leaves->find($id);
        if (!$l || $l->getCreatedByApiKey() !== $u->apiKey) {
            return $this->jsonOk(['error' => 'Not found'], 404);
        }

        if ($this->leave_request->can($l, 'submit')) {
            $this->leave_request->apply($l, 'submit');
            $this->em->flush();
        }

        // Create notification for manager (MVP: managerKey provided by client)
        if ($managerKey !== '') {
            $n = new Notification();
            $n->setRecipientApiKey($managerKey);
            $n->setTitle('Nouvelle demande de congé');
            $n->setMessage('Une demande de congé est en attente de validation.');
            $this->em->persist($n);
            $this->em->flush();

            $this->bus->dispatch(new PublishNotificationMessage(
                recipientApiKey: $managerKey,
                title: $n->getTitle(),
                message: $n->getMessage(),
                notificationId: $n->getId(),
                createdAtIso: $n->getCreatedAt()->format(DATE_ATOM)
            ));
        }

        return $this->jsonOk(['status' => $l->getStatus()]);
    }

    #[Route('/api/leave-requests/{id}/cancel', methods: ['POST'])]
    public function cancel(string $id, Request $request): JsonResponse
    {
        $u = $this->requireUser($request);
        $l = $this->leaves->find($id);
        if (!$l || $l->getCreatedByApiKey() !== $u->apiKey) {
            return $this->jsonOk(['error' => 'Not found'], 404);
        }

        if ($this->leave_request->can($l, 'cancel')) {
            $this->leave_request->apply($l, 'cancel');
            $this->em->flush();
        }

        return $this->jsonOk(['status' => $l->getStatus()]);
    }
}

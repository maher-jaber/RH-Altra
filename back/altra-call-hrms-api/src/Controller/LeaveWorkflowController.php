<?php
namespace App\Controller;

use App\Entity\LeaveRequest;
use App\Entity\Notification;
use App\Message\PublishNotificationMessage;
use App\Service\LeaveNotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Annotation\Route;

class LeaveWorkflowController extends ApiBase {

    #[Route('/api/leaves/pending/manager', methods:['GET'])]
    public function pendingManager(Request $r, EntityManagerInterface $em): JsonResponse {
        $u = $this->requireDbUser($r, $em);
        $items = $em->getRepository(LeaveRequest::class)->findBy([
            'status' => LeaveRequest::STATUS_SUBMITTED,
            'manager' => $u
        ], ['id' => 'DESC']);
        return $this->jsonOk(['items' => array_map([$this,'serialize'], $items)]);
    }

    #[Route('/api/leaves/{id}/manager-approve', methods:['POST'])]
    public function managerApprove(
        string $id,
        Request $r,
        EntityManagerInterface $em,
        LeaveNotificationService $mail,
        MessageBusInterface $bus
    ): JsonResponse {
        $u = $this->requireDbUser($r, $em);
        $lr=$em->getRepository(LeaveRequest::class)->find($id);
        if(!$lr) return $this->json(['error'=>'not_found'],404);
        if($lr->getManager()?->getId()!==$u->getId()) return $this->json(['error'=>'forbidden'],403);
        $data = json_decode((string)$r->getContent(), true) ?: [];
        if (isset($data['comment'])) { $lr->setManagerComment((string)$data['comment']); }
        $lr->setStatus(LeaveRequest::STATUS_MANAGER_APPROVED);
        $em->flush();

        // Notify employee (in-app + email)
        if ($lr->getUser()) {
            $n = new Notification();
            $n->setUser($lr->getUser());
            $n->setTitle('Votre congé a été validé par votre manager');
            $n->setBody('Votre demande est passée à l\'étape RH.');
            $n->setType('LEAVE');
            $em->persist($n);
            $em->flush();

            $bus->dispatch(new PublishNotificationMessage(
                recipientApiKey: $lr->getUser()->getApiKey(),
                title: $n->getTitle(),
                body: (string)$n->getBody(),
                type: $n->getType(),
                notificationId: (string)$n->getId(),
                createdAtIso: $n->getCreatedAt()->format(DATE_ATOM)
            ));
        }

        try { $mail->onManagerDecision($lr); } catch (\Throwable $e) { /* ignore */ }

        return $this->jsonOk(['status'=>$lr->getStatus()]);
    }

    #[Route('/api/leaves/pending/hr', methods:['GET'])]
    public function pendingHr(Request $r, EntityManagerInterface $em): JsonResponse {
        $this->requireRole($r,'ROLE_ADMIN');
        $items=$em->getRepository(LeaveRequest::class)->findBy(['status'=>LeaveRequest::STATUS_MANAGER_APPROVED], ['id'=>'DESC']);
        return $this->jsonOk(['items'=>array_map([$this,'serialize'], $items)]);
    }

    #[Route('/api/leaves/{id}/hr-approve', methods:['POST'])]
    public function hrApprove(
        string $id,
        Request $r,
        EntityManagerInterface $em,
        LeaveNotificationService $mail,
        MessageBusInterface $bus
    ): JsonResponse {
        $this->requireRole($r,'ROLE_ADMIN');
        $lr=$em->getRepository(LeaveRequest::class)->find($id);
        if(!$lr) return $this->json(['error'=>'not_found'],404);
        $data = json_decode((string)$r->getContent(), true) ?: [];
        if (isset($data['comment'])) { $lr->setHrComment((string)$data['comment']); }
        $lr->setStatus(LeaveRequest::STATUS_HR_APPROVED);
        $em->flush();

        // Notify employee (in-app + email)
        if ($lr->getUser()) {
            $n = new Notification();
            $n->setUser($lr->getUser());
            $n->setTitle('Votre congé a été validé par la RH');
            $n->setBody('Votre demande de congé est approuvée.');
            $n->setType('LEAVE');
            $em->persist($n);
            $em->flush();

            $bus->dispatch(new PublishNotificationMessage(
                recipientApiKey: $lr->getUser()->getApiKey(),
                title: $n->getTitle(),
                body: (string)$n->getBody(),
                type: $n->getType(),
                notificationId: (string)$n->getId(),
                createdAtIso: $n->getCreatedAt()->format(DATE_ATOM)
            ));
        }

        try { $mail->onHrDecision($lr); } catch (\Throwable $e) { /* ignore */ }

        return $this->jsonOk(['status'=>$lr->getStatus()]);
    }

    #[Route('/api/leaves/{id}/reject', methods:['POST'])]
    public function reject(
        string $id,
        Request $r,
        EntityManagerInterface $em,
        MessageBusInterface $bus
    ): JsonResponse {
        $this->requireUser($r);
        $lr=$em->getRepository(LeaveRequest::class)->find($id);
        if(!$lr) return $this->json(['error'=>'not_found'],404);
        $data = json_decode((string)$r->getContent(), true) ?: [];
        // store comment depending on who rejects
        $u = $this->requireUser($r);
        if (in_array('ROLE_ADMIN', $u->roles ?? [], true)) {
            if (isset($data['comment'])) { $lr->setHrComment((string)$data['comment']); }
        } else {
            if (isset($data['comment'])) { $lr->setManagerComment((string)$data['comment']); }
        }
        $lr->setStatus(LeaveRequest::STATUS_REJECTED);
        $em->flush();

        // Notify employee if possible
        if ($lr->getUser()) {
            $n = new Notification();
            $n->setUser($lr->getUser());
            $n->setTitle('Votre demande de congé a été refusée');
            $n->setBody('Consultez les commentaires (manager / RH) dans le détail de la demande.');
            $n->setType('LEAVE');
            $em->persist($n);
            $em->flush();

            $bus->dispatch(new PublishNotificationMessage(
                recipientApiKey: $lr->getUser()->getApiKey(),
                title: $n->getTitle(),
                body: (string)$n->getBody(),
                type: $n->getType(),
                notificationId: (string)$n->getId(),
                createdAtIso: $n->getCreatedAt()->format(DATE_ATOM)
            ));
        }

        return $this->jsonOk(['status'=>$lr->getStatus()]);
    }

    private function serialize(LeaveRequest $lr): array
    {
        $t = $lr->getType();
        $u = $lr->getUser();
        $m = $lr->getManager();
        return [
            'id' => (string)$lr->getId(),
            'type' => $t ? [
                'id' => (string)$t->getId(),
                'code' => $t->getCode(),
                'label' => $t->getLabel(),
                'requiresCertificate' => $t->getRequiresCertificate(),
                'annualAllowance' => $t->getAnnualAllowance(),
            ] : null,
            'user' => $u ? ['id' => (string)$u->getId(), 'fullName' => $u->getFullName(), 'email' => $u->getEmail()] : null,
            'manager' => $m ? ['id' => (string)$m->getId(), 'fullName' => $m->getFullName(), 'email' => $m->getEmail()] : null,
            'startDate' => $lr->getStartDate()?->format('Y-m-d'),
            'endDate' => $lr->getEndDate()?->format('Y-m-d'),
            'daysCount' => $lr->getDaysCount(),
            'status' => $lr->getStatus(),
            'note' => $lr->getNote(),
            'certificatePath' => $lr->getCertificatePath(),
            'managerComment' => method_exists($lr,'getManagerComment') ? $lr->getManagerComment() : null,
            'hrComment' => method_exists($lr,'getHrComment') ? $lr->getHrComment() : null,
        ];
    }
}

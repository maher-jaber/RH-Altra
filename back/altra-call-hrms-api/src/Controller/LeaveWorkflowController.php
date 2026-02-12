<?php
namespace App\Controller;

use App\Entity\LeaveRequest;
use App\Entity\Notification;
use App\Message\PublishNotificationMessage;
use App\Service\LeaveNotificationService;
use App\Service\SettingsService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Annotation\Route;

class LeaveWorkflowController extends ApiBase {

        #[Route('/api/leaves/pending/manager', methods:['GET'])]
    public function pendingManager(Request $r, EntityManagerInterface $em): JsonResponse {
        $u = $this->requireDbUser($r, $em);
        $pg = $this->parsePagination($r);

        if (!$pg['enabled']) {
            $items = $em->getRepository(LeaveRequest::class)->findBy([
                'status' => LeaveRequest::STATUS_SUBMITTED,
                'manager' => $u
            ], ['id' => 'DESC']);
            return $this->jsonOk(['items' => array_map([$this,'serialize'], $items)]);
        }

        // Eager-load relations to avoid N+1 queries when serializing (user/manager/type)
        $qb = $em->createQueryBuilder()
            ->select('lr, t, u, m')
            ->from(LeaveRequest::class, 'lr')
            ->leftJoin('lr.type', 't')->addSelect('t')
            ->leftJoin('lr.user', 'u')->addSelect('u')
            ->leftJoin('lr.manager', 'm')->addSelect('m')
            ->where('lr.status = :st')
            ->andWhere('lr.manager = :m')
            ->setParameter('st', LeaveRequest::STATUS_SUBMITTED)
            ->setParameter('m', $u)
            ->orderBy('lr.id', 'DESC')
            ->setFirstResult($pg['offset'])
            ->setMaxResults($pg['limit']);

        $items = $qb->getQuery()->getResult();

        $countQb = $em->createQueryBuilder()
            ->select('COUNT(lr2.id)')
            ->from(LeaveRequest::class, 'lr2')
            ->where('lr2.status = :st')
            ->andWhere('lr2.manager = :m')
            ->setParameter('st', LeaveRequest::STATUS_SUBMITTED)
            ->setParameter('m', $u);

        $total = (int)$countQb->getQuery()->getSingleScalarResult();

        return $this->jsonOk([
            'items' => array_map([$this,'serialize'], $items),
            'meta' => [
                'page' => $pg['page'],
                'limit' => $pg['limit'],
                'total' => $total,
                'pages' => (int)ceil($total / max(1,$pg['limit'])),
            ]
        ]);
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
        if($lr->getStatus() !== LeaveRequest::STATUS_SUBMITTED) return $this->json(['error'=>'invalid_status'],400);




        $data = json_decode((string)$r->getContent(), true) ?: [];
        if (isset($data['comment'])) { $lr->setManagerComment((string)$data['comment']); }
        $lr->setStatus(LeaveRequest::STATUS_MANAGER_APPROVED);
        $em->flush();

        // Notify employee (in-app + email)
        if ($lr->getUser()) {
            $n = new Notification();
            $n->setUser($lr->getUser());
            $n->setTitle('Congé · Validé manager');
            $n->setBody('Votre demande est passée à l\'étape RH. Ouvrez le détail pour voir les dates et commentaires.');
            $n->setActionUrl('/leaves/detail/' . $lr->getId());
            $n->setPayload($this->serialize($lr));
            $n->setType('LEAVE');
            $em->persist($n);
            $em->flush();

            $bus->dispatch(new PublishNotificationMessage(
                recipientApiKey: $lr->getUser()->getApiKey(),
                title: $n->getTitle(),
                body: (string)$n->getBody(),
                type: $n->getType(),
                notificationId: (string)$n->getId(),
                createdAtIso: $n->getCreatedAt()->format(DATE_ATOM),
                actionUrl: $n->getActionUrl(),
                payload: $n->getPayload()
            ));
        }

        try { $mail->onManagerDecision($lr); } catch (\Throwable $e) { /* ignore */ }

        return $this->jsonOk(['status'=>$lr->getStatus()]);
    }

        #[Route('/api/leaves/pending/hr', methods:['GET'])]
    public function pendingHr(Request $r, EntityManagerInterface $em): JsonResponse {
        $this->requireRole($r, 'ROLE_ADMIN');
        $pg = $this->parsePagination($r);

        if (!$pg['enabled']) {
            $items = $em->getRepository(LeaveRequest::class)->findBy([
                'status' => LeaveRequest::STATUS_MANAGER_APPROVED,
            ], ['id' => 'DESC']);
            return $this->jsonOk(['items' => array_map([$this,'serialize'], $items)]);
        }

        // Eager-load relations to avoid N+1 queries when serializing (user/manager/type)
        $qb = $em->createQueryBuilder()
            ->select('lr, t, u, m')
            ->from(LeaveRequest::class, 'lr')
            ->leftJoin('lr.type', 't')->addSelect('t')
            ->leftJoin('lr.user', 'u')->addSelect('u')
            ->leftJoin('lr.manager', 'm')->addSelect('m')
            ->where('lr.status = :st')
            ->setParameter('st', LeaveRequest::STATUS_MANAGER_APPROVED)
            ->orderBy('lr.id', 'DESC')
            ->setFirstResult($pg['offset'])
            ->setMaxResults($pg['limit']);

        $items = $qb->getQuery()->getResult();

        $countQb = $em->createQueryBuilder()
            ->select('COUNT(lr2.id)')
            ->from(LeaveRequest::class, 'lr2')
            ->where('lr2.status = :st')
            ->setParameter('st', LeaveRequest::STATUS_MANAGER_APPROVED);

        $total = (int)$countQb->getQuery()->getSingleScalarResult();

        return $this->jsonOk([
            'items' => array_map([$this,'serialize'], $items),
            'meta' => [
                'page' => $pg['page'],
                'limit' => $pg['limit'],
                'total' => $total,
                'pages' => (int)ceil($total / max(1,$pg['limit'])),
            ]
        ]);
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

        if($lr->getStatus() !== LeaveRequest::STATUS_MANAGER_APPROVED) return $this->json(['error'=>'invalid_status'],400);

        $data = json_decode((string)$r->getContent(), true) ?: [];
        if (isset($data['comment'])) { $lr->setHrComment((string)$data['comment']); }
        $lr->setStatus(LeaveRequest::STATUS_HR_APPROVED);
        $em->flush();

        // Notify employee (in-app + email)
        if ($lr->getUser()) {
            $n = new Notification();
            $n->setUser($lr->getUser());
            $n->setTitle('Congé · Approuvé RH');
            $n->setBody('Votre demande de congé est approuvée. Ouvrez le détail pour voir les dates et commentaires.');
            $n->setActionUrl('/leaves/detail/' . $lr->getId());
            $n->setPayload($this->serialize($lr));
            $n->setType('LEAVE');
            $em->persist($n);
            $em->flush();

            $bus->dispatch(new PublishNotificationMessage(
                recipientApiKey: $lr->getUser()->getApiKey(),
                title: $n->getTitle(),
                body: (string)$n->getBody(),
                type: $n->getType(),
                notificationId: (string)$n->getId(),
                createdAtIso: $n->getCreatedAt()->format(DATE_ATOM),
                actionUrl: $n->getActionUrl(),
                payload: $n->getPayload()
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
        $token = $this->requireUser($r);
        $me = $this->requireDbUser($r, $em);
        $lr=$em->getRepository(LeaveRequest::class)->find($id);
        if(!$lr) return $this->json(['error'=>'not_found'],404);

        $isAdmin = in_array('ROLE_ADMIN', $token->roles ?? [], true);
        $isManager = $lr->getManager()?->getId() === $me->getId();
        if (!$isAdmin && !$isManager) {
            return $this->json(['error'=>'forbidden'],403);
        }
        // only allow reject before final approval
        if (!in_array($lr->getStatus(), [LeaveRequest::STATUS_SUBMITTED, LeaveRequest::STATUS_MANAGER_APPROVED], true)) {
            return $this->json(['error'=>'invalid_status'],400);
        }
        $data = json_decode((string)$r->getContent(), true) ?: [];
        // store comment depending on who rejects
        $u = $token;
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
            $n->setTitle('Congé · Refusé');
            $n->setBody('Consultez les commentaires (manager / RH) dans le détail de la demande.');
            $n->setActionUrl('/leaves/detail/' . $lr->getId());
            $n->setPayload($this->serialize($lr));
            $n->setType('LEAVE');
            $em->persist($n);
            $em->flush();

            $bus->dispatch(new PublishNotificationMessage(
                recipientApiKey: $lr->getUser()->getApiKey(),
                title: $n->getTitle(),
                body: (string)$n->getBody(),
                type: $n->getType(),
                notificationId: (string)$n->getId(),
                createdAtIso: $n->getCreatedAt()->format(DATE_ATOM),
                actionUrl: $n->getActionUrl(),
                payload: $n->getPayload()
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

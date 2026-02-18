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

        // Dual-manager: show SUBMITTED requests where I am manager1 or manager2, and I haven't signed yet.
        // NOTE: Use IDENTITY() comparisons to avoid edge-cases with proxy/detached entities.
        $meId = (int)$u->getId();
        if (!$pg['enabled']) {
            $qb = $em->createQueryBuilder()
                ->select('lr, t, emp, m1, m2')
                ->from(LeaveRequest::class, 'lr')
                ->leftJoin('lr.type', 't')->addSelect('t')
                ->leftJoin('lr.user', 'emp')->addSelect('emp')
                ->leftJoin('lr.manager', 'm1')->addSelect('m1')
                ->leftJoin('lr.manager2', 'm2')->addSelect('m2')
                ->where('lr.status = :st')
                ->andWhere('((IDENTITY(lr.manager) = :meId) OR (IDENTITY(lr.manager2) = :meId))')
                ->setParameter('st', LeaveRequest::STATUS_SUBMITTED)
                ->setParameter('meId', $meId)
                ->orderBy('lr.id', 'DESC');
            $items = $qb->getQuery()->getResult();
            return $this->jsonOk(['items' => array_map([$this,'serialize'], $items)]);
        }

        // Eager-load relations to avoid N+1 queries when serializing (user/manager/type)
        $qb = $em->createQueryBuilder()
            ->select('lr, t, emp, m1, m2')
            ->from(LeaveRequest::class, 'lr')
            ->leftJoin('lr.type', 't')->addSelect('t')
            ->leftJoin('lr.user', 'emp')->addSelect('emp')
            ->leftJoin('lr.manager', 'm1')->addSelect('m1')
            ->leftJoin('lr.manager2', 'm2')->addSelect('m2')
            ->where('lr.status = :st')
            ->andWhere('((IDENTITY(lr.manager) = :meId) OR (IDENTITY(lr.manager2) = :meId))')
            ->setParameter('st', LeaveRequest::STATUS_SUBMITTED)
            ->setParameter('meId', $meId)
            ->orderBy('lr.id', 'DESC')
            ->setFirstResult($pg['offset'])
            ->setMaxResults($pg['limit']);

        $items = $qb->getQuery()->getResult();

        $countQb = $em->createQueryBuilder()
            ->select('COUNT(lr2.id)')
            ->from(LeaveRequest::class, 'lr2')
            ->where('lr2.status = :st')
            ->andWhere('((IDENTITY(lr2.manager) = :meId AND lr2.managerSignedAt IS NULL) OR (IDENTITY(lr2.manager2) = :meId AND lr2.manager2SignedAt IS NULL))')
            ->setParameter('st', LeaveRequest::STATUS_SUBMITTED)
            ->setParameter('meId', $meId);

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
        SettingsService $settings,
        MessageBusInterface $bus
    ): JsonResponse {
        $u = $this->requireDbUser($r, $em);
        $lr = $em->getRepository(LeaveRequest::class)->find($id);
        if (!$lr) return $this->json(['error'=>'not_found'],404);
        if ($lr->getStatus() !== LeaveRequest::STATUS_SUBMITTED) return $this->json(['error'=>'invalid_status'],400);

        $isM1 = $lr->getManager()?->getId() === $u->getId();
        $isM2 = $lr->getManager2()?->getId() === $u->getId();
        if (!$isM1 && !$isM2) return $this->json(['error'=>'forbidden'],403);

        // Prevent double-approval by the same manager
        if ($isM1 && $lr->getManagerSignedAt() !== null) return $this->json(['error'=>'already_signed'],409);
        if ($isM2 && $lr->getManager2SignedAt() !== null) return $this->json(['error'=>'already_signed'],409);

        $data = json_decode((string)$r->getContent(), true) ?: [];
        $comment = isset($data['comment']) ? (string)$data['comment'] : null;

        if ($isM1) {
            if ($comment !== null) { $lr->setManagerComment($comment); }
            $lr->setManagerSignedAt(new \DateTimeImmutable());
        }
        if ($isM2) {
            if ($comment !== null) { $lr->setManager2Comment($comment); }
            $lr->setManager2SignedAt(new \DateTimeImmutable());
        }

        $needsM2 = $lr->getManager2() !== null && $lr->getManager2()?->getId() !== $lr->getManager()?->getId();
        $bothOk = $lr->getManagerSignedAt() !== null && (!$needsM2 || $lr->getManager2SignedAt() !== null);

        // No RH step: once both managers sign (or only one manager exists), the leave is finalized.
        if ($bothOk) {
            $lr->setStatus(LeaveRequest::STATUS_HR_APPROVED);
        }

        $em->flush();

        // Notify employee
        if ($lr->getUser()) {
            $n = new Notification();
            $n->setUser($lr->getUser());
            if ($bothOk) {
                $n->setTitle('Congé · Approuvé');
                $n->setBody('Votre demande de congé est approuvée (validation finale).');
            } else {
                $n->setTitle('Congé · Validation manager enregistrée');
                $n->setBody('Une validation manager est enregistrée. En attente de la 2ème validation.');
            }
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

        // Notify second manager if needed and not yet signed
        if (!$bothOk && $lr->getManager2() && $lr->getManager2SignedAt() === null) {
            $m2 = $lr->getManager2();
            $n2 = new Notification();
            $n2->setUser($m2);
            $n2->setTitle('Demande de congé · 2ème validation requise');
            $n2->setBody('Une demande de congé attend votre validation (manager 2).');
            $n2->setActionUrl('/leaves/detail/' . $lr->getId());
            $n2->setPayload(['leaveId'=>(string)$lr->getId(), 'requiresAction'=>true]);
            $n2->setType('LEAVE');
            $em->persist($n2);
            $em->flush();

            $bus->dispatch(new PublishNotificationMessage(
                recipientApiKey: $m2->getApiKey(),
                title: $n2->getTitle(),
                body: (string)$n2->getBody(),
                type: $n2->getType(),
                notificationId: (string)$n2->getId(),
                createdAtIso: $n2->getCreatedAt()->format(DATE_ATOM),
                actionUrl: $n2->getActionUrl(),
                payload: $n2->getPayload()
            ));
        }

        // Best-effort email (employee)
        try {
            if ($lr->getUser() && $settings->canSendEmail($lr->getUser(), 'LEAVE')) {
                $mail->onManagerDecision($lr);
            }
        } catch (\Throwable) { /* ignore */ }

        return $this->jsonOk(['status'=>$lr->getStatus()]);
    }

    // RH removed: no pending/hr nor hr-approve endpoint.

    #[Route('/api/leaves/{id}/reject', methods:['POST'])]
    public function reject(
        string $id,
        Request $r,
        EntityManagerInterface $em,
        LeaveNotificationService $mail,
        SettingsService $settings,
        MessageBusInterface $bus
    ): JsonResponse {
        $token = $this->requireUser($r);
        $me = $this->requireDbUser($r, $em);
        $lr=$em->getRepository(LeaveRequest::class)->find($id);
        if(!$lr) return $this->json(['error'=>'not_found'],404);

        $isAdmin = in_array('ROLE_ADMIN', $token->roles ?? [], true);
        $isManager = $lr->getManager()?->getId() === $me->getId();
        $isManager2 = $lr->getManager2()?->getId() === $me->getId();
        if (!$isAdmin && !$isManager && !$isManager2) {
            return $this->json(['error'=>'forbidden'],403);
        }
        // only allow reject before final approval
        if (!in_array($lr->getStatus(), [LeaveRequest::STATUS_SUBMITTED, LeaveRequest::STATUS_MANAGER_APPROVED], true)) {
            return $this->json(['error'=>'invalid_status'],400);
        }
        $data = json_decode((string)$r->getContent(), true) ?: [];
        // store comment depending on who rejects
        if ($isAdmin) {
            if (isset($data['comment'])) { $lr->setHrComment((string)$data['comment']); }
        } elseif ($isManager2) {
            if (isset($data['comment'])) { $lr->setManager2Comment((string)$data['comment']); }
            $lr->setManager2SignedAt(new \DateTimeImmutable());
        } else {
            if (isset($data['comment'])) { $lr->setManagerComment((string)$data['comment']); }
            $lr->setManagerSignedAt(new \DateTimeImmutable());
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

        // Best-effort email to employee
        try {
            if ($lr->getUser() && $settings->canSendEmail($lr->getUser(), 'LEAVE')) {
                // For admin reject -> treat as RH decision, else manager decision
                if ($isAdmin) $mail->onHrDecision($lr);
                else $mail->onManagerDecision($lr);
            }
        } catch (\Throwable) { /* ignore */ }

        return $this->jsonOk(['status'=>$lr->getStatus()]);
    }

    private function serialize(LeaveRequest $lr): array
    {
        $t = $lr->getType();
        $u = $lr->getUser();
        $m = $lr->getManager();
        $m2 = method_exists($lr,'getManager2') ? $lr->getManager2() : null;
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
            'manager2' => $m2 ? ['id' => (string)$m2->getId(), 'fullName' => $m2->getFullName(), 'email' => $m2->getEmail()] : null,
            'startDate' => $lr->getStartDate()?->format('Y-m-d'),
            'endDate' => $lr->getEndDate()?->format('Y-m-d'),
            'daysCount' => $lr->getDaysCount(),
            'status' => $lr->getStatus(),
            'note' => $lr->getNote(),
            'certificatePath' => $lr->getCertificatePath(),
            'managerComment' => method_exists($lr,'getManagerComment') ? $lr->getManagerComment() : null,
            'manager2Comment' => method_exists($lr,'getManager2Comment') ? $lr->getManager2Comment() : null,
            'hrComment' => method_exists($lr,'getHrComment') ? $lr->getHrComment() : null,
            'managerSignedAt' => method_exists($lr,'getManagerSignedAt') && $lr->getManagerSignedAt() ? $lr->getManagerSignedAt()->format(DATE_ATOM) : null,
            'manager2SignedAt' => method_exists($lr,'getManager2SignedAt') && $lr->getManager2SignedAt() ? $lr->getManager2SignedAt()->format(DATE_ATOM) : null,
        ];
    }
}

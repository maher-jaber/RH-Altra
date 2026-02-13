<?php

namespace App\Controller;

use App\Entity\LeaveRequest;
use App\Entity\LeaveType;
use App\Entity\Notification;
use App\Entity\User;
use App\Message\PublishNotificationMessage;
use App\Repository\LeaveRequestRepository;
use App\Service\ApiResponse;
use App\Service\LeaveNotificationService;
use App\Service\SettingsService;
use App\Service\WorkingDaysService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Workflow\WorkflowInterface;

/**
 * Legacy endpoints used by the "Mes demandes (MVP)" leave UI.
 * Kept for backward compatibility, but implemented on top of the same
 * LeaveRequest + LeaveType model and the same Notification/Mercure system.
 */
class LeaveController extends ApiBase
{
    public function __construct(
        private EntityManagerInterface $em,
        private LeaveRequestRepository $leaves,
        private WorkflowInterface $leave_request,
        private MessageBusInterface $bus,
        private WorkingDaysService $workingDays,
        private LeaveNotificationService $mailer,
        private SettingsService $settings,
    ) {}

    #[Route('/api/leave-requests', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $user = $this->requireDbUser($request, $this->em);
        $payload = json_decode((string) $request->getContent(), true) ?: [];

        $typeCode = strtoupper((string)($payload['type'] ?? $payload['typeCode'] ?? 'ANNUAL'));
        $startStr = (string)($payload['startDate'] ?? '');
        $endStr = (string)($payload['endDate'] ?? '');

        if ($startStr === '' || $endStr === '') {
            return $this->json(['error' => 'startDate/endDate required'], 400);
        }

        try {
            $start = new \DateTimeImmutable($startStr);
            $end = new \DateTimeImmutable($endStr);
        } catch (\Throwable) {
            return $this->json(['error' => 'invalid_dates'], 400);
        }

        if ($end < $start) {
            return $this->json(['error' => 'invalid_dates'], 400);
        }

        $today = new \DateTimeImmutable('today');

        // Past dates can be allowed via settings (useful for back-office regularization)
        if (!$this->settings->leaveAllowPastDates()) {
            if ($start < $today || $end < $today) {
                return $this->json(['error' => 'past_dates'], 400);
            }
        }

        // Minimum notice rule (days before start)
        $minNotice = $this->settings->leaveMinNoticeDays();
        if ($minNotice > 0) {
            $minStart = $today->modify('+' . $minNotice . ' days');
            if ($start < $minStart) {
                return $this->json(['error' => 'min_notice', 'minNoticeDays' => $minNotice], 400);
            }
        }

/** @var LeaveType|null $type */
        $type = $this->em->getRepository(LeaveType::class)->findOneBy(['code' => $typeCode]);
        if (!$type) {
            return $this->json(['error' => 'type_not_found'], 404);
        }

        $days = $this->workingDays->countWorkingDays($start, $end);
        if ($days <= 0) {
            return $this->json(['error' => 'no_working_days'], 400);
        }

        $maxDays = $this->settings->leaveMaxDaysPerRequest();
        if ($days > $maxDays) {
            return $this->json(['error' => 'max_days_per_request', 'maxDays' => $maxDays], 400);
        }

        // Drafts are allowed to overlap, BUT active requests (submitted/approved) should block.
        $activeStatuses = [LeaveRequest::STATUS_SUBMITTED, LeaveRequest::STATUS_MANAGER_APPROVED, LeaveRequest::STATUS_HR_APPROVED];
        $qb = $this->em->createQueryBuilder();
        $qb->select('COUNT(l.id)')
            ->from(LeaveRequest::class, 'l')
            ->where('l.user = :u')
            ->andWhere('l.status IN (:statuses)')
            ->andWhere('l.startDate <= :end AND l.endDate >= :start')
            ->setParameters(['u' => $user, 'statuses' => $activeStatuses, 'start' => $start, 'end' => $end]);
        $conf = (int)$qb->getQuery()->getSingleScalarResult();
        if ($conf > 0) {
            $qb3 = $this->em->createQueryBuilder();
            $qb3->select('l')
                ->from(LeaveRequest::class, 'l')
                ->where('l.user = :u')
                ->andWhere('l.status IN (:statuses)')
                ->andWhere('l.startDate <= :end AND l.endDate >= :start')
                ->setParameters(['u' => $user, 'statuses' => $activeStatuses, 'start' => $start, 'end' => $end])
                ->orderBy('l.startDate', 'ASC');
            $items = $qb3->getQuery()->getResult();

            return $this->json([
                'error' => 'overlap',
                'conflicts' => array_map(fn(LeaveRequest $x) => [
                    'id' => (string)$x->getId(),
                    'status' => $x->getStatus(),
                    'startDate' => $x->getStartDate()->format('Y-m-d'),
                    'endDate' => $x->getEndDate()->format('Y-m-d'),
                ], $items),
            ], 409);
        }

        $l = new LeaveRequest();
        $l->setCreatedByApiKey($user->getApiKey());
        $l->setUser($user);
        $l->setManager($user->getManager());
        $l->setManager2($user->getManager2());
        $l->setType($type);
        $l->setStartDate($start);
        $l->setEndDate($end);
        $l->setDaysCount($days);
        $l->setHalfDay(($payload['halfDay'] ?? null) ?: null);
        $l->setReason(($payload['reason'] ?? null) ?: null);
        $l->setStatus(LeaveRequest::STATUS_DRAFT);

        $this->em->persist($l);
        $this->em->flush();

        return $this->jsonOk(ApiResponse::leave($l), 201);
    }

    #[Route('/api/leave-requests/my', methods: ['GET'])]
    public function my(Request $request): JsonResponse
    {
        $u = $this->requireDbUser($request, $this->em);
        $list = $this->leaves->findBy(['user' => $u], ['id' => 'DESC']);
        return $this->jsonOk(array_map([ApiResponse::class, 'leave'], $list));
    }

    #[Route('/api/leave-requests/{id}/submit', methods: ['POST'])]
    public function submit(string $id, Request $request): JsonResponse
    {
        $me = $this->requireDbUser($request, $this->em);
        /** @var LeaveRequest|null $l */
        $l = $this->leaves->find($id);
        if (!$l || $l->getUser()?->getId() !== $me->getId()) {
            return $this->json(['error' => 'not_found'], 404);
        }

        // Certificate required?
        if ($l->getType()?->getRequiresCertificate() && !$l->getCertificatePath()) {
            return $this->json(['error' => 'certificate_required'], 409);
        }

        // Re-check overlap at submit time.
        $activeStatuses = [LeaveRequest::STATUS_SUBMITTED, LeaveRequest::STATUS_MANAGER_APPROVED, LeaveRequest::STATUS_HR_APPROVED];
        $qb = $this->em->createQueryBuilder();
        $qb->select('COUNT(x.id)')
            ->from(LeaveRequest::class, 'x')
            ->where('x.user = :u')
            ->andWhere('x.id != :id')
            ->andWhere('x.status IN (:statuses)')
            ->andWhere('x.startDate <= :end AND x.endDate >= :start')
            ->setParameters([
                'u' => $me,
                'id' => $l->getId(),
                'statuses' => $activeStatuses,
                'start' => $l->getStartDate(),
                'end' => $l->getEndDate(),
            ]);
        if ((int)$qb->getQuery()->getSingleScalarResult() > 0) {
            return $this->json(['error' => 'overlap'], 409);
        }

        if ($this->leave_request->can($l, 'submit')) {
            $this->leave_request->apply($l, 'submit');
            $this->em->flush();
        }

        // Notify managers (manager1 + manager2), in-app + mercure + (optional) email
        $managers = array_filter([$l->getManager(), $l->getManager2()]);
        $sent = [];
        foreach ($managers as $manager) {
            if (!$manager) { continue; }
            if (in_array($manager->getId(), $sent, true)) { continue; }
            $sent[] = $manager->getId();

            $n = new Notification();
            $n->setUser($manager);
            $n->setTitle('Demande de congé · ' . ($user->getFullName() ?: $user->getEmail()));
            $n->setActionUrl('/leaves/detail/' . $l->getId());
            $n->setPayload(['leaveId'=>(string)$l->getId(), 'startDate'=>$l->getStartDate()->format('Y-m-d'), 'endDate'=>$l->getEndDate()->format('Y-m-d'), 'daysCount'=>$l->getDaysCount(), 'status'=>$l->getStatus(), 'requiresAction'=>true, 'nextStep'=>'MANAGER_ACTION_REQUIRED']);
            $n->setBody('Une demande de congé est en attente de validation.');
            $n->setType('LEAVE');
            $this->em->persist($n);
            $this->em->flush();

            $this->bus->dispatch(new PublishNotificationMessage(
                recipientApiKey: $manager->getApiKey(),
                title: $n->getTitle(),
                body: (string)$n->getBody(),
                type: $n->getType(),
                notificationId: (string)$n->getId(),
                createdAtIso: $n->getCreatedAt()->format(DATE_ATOM),
                actionUrl: $n->getActionUrl(),
                payload: $n->getPayload()
            ));

            try { if($this->settings->canSendEmail($manager, 'LEAVE')) { $this->mailer->onSubmit($l); } } catch (\Throwable) { /* best-effort */ }
        }


        // Notify employee (confirmation)
        $emp = $l->getUser();
        if ($emp) {
            $n = new Notification();
            $n->setUser($emp);
            $n->setTitle('Congé · Demande envoyée');
            $n->setActionUrl('/leaves/detail/' . $l->getId());
            $n->setPayload([
                'leaveId'=>(string)$l->getId(),
                'startDate'=>$l->getStartDate()->format('Y-m-d'),
                'endDate'=>$l->getEndDate()->format('Y-m-d'),
                'daysCount'=>$l->getDaysCount(),
                'status'=>$l->getStatus(),
                'requiresAction'=>false,
                'nextStep'=>'MANAGER_APPROVAL'
            ]);
            $n->setBody('Votre demande a été envoyée. Prochaine étape: validation manager.');
            $n->setType('LEAVE');
            $this->em->persist($n);
            $this->em->flush();

            $this->bus->dispatch(new PublishNotificationMessage(
                recipientApiKey: $emp->getApiKey(),
                title: $n->getTitle(),
                body: (string)$n->getBody(),
                type: $n->getType(),
                notificationId: (string)$n->getId(),
                createdAtIso: $n->getCreatedAt()->format(DATE_ATOM),
                actionUrl: $n->getActionUrl(),
                payload: $n->getPayload()
            ));

            try { if($this->settings->canSendEmail($emp, 'LEAVE')) { $this->mailer->onEmployeeSubmit($l); } } catch (\Throwable) { /* best-effort */ }
        }

        return $this->jsonOk(['status' => $l->getStatus()]);
    }

    #[Route('/api/leave-requests/{id}/cancel', methods: ['POST'])]
    public function cancel(string $id, Request $request): JsonResponse
    {
        $me = $this->requireDbUser($request, $this->em);
        /** @var LeaveRequest|null $l */
        $l = $this->leaves->find($id);
        if (!$l || $l->getUser()?->getId() !== $me->getId()) {
            return $this->json(['error' => 'not_found'], 404);
        }

        $transition = match ($l->getStatus()) {
            LeaveRequest::STATUS_DRAFT => 'cancel_from_draft',
            LeaveRequest::STATUS_SUBMITTED => 'cancel_from_submitted',
            default => null,
        };

        if (!$transition || !$this->leave_request->can($l, $transition)) {
            return $this->json(['error' => 'invalid_status'], 409);
        }

        $this->leave_request->apply($l, $transition);
        $this->em->flush();


        // Notify employee (confirmation)
        $emp = $l->getUser();
        if ($emp) {
            $n = new Notification();
            $n->setUser($emp);
            $n->setTitle('Congé · Demande envoyée');
            $n->setActionUrl('/leaves/detail/' . $l->getId());
            $n->setPayload([
                'leaveId'=>(string)$l->getId(),
                'startDate'=>$l->getStartDate()->format('Y-m-d'),
                'endDate'=>$l->getEndDate()->format('Y-m-d'),
                'daysCount'=>$l->getDaysCount(),
                'status'=>$l->getStatus(),
                'requiresAction'=>false,
                'nextStep'=>'MANAGER_APPROVAL'
            ]);
            $n->setBody('Votre demande a été envoyée. Prochaine étape: validation manager.');
            $n->setType('LEAVE');
            $this->em->persist($n);
            $this->em->flush();

            $this->bus->dispatch(new PublishNotificationMessage(
                recipientApiKey: $emp->getApiKey(),
                title: $n->getTitle(),
                body: (string)$n->getBody(),
                type: $n->getType(),
                notificationId: (string)$n->getId(),
                createdAtIso: $n->getCreatedAt()->format(DATE_ATOM),
                actionUrl: $n->getActionUrl(),
                payload: $n->getPayload()
            ));

            try { if($this->settings->canSendEmail($emp, 'LEAVE')) { $this->mailer->onEmployeeSubmit($l); } } catch (\Throwable) { /* best-effort */ }
        }

        return $this->jsonOk(['status' => $l->getStatus()]);
    }
}

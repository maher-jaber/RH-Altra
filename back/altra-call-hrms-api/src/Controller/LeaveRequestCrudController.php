<?php
namespace App\Controller;

use App\Entity\LeaveRequest;
use App\Entity\LeaveType;
use App\Entity\Notification;
use App\Message\PublishNotificationMessage;
use App\Service\LeaveNotificationService;
use App\Service\WorkingDaysService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\File\Exception\FileException;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Annotation\Route;

class LeaveRequestCrudController extends ApiBase
{
        #[Route('/api/leaves/my', methods:['GET'])]
    public function my(Request $r, EntityManagerInterface $em): JsonResponse
    {
        $u = $this->requireDbUser($r, $em);
        $pg = $this->parsePagination($r);

        if (!$pg['enabled']) {
            $items = $em->getRepository(LeaveRequest::class)->findBy(['user' => $u], ['id' => 'DESC']);
            return $this->jsonOk(['items' => array_map([$this,'serialize'], $items)]);
        }

        // Eager-load relations to avoid N+1 queries when serializing (user/manager/type)
        $qb = $em->createQueryBuilder()
            ->select('lr, t, u2, m')
            ->from(LeaveRequest::class, 'lr')
            ->leftJoin('lr.type', 't')->addSelect('t')
            ->leftJoin('lr.user', 'u2')->addSelect('u2')
            ->leftJoin('lr.manager', 'm')->addSelect('m')
            ->where('lr.user = :u')
            ->setParameter('u', $u)
            ->orderBy('lr.id', 'DESC')
            ->setFirstResult($pg['offset'])
            ->setMaxResults($pg['limit']);

        $items = $qb->getQuery()->getResult();

        $countQb = $em->createQueryBuilder()
            ->select('COUNT(lr2.id)')
            ->from(LeaveRequest::class, 'lr2')
            ->where('lr2.user = :u')
            ->setParameter('u', $u);

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

       #[Route('/api/leaves/{id}', methods:['GET'])]
    public function getOne(string $id, Request $r, EntityManagerInterface $em): JsonResponse
    {
        $token = $this->requireUser($r);
        $me = $this->requireDbUser($r, $em);

        /** @var LeaveRequest|null $lr */
        $lr = $em->getRepository(LeaveRequest::class)->find($id);
        if (!$lr) return $this->json(['error' => 'not_found'], 404);

        $isAdmin = in_array('ROLE_ADMIN', $token->roles ?? [], true);
        $isOwner = $lr->getUser()?->getId() === $me->getId();
        $isManager = $lr->getManager()?->getId() === $me->getId();

        if (!$isAdmin && !$isOwner && !$isManager) {
            return $this->json(['error' => 'forbidden'], 403);
        }

        return $this->jsonOk(['leave' => $this->serialize($lr)]);
    }


#[Route('/api/leaves', methods:['POST'])]
    public function create(Request $r, EntityManagerInterface $em, WorkingDaysService $svc): JsonResponse
    {
        $u = $this->requireDbUser($r, $em);
        $data = json_decode((string)$r->getContent(), true) ?: [];

        $typeId = $data['typeId'] ?? null;
        $startDate = $data['startDate'] ?? null;
        $endDate = $data['endDate'] ?? null;
        $note = (string)($data['note'] ?? '');

        if (!$typeId || !$startDate || !$endDate) {
            return $this->json(['error' => 'typeId/startDate/endDate required'], 400);
        }

        /** @var LeaveType|null $type */
        $type = $em->getRepository(LeaveType::class)->find($typeId);
        if (!$type) return $this->json(['error' => 'type_not_found'], 404);

        $start = new \DateTimeImmutable($startDate);
        $end = new \DateTimeImmutable($endDate);
        if ($end < $start) return $this->json(['error' => 'invalid_dates'], 400);

        // Rule requested: no past dates
        $today = new \DateTimeImmutable('today');
        if ($start < $today || $end < $today) {
            return $this->json(['error' => 'past_dates'], 400);
        }

        $days = $svc->countWorkingDays($start, $end);
        if ($days <= 0) return $this->json(['error' => 'no_working_days'], 400);

        // Overlap check: drafts should not block creating another draft.
        // Only "active" statuses block overlaps.
        $activeStatuses = [LeaveRequest::STATUS_SUBMITTED, LeaveRequest::STATUS_MANAGER_APPROVED, LeaveRequest::STATUS_HR_APPROVED];

        $qb = $em->createQueryBuilder();
        $qb->select('COUNT(l.id)')
            ->from(LeaveRequest::class, 'l')
            ->where('l.user = :u')
            ->andWhere('l.status IN (:statuses)')
            ->andWhere('l.startDate <= :end AND l.endDate >= :start')
            ->setParameters(['u' => $u, 'statuses' => $activeStatuses, 'start' => $start, 'end' => $end]);
        $conf = (int)$qb->getQuery()->getSingleScalarResult();
        if ($conf > 0) {
            // Help the UI show *why* it overlaps.
            $qb3 = $em->createQueryBuilder();
            $qb3->select('l')
                ->from(LeaveRequest::class, 'l')
                ->where('l.user = :u')
                ->andWhere('l.status IN (:statuses)')
                ->andWhere('l.startDate <= :end AND l.endDate >= :start')
                ->setParameters(['u' => $u, 'statuses' => $activeStatuses, 'start' => $start, 'end' => $end])
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

        if ($type->getAnnualAllowance() > 0) {
            $year = (int)$start->format('Y');
            $from = new \DateTimeImmutable($year.'-01-01');
            $to = new \DateTimeImmutable($year.'-12-31');
            $qb2 = $em->createQueryBuilder();
            $qb2->select('COALESCE(SUM(l2.daysCount),0)')
                ->from(LeaveRequest::class,'l2')
                ->where('l2.user = :u')
                ->andWhere('l2.type = :t')
                ->andWhere('l2.status = :s')
                ->andWhere('l2.startDate >= :from AND l2.endDate <= :to')
                ->setParameters(['u'=>$u,'t'=>$type,'s'=>LeaveRequest::STATUS_HR_APPROVED,'from'=>$from,'to'=>$to]);
            $used = (float)$qb2->getQuery()->getSingleScalarResult();
            if ($used + $days > $type->getAnnualAllowance()) {
                return $this->json([
                    'error' => 'insufficient_balance',
                    'usedDays' => $used,
                    'requestedDays' => $days,
                    'allowance' => $type->getAnnualAllowance()
                ], 409);
            }
        }

        $lr = new LeaveRequest();
        $lr->setType($type);
        $lr->setTypeCode($type->getCode());
        $lr->setUser($u);
        $lr->setManager($u->getManager());
        // keep legacy created_by_api_key for backward compatibility
        $lr->setCreatedByApiKey($u->getApiKey());
        $lr->setStartDate($start);
        $lr->setEndDate($end);
        $lr->setDaysCount($days);
        $lr->setNote($note);
        $lr->setStatus(LeaveRequest::STATUS_DRAFT);

        $em->persist($lr);
        $em->flush();

        return $this->jsonOk(['leave' => $this->serialize($lr)], 201);
    }

    #[Route('/api/leaves/{id}/submit', methods:['POST'])]
    public function submit(
        string $id,
        Request $r,
        EntityManagerInterface $em,
        LeaveNotificationService $mail,
        \Symfony\Component\Messenger\MessageBusInterface $bus
    ): JsonResponse
    {
        $u = $this->requireDbUser($r, $em);
        /** @var LeaveRequest|null $lr */
        $lr = $em->getRepository(LeaveRequest::class)->find($id);
        if (!$lr) return $this->json(['error' => 'not_found'], 404);
        if ($lr->getUser()?->getId() !== $u->getId()) return $this->json(['error' => 'forbidden'], 403);

        if ($lr->getType()?->getRequiresCertificate() && !$lr->getCertificatePath()) {
            return $this->json(['error' => 'certificate_required'], 409);
        }

        // Re-check overlap when submitting (drafts are allowed to overlap; submissions are not)
        $activeStatuses = [LeaveRequest::STATUS_SUBMITTED, LeaveRequest::STATUS_MANAGER_APPROVED, LeaveRequest::STATUS_HR_APPROVED];
        $qb = $em->createQueryBuilder();
        $qb->select('COUNT(l.id)')
          ->from(LeaveRequest::class, 'l')
          ->where('l.user = :u')
          ->andWhere('l.id != :id')
          ->andWhere('l.status IN (:statuses)')
          ->andWhere('l.startDate <= :end AND l.endDate >= :start')
          ->setParameters([
            'u' => $u,
            'id' => $lr->getId(),
            'statuses' => $activeStatuses,
            'start' => $lr->getStartDate(),
            'end' => $lr->getEndDate(),
          ]);
        $conf = (int)$qb->getQuery()->getSingleScalarResult();
        if ($conf > 0) {
            $qb3 = $em->createQueryBuilder();
            $qb3->select('l')
                ->from(LeaveRequest::class, 'l')
                ->where('l.user = :u')
                ->andWhere('l.id != :id')
                ->andWhere('l.status IN (:statuses)')
                ->andWhere('l.startDate <= :end AND l.endDate >= :start')
                ->setParameters([
                    'u' => $u,
                    'id' => $lr->getId(),
                    'statuses' => $activeStatuses,
                    'start' => $lr->getStartDate(),
                    'end' => $lr->getEndDate(),
                ])
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

        $lr->setStatus(LeaveRequest::STATUS_SUBMITTED);
        $em->flush();

        // In-app + email notification to manager (if set)
        if ($lr->getManager()) {
            $n = new Notification();
            $n->setUser($lr->getManager());

            $emp = $lr->getUser();
            $empName = $emp ? ($emp->getFullName() ?: $emp->getEmail()) : 'Employé';
            $range = ($lr->getStartDate()?->format('Y-m-d') ?? '') . ' → ' . ($lr->getEndDate()?->format('Y-m-d') ?? '');
            $typeLabel = $lr->getType()?->getLabel() ?: ($lr->getType()?->getCode() ?: 'Congé');

            $n->setTitle('Demande de congé · ' . $empName);
            $n->setBody($typeLabel . ' · ' . $range . ' · ' . ((string)($lr->getDaysCount() ?? '')). ' jour(s)');
            $n->setType('LEAVE');

            $n->setActionUrl('/leaves/detail/' . $lr->getId());
            $n->setPayload($this->serialize($lr));
            $em->persist($n);
            $em->flush();

            $bus->dispatch(new PublishNotificationMessage(
                recipientApiKey: $lr->getManager()->getApiKey(),
                title: $n->getTitle(),
                body: (string)$n->getBody(),
                type: $n->getType(),
                notificationId: (string)$n->getId(),
                createdAtIso: $n->getCreatedAt()->format(DATE_ATOM),
                actionUrl: $n->getActionUrl(),
                payload: $n->getPayload()
            ));

            // Best-effort email (MAILER_DSN must be configured)
            try { $mail->onSubmit($lr); } catch (\Throwable $e) { /* ignore in MVP */ }
        }

        return $this->jsonOk(['leave' => $this->serialize($lr)]);
    }

    #[Route('/api/leaves/{id}/certificate', methods:['POST'])]
    public function uploadCertificate(string $id, Request $r, EntityManagerInterface $em): JsonResponse
    {
        $u = $this->requireDbUser($r, $em);
        /** @var LeaveRequest|null $lr */
        $lr = $em->getRepository(LeaveRequest::class)->find($id);
        if (!$lr) return $this->json(['error' => 'not_found'], 404);
        if ($lr->getUser()?->getId() !== $u->getId()) return $this->json(['error' => 'forbidden'], 403);

        $file = $r->files->get('file');
        if (!$file) return $this->json(['error'=>'file_required'], 400);

        $dir = $this->getParameter('kernel.project_dir') . '/var/uploads/certificates';
        if (!is_dir($dir)) @mkdir($dir, 0775, true);

        $safeName = bin2hex(random_bytes(8)) . '_' . preg_replace('/[^a-zA-Z0-9._-]/','_', $file->getClientOriginalName());
        try {
            $file->move($dir, $safeName);
        } catch (FileException $e) {
            return $this->json(['error'=>'upload_failed'], 500);
        }
        $lr->setCertificatePath('var/uploads/certificates/'.$safeName);
        $em->flush();

        return $this->jsonOk(['leave' => $this->serialize($lr)]);
    }

    private function serialize(LeaveRequest $lr): array
    {
        $t = $lr->getType();
        $u = $lr->getUser();
        return [
            'id' => (string)$lr->getId(),
            'type' => $t ? [
                'id'=>(string)$t->getId(),
                'code'=>$t->getCode(),
                'label'=>$t->getLabel(),
                'requiresCertificate'=>$t->getRequiresCertificate(),
                'annualAllowance'=>$t->getAnnualAllowance()
            ] : null,
            'user' => $u ? ['id'=>(string)$u->getId(),'fullName'=>$u->getFullName(),'email'=>$u->getEmail()] : null,
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

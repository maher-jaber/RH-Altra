<?php

namespace App\Controller;

use App\Entity\ExitPermission;
use App\Entity\User;
use App\Service\SettingsService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class ExitPermissionController extends ApiBase
{
    public function __construct(private EntityManagerInterface $em, private SettingsService $settings) {}

    private function getCurrentUser(Request $request): User
    {
        $u = $this->requireUser($request);
        /** @var User|null $user */
        $user = $this->em->getRepository(User::class)->findOneBy(['apiKey' => $u->apiKey]);
        if (!$user) {
            throw $this->createNotFoundException('User not found for this API key. Create the user via Admin first.');
        }
        return $user;
    }

    #[Route('/api/exit-permissions/my', methods: ['GET'])]
    public function my(Request $request): JsonResponse
    {
        $user = $this->getCurrentUser($request);
        $rows = $this->em->getRepository(ExitPermission::class)->findBy(['user' => $user], ['id' => 'DESC']);
        return $this->jsonOk(array_map(fn(ExitPermission $e) => $this->serialize($e), $rows));
    }

    #[Route('/api/exit-permissions', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $user = $this->getCurrentUser($request);
        $data = json_decode((string)$request->getContent(), true) ?: [];

        $startAt = isset($data['startAt']) ? new \DateTimeImmutable((string)$data['startAt']) : null;
        $endAt = isset($data['endAt']) ? new \DateTimeImmutable((string)$data['endAt']) : null;

        if (!$startAt || !$endAt || $endAt <= $startAt) {
            return $this->json(['error' => 'startAt/endAt invalid'], 400);
        }

        // Rule: date must not be in the past
        // Optional rule: enforce working hours window (configurable in Settings)
        $enforce = (bool)$this->settings->get(\App\Service\SettingsService::KEY_EXIT_ENFORCE_HOURS, false);
        if ($enforce) {
            $ws = (string)$this->settings->get(\App\Service\SettingsService::KEY_EXIT_WORK_START, '08:00');
            $we = (string)$this->settings->get(\App\Service\SettingsService::KEY_EXIT_WORK_END, '18:00');
            // compare times only (HH:MM)
            $startT = $startAt->format('H:i');
            $endT   = $endAt->format('H:i');
            if ($startT < $ws || $endT > $we) {
                return $this->json(['error' => 'outside_work_hours', 'workStart'=>$ws, 'workEnd'=>$we], 409);
            }
        }


        $today = new \DateTimeImmutable('today');
        if ($startAt < $today || $endAt < $today) {
            return $this->json(['error' => 'past_dates'], 400);
        }

        $e = new ExitPermission();
        $e->setUser($user);
        $e->setManager($user->getManager());
        $e->setStartAt($startAt);
        $e->setEndAt($endAt);
        $e->setReason(isset($data['reason']) ? (string)$data['reason'] : null);

        $status = strtoupper((string)($data['status'] ?? ExitPermission::STATUS_SUBMITTED));
        if (!in_array($status, [ExitPermission::STATUS_DRAFT, ExitPermission::STATUS_SUBMITTED], true)) {
            $status = ExitPermission::STATUS_SUBMITTED;
        }
        $e->setStatus($status);

        $this->em->persist($e);
        $this->em->flush();

        return $this->jsonOk($this->serialize($e), 201);
    }

    #[Route('/api/exit-permissions/pending', methods: ['GET'])]
    public function pending(Request $request): JsonResponse
    {
        $u = $this->requireUser($request);
        $me = $this->getCurrentUser($request);

        $qb = $this->em->createQueryBuilder()
            ->select('e')
            ->from(ExitPermission::class, 'e')
            ->where('e.status = :s')->setParameter('s', ExitPermission::STATUS_SUBMITTED)
            ->orderBy('e.id', 'DESC');

        if (!$this->hasRole($u, 'ROLE_ADMIN')) {
            $qb->andWhere('e.manager = :m')->setParameter('m', $me);
        }

        $rows = $qb->getQuery()->getResult();
        return $this->jsonOk(array_map(fn(ExitPermission $e) => $this->serialize($e), $rows));
    }

    #[Route('/api/exit-permissions/{id}/decision', requirements: ['id' => '\\d+'], methods: ['POST'])]
    public function decide(int $id, Request $request): JsonResponse
    {
        $u = $this->requireUser($request);
        $me = $this->getCurrentUser($request);

        /** @var ExitPermission|null $e */
        $e = $this->em->getRepository(ExitPermission::class)->find($id);
        if (!$e) return $this->json(['error' => 'not_found'], 404);

        if (!$this->hasRole($u, 'ROLE_ADMIN') && $e->getManager()?->getId() !== $me->getId()) {
            return $this->json(['error' => 'forbidden'], 403);
        }
        if ($e->getStatus() !== ExitPermission::STATUS_SUBMITTED) {
            return $this->json(['error' => 'invalid_status'], 400);
        }

        $data = json_decode((string)$request->getContent(), true) ?: [];
        $decision = strtoupper((string)($data['decision'] ?? ''));
        if (!in_array($decision, ['APPROVE', 'REJECT'], true)) {
            return $this->json(['error' => 'decision_required'], 400);
        }

        $e->setStatus($decision === 'APPROVE' ? ExitPermission::STATUS_APPROVED : ExitPermission::STATUS_REJECTED);
        $this->em->flush();

        return $this->jsonOk($this->serialize($e));
    }

    private function serialize(ExitPermission $e): array
    {
        return [
            'id' => $e->getId(),
            'user' => [
                'id' => $e->getUser()?->getId(),
                'fullName' => $e->getUser()?->getFullName(),
                'email' => $e->getUser()?->getEmail(),
            ],
            'manager' => $e->getManager() ? [
                'id' => $e->getManager()?->getId(),
                'fullName' => $e->getManager()?->getFullName(),
                'email' => $e->getManager()?->getEmail(),
            ] : null,
            'startAt' => $e->getStartAt()->format('c'),
            'endAt' => $e->getEndAt()->format('c'),
            'reason' => $e->getReason(),
            'status' => $e->getStatus(),
            'createdAt' => $e->getCreatedAt()->format('c'),
        ];
    }
}
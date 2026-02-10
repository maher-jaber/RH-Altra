<?php

namespace App\Controller;

use App\Entity\AdvanceRequest;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class AdvanceRequestController extends ApiBase
{
    public function __construct(private EntityManagerInterface $em) {}

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

    #[Route('/api/advances/my', methods: ['GET'])]
    public function my(Request $request): JsonResponse
    {
        $user = $this->getCurrentUser($request);

        $rows = $this->em->getRepository(AdvanceRequest::class)
            ->findBy(['user' => $user], ['id' => 'DESC']);

        return $this->jsonOk(array_map(fn(AdvanceRequest $a) => $this->serialize($a), $rows));
    }

    #[Route('/api/advances', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $user = $this->getCurrentUser($request);
        $data = json_decode((string)$request->getContent(), true) ?: [];

        $amount = (float)($data['amount'] ?? 0);
        if ($amount <= 0) {
            return $this->json(['error' => 'amount_required'], 400);
        }

        $a = new AdvanceRequest();
        $a->setUser($user);
        $a->setManager($user->getManager());
        $a->setAmount($amount);
        $a->setCurrency((string)($data['currency'] ?? 'TND'));
        $a->setReason(isset($data['reason']) ? (string)$data['reason'] : null);

        $status = strtoupper((string)($data['status'] ?? AdvanceRequest::STATUS_SUBMITTED));
        if (!in_array($status, [AdvanceRequest::STATUS_DRAFT, AdvanceRequest::STATUS_SUBMITTED], true)) {
            $status = AdvanceRequest::STATUS_SUBMITTED;
        }
        $a->setStatus($status);

        $this->em->persist($a);
        $this->em->flush();

        return $this->jsonOk($this->serialize($a), 201);
    }

    #[Route('/api/advances/pending', methods: ['GET'])]
    public function pending(Request $request): JsonResponse
    {
        $u = $this->requireUser($request);
        $user = $this->getCurrentUser($request);

        $qb = $this->em->createQueryBuilder()
            ->select('a')
            ->from(AdvanceRequest::class, 'a')
            ->where('a.status = :s')->setParameter('s', AdvanceRequest::STATUS_SUBMITTED)
            ->orderBy('a.id', 'DESC');

        if (!$this->hasRole($u, 'ROLE_ADMIN')) {
            $qb->andWhere('a.manager = :m')->setParameter('m', $user);
        }

        $rows = $qb->getQuery()->getResult();

        return $this->jsonOk(array_map(fn(AdvanceRequest $a) => $this->serialize($a), $rows));
    }

    #[Route('/api/advances/{id}/decision', requirements: ['id' => '\\d+'], methods: ['POST'])]
    public function decide(int $id, Request $request): JsonResponse
    {
        $u = $this->requireUser($request);
        $me = $this->getCurrentUser($request);

        /** @var AdvanceRequest|null $a */
        $a = $this->em->getRepository(AdvanceRequest::class)->find($id);
        if (!$a) return $this->json(['error' => 'not_found'], 404);

        if (!$this->hasRole($u, 'ROLE_ADMIN') && $a->getManager()?->getId() !== $me->getId()) {
            return $this->json(['error' => 'forbidden'], 403);
        }
        if ($a->getStatus() !== AdvanceRequest::STATUS_SUBMITTED) {
            return $this->json(['error' => 'invalid_status'], 400);
        }

        $data = json_decode((string)$request->getContent(), true) ?: [];
        $decision = strtoupper((string)($data['decision'] ?? ''));
        if (!in_array($decision, ['APPROVE', 'REJECT'], true)) {
            return $this->json(['error' => 'decision_required'], 400);
        }

        $a->setStatus($decision === 'APPROVE' ? AdvanceRequest::STATUS_APPROVED : AdvanceRequest::STATUS_REJECTED);
        $this->em->flush();

        return $this->jsonOk($this->serialize($a));
    }

    private function serialize(AdvanceRequest $a): array
    {
        return [
            'id' => $a->getId(),
            'user' => [
                'id' => $a->getUser()?->getId(),
                'fullName' => $a->getUser()?->getFullName(),
                'email' => $a->getUser()?->getEmail(),
            ],
            'manager' => $a->getManager() ? [
                'id' => $a->getManager()?->getId(),
                'fullName' => $a->getManager()?->getFullName(),
                'email' => $a->getManager()?->getEmail(),
            ] : null,
            'amount' => $a->getAmount(),
            'currency' => $a->getCurrency(),
            'reason' => $a->getReason(),
            'status' => $a->getStatus(),
            'createdAt' => $a->getCreatedAt()->format('c'),
        ];
    }
}

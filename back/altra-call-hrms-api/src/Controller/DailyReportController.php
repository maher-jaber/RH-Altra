<?php

namespace App\Controller;

use App\Entity\DailyReport;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class DailyReportController extends ApiBase
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

    #[Route('/api/daily-reports/my', methods: ['GET'])]
    public function my(Request $request): JsonResponse
    {
        $user = $this->getCurrentUser($request);
        $rows = $this->em->getRepository(DailyReport::class)->findBy(['user' => $user], ['day' => 'DESC']);
        return $this->jsonOk(array_map(fn(DailyReport $r) => $this->serialize($r), $rows));
    }

    #[Route('/api/daily-reports', methods: ['POST'])]
    public function upsert(Request $request): JsonResponse
    {
        $user = $this->getCurrentUser($request);
        $data = json_decode((string)$request->getContent(), true) ?: [];

        $dayStr = (string)($data['day'] ?? '');
        $content = (string)($data['content'] ?? '');

        if ($dayStr === '' || $content === '') {
            return $this->json(['error' => 'day/content required'], 400);
        }

        $day = new \DateTimeImmutable($dayStr);
        $repo = $this->em->getRepository(DailyReport::class);
        /** @var DailyReport|null $r */
        $r = $repo->findOneBy(['user' => $user, 'day' => $day]);

        if (!$r) {
            $r = new DailyReport();
            $r->setUser($user);
            $r->setDay($day);
            $r->setContent($content);
            $this->em->persist($r);
        } else {
            $r->setContent($content);
        }

        $r->touch();
        $this->em->flush();

        return $this->jsonOk($this->serialize($r));
    }

    #[Route('/api/daily-reports/team', methods: ['GET'])]
    public function team(Request $request): JsonResponse
    {
        $u = $this->requireUser($request);
        $me = $this->getCurrentUser($request);

        if (!$this->hasRole($u, 'ROLE_SUPERIOR') && !$this->hasRole($u, 'ROLE_ADMIN')) {
            return $this->json(['error' => 'forbidden'], 403);
        }

        $qb = $this->em->createQueryBuilder()
            ->select('r')
            ->from(DailyReport::class, 'r')
            ->join('r.user', 'usr')
            ->orderBy('r.day', 'DESC');

        if (!$this->hasRole($u, 'ROLE_ADMIN')) {
            $qb->where('usr.manager = :m')->setParameter('m', $me);
        }

        $rows = $qb->getQuery()->getResult();
        return $this->jsonOk(array_map(fn(DailyReport $r) => $this->serialize($r), $rows));
    }

    private function serialize(DailyReport $r): array
    {
        return [
            'id' => $r->getId(),
            'day' => $r->getDay()->format('Y-m-d'),
            'content' => $r->getContent(),
            'user' => [
                'id' => $r->getUser()?->getId(),
                'fullName' => $r->getUser()?->getFullName(),
                'email' => $r->getUser()?->getEmail(),
            ],
            'createdAt' => $r->getCreatedAt()->format('c'),
            'updatedAt' => $r->getUpdatedAt()->format('c'),
        ];
    }
}

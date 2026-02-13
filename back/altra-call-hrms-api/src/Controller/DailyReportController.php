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

        #[Route('/api/daily-reports/my', methods:['GET'])]
    public function my(Request $r): JsonResponse {
        $u = $this->getCurrentUser($r);
        $pg = $this->parsePagination($r);

        if (!$pg['enabled']) {
            $items = $this->em->getRepository(DailyReport::class)->findBy(['user'=>$u], ['id'=>'DESC']);
            return $this->jsonOk(['items'=>array_map([$this,'serialize'], $items)]);
        }

        $qb = $this->em->createQueryBuilder()
            ->select('dr')
            ->from(DailyReport::class, 'dr')
            ->where('dr.user = :u')
            ->setParameter('u', $u)
            ->orderBy('dr.id', 'DESC')
            ->setFirstResult($pg['offset'])
            ->setMaxResults($pg['limit']);

        $items = $qb->getQuery()->getResult();

        $countQb = $this->em->createQueryBuilder()
            ->select('COUNT(dr2.id)')
            ->from(DailyReport::class, 'dr2')
            ->where('dr2.user = :u')
            ->setParameter('u', $u);

        $total = (int)$countQb->getQuery()->getSingleScalarResult();

        return $this->jsonOk([
            'items'=>array_map([$this,'serialize'], $items),
            'meta'=>[
                'page'=>$pg['page'],
                'limit'=>$pg['limit'],
                'total'=>$total,
                'pages'=>(int)ceil($total / max(1,$pg['limit'])),
            ]
        ]);
    }

        #[Route('/api/daily-reports', methods: ['POST'])]
    public function upsert(Request $request): JsonResponse
    {
        $user = $this->getCurrentUser($request);
        $data = json_decode((string)$request->getContent(), true) ?: [];

        // Backward compatible payload:
        // - legacy: {day, content}
        // - new UI: {date, tasks, hours, blockers, nextDayPlan}
        $dayStr = (string)($data['date'] ?? $data['day'] ?? '');
        if ($dayStr === '') {
            return $this->json(['error' => 'date_required'], 400);
        }
        $day = new \DateTimeImmutable($dayStr);

        $legacyContent = (string)($data['content'] ?? '');
        $tasks = isset($data['tasks']) ? (string)$data['tasks'] : '';
        $hours = array_key_exists('hours', $data) ? ($data['hours'] === null ? null : (float)$data['hours']) : null;
        $blockers = isset($data['blockers']) ? (string)$data['blockers'] : '';
        $next = isset($data['nextDayPlan']) ? (string)$data['nextDayPlan'] : '';

        if ($tasks === '' && $legacyContent === '') {
            return $this->json(['error' => 'tasks_required'], 400);
        }

        // Store structured data in JSON inside "content" column for simplicity.
        $content = $tasks !== ''
            ? json_encode([
                'tasks' => $tasks,
                'hours' => $hours,
                'blockers' => $blockers !== '' ? $blockers : null,
                'nextDayPlan' => $next !== '' ? $next : null,
              ], JSON_UNESCAPED_UNICODE)
            : $legacyContent;
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

        // Managers (ROLE_SUPERIOR) should see reports of their team.
        // Admins can also see their team; and can pass ?scope=all to see everything.
        $allowed = in_array('ROLE_SUPERIOR', $u->roles ?? [], true) || in_array('ROLE_ADMIN', $u->roles ?? [], true);
        if (!$allowed) return $this->json(['error'=>'forbidden'],403);

        $pg = $this->parsePagination($request);
        $scopeAll = in_array('ROLE_ADMIN', $u->roles ?? [], true) && ((string)$request->query->get('scope') === 'all');

        $qb = $this->em->createQueryBuilder()
            ->select('dr, eu')
            ->from(DailyReport::class, 'dr')
            ->leftJoin('dr.user', 'eu')->addSelect('eu')
            ->orderBy('dr.id', 'DESC');

        if (!$scopeAll) {
            // Team = employees whose manager OR manager2 is me
            $qb->andWhere('(eu.manager = :m OR eu.manager2 = :m)')
               ->setParameter('m', $me);
        }

        if ($pg['enabled']) {
            $qb->setFirstResult($pg['offset'])->setMaxResults($pg['limit']);
        }

        $rows = $qb->getQuery()->getResult();

        $countQb = $this->em->createQueryBuilder()
            ->select('COUNT(dr2.id)')
            ->from(DailyReport::class, 'dr2')
            ->leftJoin('dr2.user', 'eu2');

        if (!$scopeAll) {
            $countQb->where('(eu2.manager = :m OR eu2.manager2 = :m)')
                    ->setParameter('m', $me);
        }

        $total = (int)$countQb->getQuery()->getSingleScalarResult();

        return $this->jsonOk([
            'items' => array_map([$this,'serialize'], $rows),
            'meta' => [
                'page' => $pg['page'],
                'limit' => $pg['limit'],
                'total' => $total,
                'pages' => (int)ceil($total / max(1,$pg['limit'])),
            ]
        ]);
    }


    private function serialize(DailyReport $r): array
    {
        $raw = (string)($r->getContent() ?? '');
        $decoded = null;
        if ($raw !== '') {
            $tmp = json_decode($raw, true);
            if (is_array($tmp) && (isset($tmp['tasks']) || isset($tmp['hours']) || isset($tmp['blockers']) || isset($tmp['nextDayPlan']))) {
                $decoded = $tmp;
            }
        }

        return [
            'id' => $r->getId(),
            'date' => $r->getDay()->format('Y-m-d'),
            'tasks' => $decoded['tasks'] ?? ($raw ?: ''),
            'hours' => $decoded['hours'] ?? null,
            'blockers' => $decoded['blockers'] ?? null,
            'nextDayPlan' => $decoded['nextDayPlan'] ?? null,
            // keep legacy fields for compatibility
            'day' => $r->getDay()->format('Y-m-d'),
            'content' => $raw,
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

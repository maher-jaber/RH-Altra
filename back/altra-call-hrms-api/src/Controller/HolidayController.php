<?php

namespace App\Controller;

use App\Entity\Holiday;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class HolidayController extends ApiBase
{
    public function __construct(private EntityManagerInterface $em) {}

    private function requireAdmin(Request $request): void
    {
        $u = $this->requireUser($request);
        if (!in_array('ROLE_ADMIN', $u->roles ?? [], true)) {
            throw $this->createAccessDeniedException('Admin only');
        }
    }

    #[Route('/api/holidays', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $this->requireAdmin($request);
        $year = (int)($request->query->get('year') ?? date('Y'));
        if ($year < 1970 || $year > 2100) $year = (int)date('Y');

        $start = new \DateTimeImmutable($year . '-01-01');
        $end = new \DateTimeImmutable($year . '-12-31');

        $qb = $this->em->createQueryBuilder();
        $qb->select('h')
            ->from(Holiday::class, 'h')
            ->where('h.date BETWEEN :s AND :e')
            ->orderBy('h.date', 'ASC')
            ->setParameters(['s' => $start, 'e' => $end]);

        $items = $qb->getQuery()->getResult();

        return $this->jsonOk([
            'year' => $year,
            'items' => array_map(fn(Holiday $h) => [
                'id' => $h->getId(),
                'date' => $h->getDate()->format('Y-m-d'),
                'label' => $h->getLabel(),
            ], $items),
        ]);
    }

    #[Route('/api/holidays', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $this->requireAdmin($request);
        $data = json_decode((string)$request->getContent(), true) ?: [];
        $dateStr = (string)($data['date'] ?? '');
        $label = trim((string)($data['label'] ?? ''));

        if ($dateStr === '' || $label === '') {
            return $this->json(['error' => 'date_and_label_required'], 400);
        }
        try {
            $d = new \DateTimeImmutable($dateStr);
        } catch (\Throwable) {
            return $this->json(['error' => 'invalid_date'], 400);
        }

        $exists = $this->em->getRepository(Holiday::class)->findOneBy(['date' => $d]);
        if ($exists) {
            return $this->json(['error' => 'already_exists'], 409);
        }

        $h = new Holiday();
        $h->setDate($d)->setLabel($label);
        $this->em->persist($h);
        $this->em->flush();

        return $this->jsonOk([
            'id' => $h->getId(),
            'date' => $h->getDate()->format('Y-m-d'),
            'label' => $h->getLabel(),
        ]);
    }

    #[Route('/api/holidays/{id}', methods: ['PUT'])]
    public function update(Request $request, int $id): JsonResponse
    {
        $this->requireAdmin($request);
        /** @var Holiday|null $h */
        $h = $this->em->getRepository(Holiday::class)->find($id);
        if (!$h) return $this->json(['error' => 'not_found'], 404);

        $data = json_decode((string)$request->getContent(), true) ?: [];
        if (isset($data['date'])) {
            try {
                $d = new \DateTimeImmutable((string)$data['date']);
            } catch (\Throwable) {
                return $this->json(['error' => 'invalid_date'], 400);
            }
            // unique date
            $exists = $this->em->getRepository(Holiday::class)->findOneBy(['date' => $d]);
            if ($exists && $exists->getId() !== $h->getId()) {
                return $this->json(['error' => 'already_exists'], 409);
            }
            $h->setDate($d);
        }
        if (isset($data['label'])) {
            $label = trim((string)$data['label']);
            if ($label === '') return $this->json(['error' => 'label_required'], 400);
            $h->setLabel($label);
        }

        $this->em->flush();
        return $this->jsonOk([
            'id' => $h->getId(),
            'date' => $h->getDate()->format('Y-m-d'),
            'label' => $h->getLabel(),
        ]);
    }

    #[Route('/api/holidays/{id}', methods: ['DELETE'])]
    public function delete(Request $request, int $id): JsonResponse
    {
        $this->requireAdmin($request);
        /** @var Holiday|null $h */
        $h = $this->em->getRepository(Holiday::class)->find($id);
        if (!$h) return $this->json(['error' => 'not_found'], 404);

        $this->em->remove($h);
        $this->em->flush();
        return $this->jsonOk(['ok' => true]);
    }

    #[Route('/api/holidays/seed', methods: ['POST'])]
    public function seed(Request $request): JsonResponse
    {
        $this->requireAdmin($request);
        $data = json_decode((string)$request->getContent(), true) ?: [];
        $year = (int)($data['year'] ?? date('Y'));
        if ($year < 1970 || $year > 2100) $year = (int)date('Y');

        // Default Tunisia (fixed-date) holidays + commonly used dates in many companies.
        // Movable Islamic holidays can be added via UI (because dates change each year).
        $defaults = [
            ['01-01','Nouvel an'],
            ['03-20','Fête de l\'Indépendance'],
            ['04-09','Journée des Martyrs'],
            ['05-01','Fête du Travail'],
            ['07-25','Fête de la République'],
            ['08-13','Fête de la Femme'],
            ['10-15','Fête de l\'Évacuation'],
            ['12-17','Fête de la Révolution'],
        ];

        $created = 0;
        foreach ($defaults as [$md,$label]) {
            $d = new \DateTimeImmutable($year.'-'.$md);
            $exists = $this->em->getRepository(Holiday::class)->findOneBy(['date'=>$d]);
            if($exists) continue;
            $h = new Holiday();
            $h->setDate($d)->setLabel($label);
            $this->em->persist($h);
            $created++;
        }
        $this->em->flush();

        return $this->jsonOk(['year'=>$year, 'created'=>$created]);
    }
}

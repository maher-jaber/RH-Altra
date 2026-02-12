<?php
namespace App\Controller;

use App\Entity\Department;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class AdminDepartmentController extends ApiBase {

    private function requireAdmin(Request $request): void
    {
        $u = $this->requireUser($request);
        if (!in_array('ROLE_ADMIN', $u->roles ?? [], true)) {
            throw $this->createAccessDeniedException('Admin only');
        }
    }


    #[Route('/api/admin/departments', methods:['GET'])]
    public function list(Request $request, EntityManagerInterface $em): JsonResponse {
        $this->requireAdmin($request);

        $pg = $this->parsePagination($request);
        $q = trim((string)$request->query->get('q', ''));

        if (!$pg['enabled']) {
            $items = array_map(fn(Department $d)=>['id'=>(string)$d->getId(),'name'=>$d->getName()],
                $em->getRepository(Department::class)->findBy([], ['id' => 'DESC'])
            );
            return $this->jsonOk(['items'=>$items]);
        }

        $qb = $em->createQueryBuilder()
            ->select('d')
            ->from(Department::class, 'd')
            ->orderBy('d.id', 'DESC')
            ->setFirstResult($pg['offset'])
            ->setMaxResults($pg['limit']);

        if ($q !== '') {
            $qb->andWhere('LOWER(d.name) LIKE :q')
               ->setParameter('q', '%'.mb_strtolower($q).'%');
        }

        $items = $qb->getQuery()->getResult();

        $countQb = $em->createQueryBuilder()
            ->select('COUNT(d2.id)')
            ->from(Department::class, 'd2');

        if ($q !== '') {
            $countQb->where('LOWER(d2.name) LIKE :q')
                    ->setParameter('q', '%'.mb_strtolower($q).'%');
        }

        $total = (int)$countQb->getQuery()->getSingleScalarResult();

        return $this->jsonOk([
            'items' => array_map(fn(Department $d)=>['id'=>(string)$d->getId(),'name'=>$d->getName()], $items),
            'meta' => [
                'page' => $pg['page'],
                'limit' => $pg['limit'],
                'total' => $total,
                'pages' => (int)ceil($total / max(1,$pg['limit'])),
            ]
        ]);
    }

        #[Route('/api/admin/departments', methods:['POST'])]#[Route('/api/admin/departments', methods:['POST'])]
    public function create(Request $r, EntityManagerInterface $em): JsonResponse {
        $this->requireAdmin($r);

        $data=json_decode($r->getContent(),true);
        $d=new Department();
        $d->setName($data['name']);
        $em->persist($d); $em->flush();
        return $this->jsonOk(['id'=>$d->getId(),'name'=>$d->getName()],201);
    }

    #[Route('/api/admin/departments/{id}', methods:['PUT'])]
    public function update(string $id, Request $r, EntityManagerInterface $em): JsonResponse {
        $this->requireAdmin($r);
        $d = $em->getRepository(Department::class)->find($id);
        if (!$d) return $this->jsonError('not_found', 'Department not found', 404);
        $data = json_decode($r->getContent(), true) ?: [];
        if (isset($data['name'])) {
            $d->setName((string)$data['name']);
        }
        $em->flush();
        return $this->jsonOk(['id'=>$d->getId(),'name'=>$d->getName()]);
    }

    #[Route('/api/admin/departments/{id}', methods:['DELETE'])]
    public function delete(string $id, Request $r, EntityManagerInterface $em): JsonResponse {
        $this->requireAdmin($r);
        $d = $em->getRepository(Department::class)->find($id);
        if (!$d) return $this->jsonError('not_found', 'Department not found', 404);
        $em->remove($d);
        $em->flush();
        return $this->jsonOk(['deleted'=>true]);
    }
}

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

        $items = array_map(fn($d)=>['id'=>$d->getId(),'name'=>$d->getName()], $em->getRepository(Department::class)->findAll());
        return $this->jsonOk(['items'=>$items]);
    }

    #[Route('/api/admin/departments', methods:['POST'])]
    public function create(Request $r, EntityManagerInterface $em): JsonResponse {
        $this->requireAdmin($r);

        $data=json_decode($r->getContent(),true);
        $d=new Department();
        $d->setName($data['name']);
        $em->persist($d); $em->flush();
        return $this->jsonOk(['id'=>$d->getId(),'name'=>$d->getName()],201);
    }
}

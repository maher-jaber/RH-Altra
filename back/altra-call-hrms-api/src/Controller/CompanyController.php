<?php
namespace App\Controller;

use App\Entity\Company;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

class CompanyController extends ApiBase
{
    #[Route('/api/admin/companies', methods:['GET'])]
    public function list(Request $r, EntityManagerInterface $em): JsonResponse
    {
        $this->requireRole($r,'ROLE_ADMIN');
        $items = $em->getRepository(Company::class)->findBy([],['id'=>'ASC']);
        return $this->jsonOk(['items'=>array_map(fn(Company $c)=>['id'=>(string)$c->getId(),'name'=>$c->getName(),'code'=>$c->getCode()],$items)]);
    }

    #[Route('/api/admin/companies', methods:['POST'])]
    public function create(Request $r, EntityManagerInterface $em): JsonResponse
    {
        $this->requireRole($r,'ROLE_ADMIN');
        $d = json_decode((string)$r->getContent(), true) ?: [];
        $c = new Company();
        $c->setName((string)$d['name'])->setCode((string)$d['code']);
        $em->persist($c); $em->flush();
        return $this->jsonOk(['id'=>(string)$c->getId()],201);
    }
}

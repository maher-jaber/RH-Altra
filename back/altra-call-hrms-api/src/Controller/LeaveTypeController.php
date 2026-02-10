<?php
namespace App\Controller;

use App\Entity\LeaveType;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class LeaveTypeController extends ApiBase
{
    #[Route('/api/leave-types', methods: ['GET'])]
    public function list(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $this->requireUser($request);
        $types = $em->getRepository(LeaveType::class)->findBy([], ['id' => 'ASC']);
        $items = array_map(fn(LeaveType $t) => [
            'id' => (string)$t->getId(),
            'code' => $t->getCode(),
            'label' => $t->getLabel(),
            'annualAllowance' => $t->getAnnualAllowance(),
            'requiresCertificate' => $t->getRequiresCertificate(),
        ], $types);

        return $this->jsonOk(['items' => $items]);
    }

    #[Route('/api/admin/leave-types/bootstrap', methods: ['POST'])]
    public function bootstrap(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $u = $this->requireUser($request);
        if (!in_array('ROLE_ADMIN', $u->roles ?? [], true)) {
            throw $this->createAccessDeniedException('Admin only');
        }

        $defaults = [
            ['code' => 'ANNUAL', 'label' => 'Congé annuel', 'annualAllowance' => 18, 'requiresCertificate' => false],
            ['code' => 'SICK', 'label' => 'Congé maladie', 'annualAllowance' => 10, 'requiresCertificate' => true],
            ['code' => 'SPECIAL', 'label' => 'Congé exceptionnel', 'annualAllowance' => 5, 'requiresCertificate' => false],
            ['code' => 'UNPAID', 'label' => 'Sans solde', 'annualAllowance' => 0, 'requiresCertificate' => false],
        ];

        foreach ($defaults as $d) {
            $exists = $em->getRepository(LeaveType::class)->findOneBy(['code' => $d['code']]);
            if ($exists) continue;
            $t = new LeaveType();
            $t->setCode($d['code'])->setLabel($d['label'])->setAnnualAllowance((float)$d['annualAllowance'])->setRequiresCertificate((bool)$d['requiresCertificate']);
            $em->persist($t);
        }
        $em->flush();

        return $this->jsonOk(['ok' => true]);
    }
}

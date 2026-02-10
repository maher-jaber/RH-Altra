<?php
namespace App\Controller;

use App\Entity\LeaveRequest;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class LeaveWorkflowController extends ApiBase {

    #[Route('/api/leaves/pending/manager', methods:['GET'])]
    public function pendingManager(Request $r, EntityManagerInterface $em): JsonResponse {
        $u=$this->requireUser($r);
        $items=$em->getRepository(LeaveRequest::class)->findBy(['status'=>LeaveRequest::STATUS_SUBMITTED,'manager'=>$u]);
        return $this->jsonOk(['items'=>$items]);
    }

    #[Route('/api/leaves/{id}/manager-approve', methods:['POST'])]
    public function managerApprove(string $id, Request $r, EntityManagerInterface $em): JsonResponse {
        $u=$this->requireUser($r);
        $lr=$em->getRepository(LeaveRequest::class)->find($id);
        if(!$lr) return $this->json(['error'=>'not_found'],404);
        if($lr->getManager()?->getId()!==$u->getId()) return $this->json(['error'=>'forbidden'],403);
        $data = json_decode((string)$r->getContent(), true) ?: [];
        if (isset($data['comment'])) { $lr->setManagerComment((string)$data['comment']); }
        $lr->setStatus(LeaveRequest::STATUS_MANAGER_APPROVED);
        $em->flush();
        return $this->jsonOk(['status'=>$lr->getStatus()]);
    }

    #[Route('/api/leaves/pending/hr', methods:['GET'])]
    public function pendingHr(Request $r, EntityManagerInterface $em): JsonResponse {
        $this->requireRole($r,'ROLE_ADMIN');
        $items=$em->getRepository(LeaveRequest::class)->findBy(['status'=>LeaveRequest::STATUS_MANAGER_APPROVED]);
        return $this->jsonOk(['items'=>$items]);
    }

    #[Route('/api/leaves/{id}/hr-approve', methods:['POST'])]
    public function hrApprove(string $id, Request $r, EntityManagerInterface $em): JsonResponse {
        $this->requireRole($r,'ROLE_ADMIN');
        $lr=$em->getRepository(LeaveRequest::class)->find($id);
        if(!$lr) return $this->json(['error'=>'not_found'],404);
        $data = json_decode((string)$r->getContent(), true) ?: [];
        if (isset($data['comment'])) { $lr->setHrComment((string)$data['comment']); }
        $lr->setStatus(LeaveRequest::STATUS_HR_APPROVED);
        $em->flush();
        return $this->jsonOk(['status'=>$lr->getStatus()]);
    }

    #[Route('/api/leaves/{id}/reject', methods:['POST'])]
    public function reject(string $id, Request $r, EntityManagerInterface $em): JsonResponse {
        $this->requireUser($r);
        $lr=$em->getRepository(LeaveRequest::class)->find($id);
        if(!$lr) return $this->json(['error'=>'not_found'],404);
        $data = json_decode((string)$r->getContent(), true) ?: [];
        // store comment depending on who rejects
        $u = $this->requireUser($r);
        if (in_array('ROLE_ADMIN', $u->roles ?? [], true)) {
            if (isset($data['comment'])) { $lr->setHrComment((string)$data['comment']); }
        } else {
            if (isset($data['comment'])) { $lr->setManagerComment((string)$data['comment']); }
        }
        $lr->setStatus(LeaveRequest::STATUS_REJECTED);
        $em->flush();
        return $this->jsonOk(['status'=>$lr->getStatus()]);
    }
}

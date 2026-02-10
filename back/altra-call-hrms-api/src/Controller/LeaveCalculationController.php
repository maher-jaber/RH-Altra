<?php
namespace App\Controller;

use App\Service\WorkingDaysService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class LeaveCalculationController extends ApiBase {

    #[Route('/api/leaves/calculate', methods:['POST'])]
    public function calculate(Request $r, WorkingDaysService $svc): JsonResponse {
        $this->requireUser($r);
        $data = json_decode($r->getContent(), true);
        $start = new \DateTimeImmutable($data['startDate']);
        $end = new \DateTimeImmutable($data['endDate']);
        $days = $svc->countWorkingDays($start, $end);
        return $this->jsonOk(['workingDays'=>$days]);
    }
}

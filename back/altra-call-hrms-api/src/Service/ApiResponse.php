<?php

namespace App\Service;

use App\Entity\LeaveRequest;
use App\Entity\Notification;

class ApiResponse
{
    public static function leave(LeaveRequest $l): array
    {
        $t = $l->getType();
        return [
            'id' => $l->getId(),
            // Always return a JSON-friendly payload (Doctrine proxies can't be normalized safely).
            'type' => $t ? [
                'id' => $t->getId(),
                'code' => $t->getCode(),
                'label' => $t->getLabel(),
                'requiresCertificate' => $t->getRequiresCertificate(),
                'annualAllowance' => $t->getAnnualAllowance(),
            ] : null,
            'typeCode' => $l->getTypeCode(),
            'startDate' => $l->getStartDate()->format('Y-m-d'),
            'endDate' => $l->getEndDate()->format('Y-m-d'),
            'halfDay' => $l->getHalfDay(),
            'reason' => $l->getReason(),
            'status' => $l->getStatus(),
            'createdAt' => $l->getCreatedAt()->format(DATE_ATOM),
        ];
    }

    public static function notif(Notification $n): array
    {
        return [
            'id' => $n->getId(),
            'title' => $n->getTitle(),
            'message' => $n->getMessage(),
            'createdAt' => $n->getCreatedAt()->format(DATE_ATOM),
            'readAt' => $n->getReadAt()?->format(DATE_ATOM),
        ];
    }
}

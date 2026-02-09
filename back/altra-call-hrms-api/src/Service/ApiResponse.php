<?php

namespace App\Service;

use App\Entity\LeaveRequest;
use App\Entity\Notification;

class ApiResponse
{
    public static function leave(LeaveRequest $l): array
    {
        return [
            'id' => $l->getId(),
            'type' => $l->getType(),
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

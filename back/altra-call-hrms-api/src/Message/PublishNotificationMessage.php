<?php

namespace App\Message;

class PublishNotificationMessage
{
    public function __construct(
        public readonly string $recipientApiKey,
        public readonly string $title,
        public readonly string $body,
        public readonly string $type,
        public readonly string $notificationId,
        public readonly string $createdAtIso,
        public readonly ?string $actionUrl = null,
        public readonly ?array $payload = null,
        public readonly bool $isRead = false
    ) {}
}

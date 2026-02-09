<?php

namespace App\Message;

class PublishNotificationMessage
{
    public function __construct(
        public readonly string $recipientApiKey,
        public readonly string $title,
        public readonly string $message,
        public readonly string $notificationId,
        public readonly string $createdAtIso
    ) {}
}

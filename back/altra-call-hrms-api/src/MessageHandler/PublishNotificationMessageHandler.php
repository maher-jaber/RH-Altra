<?php

namespace App\MessageHandler;

use App\Message\PublishNotificationMessage;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Update;

#[AsMessageHandler]
class PublishNotificationMessageHandler
{
    public function __construct(private HubInterface $hub) {}

    public function __invoke(PublishNotificationMessage $msg): void
    {
        $topic = '/users/'.rawurlencode($msg->recipientApiKey).'/notifications';
        $data = json_encode([
            'id' => $msg->notificationId,
            'title' => $msg->title,
            'message' => $msg->message,
            'createdAt' => $msg->createdAtIso,
            'readAt' => null
        ], JSON_UNESCAPED_UNICODE);

        $this->hub->publish(new Update($topic, $data));
    }
}

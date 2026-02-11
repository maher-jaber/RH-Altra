<?php

namespace App\MessageHandler;

use App\Message\PublishNotificationMessage;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Update;
use Psr\Log\LoggerInterface;

#[AsMessageHandler]
class PublishNotificationMessageHandler
{
    public function __construct(
        private HubInterface $hub,
        private LoggerInterface $logger,
    ) {}

    public function __invoke(PublishNotificationMessage $msg): void
    {
        $topic = '/users/'.rawurlencode($msg->recipientApiKey).'/notifications';
        $data = json_encode([
            'id' => $msg->notificationId,
            'title' => $msg->title,
            'body' => $msg->body,
            'type' => $msg->type,
            'isRead' => $msg->isRead
        ], JSON_UNESCAPED_UNICODE);

        // Mercure is "best-effort" for the MVP. If the hub is misconfigured or down,
        // do NOT fail the original business action (advance/leave request creation).
        try {
            $this->hub->publish(new Update($topic, $data));
        } catch (\Throwable $e) {
            $this->logger->warning('Mercure publish failed', [
                'topic' => $topic,
                'exception' => $e->getMessage(),
            ]);
        }
    }
}

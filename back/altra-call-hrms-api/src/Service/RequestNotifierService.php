<?php

namespace App\Service;

use App\Entity\Notification;
use App\Entity\User;
use App\Message\PublishNotificationMessage;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Messenger\MessageBusInterface;

/**
 * Unified in-app + email notifications for business requests.
 *
 * Rules:
 * - Manager(s) reçoit/reçoivent, utilisateur reçoit, selon statut.
 * - Best-effort: notification/email must NOT fail the business action.
 */
class RequestNotifierService
{
    public function __construct(
        private EntityManagerInterface $em,
        private MessageBusInterface $bus,
        private LeaveNotificationService $mailer,
        private string $frontendUrl = ''
    ) {
        $this->frontendUrl = $this->frontendUrl ?: (string)($_ENV['FRONTEND_URL'] ?? $_SERVER['FRONTEND_URL'] ?? 'http://localhost:4200');
    }

    /** @return User[] */
    public function hrUsers(): array
    {
        // RH removed.
        return [];
    }

    /** @param User[] $recipients */
    public function notify(array $recipients, string $type, string $title, string $body, ?string $actionUrl = null, ?array $payload = null, ?string $emailSubject = null, ?string $emailHtml = null): void
    {
        foreach ($recipients as $u) {
            if (!$u instanceof User) continue;

            // In-app notification (persist + Mercure)
            try {
                $n = new Notification();
                $n->setUser($u);
                $n->setType($type);
                $n->setTitle($title);
                $n->setBody($body);
                if ($actionUrl) $n->setActionUrl($actionUrl);
                if ($payload) $n->setPayload($payload);

                $this->em->persist($n);
                $this->em->flush();

                $this->bus->dispatch(new PublishNotificationMessage(
                    recipientApiKey: $u->getApiKey(),
                    title: $n->getTitle(),
                    body: (string)$n->getBody(),
                    type: $n->getType(),
                    notificationId: (string)$n->getId(),
                    createdAtIso: $n->getCreatedAt()->format(DATE_ATOM),
                    actionUrl: $n->getActionUrl(),
                    payload: $n->getPayload()
                ));
            } catch (\Throwable $e) {
                // ignore
            }

            // Email (best-effort)
            try {
                if ($emailSubject && $emailHtml) {
                    $this->mailer->notify((string)$u->getEmail(), $emailSubject, $emailHtml);
                }
            } catch (\Throwable $e) {
                // ignore
            }
        }
    }

    public function simpleEmailHtml(string $title, array $rows, ?string $ctaPath = null, string $ctaLabel = 'Ouvrir'): string
    {
        $ctaUrl = $ctaPath ? (rtrim($this->frontendUrl, '/') . $ctaPath) : null;
        return $this->mailer->renderEmail(
            title: $title,
            intro: 'Détails de la demande :',
            rows: $rows,
            ctaUrl: $ctaUrl,
            ctaLabel: $ctaLabel
        );
    }
}

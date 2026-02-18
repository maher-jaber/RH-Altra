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
        $h = fn(?string $s) => htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $table = '<table style="border-collapse:collapse;width:100%;max-width:680px">';
        foreach ($rows as [$k,$v]) {
            $table .= '<tr><td style="padding:8px 10px;border:1px solid #eee;background:#fafafa;width:180px"><b>'.$h($k).'</b></td><td style="padding:8px 10px;border:1px solid #eee">'.$h($v).'</td></tr>';
        }
        $table .= '</table>';

        $btn = '';
        if ($ctaPath) {
            $url = rtrim($this->frontendUrl, '/') . $ctaPath;
            $btn = '<p style="margin:20px 0"><a href="'.$h($url).'" style="display:inline-block;background:#0d6efd;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">'.$h($ctaLabel).'</a></p>';
        }

        return '<div style="font-family:Arial,sans-serif;line-height:1.4">'
            . '<h2 style="margin:0 0 12px 0">'.$h($title).'</h2>'
            . $table
            . $btn
            . '<p style="opacity:.7;font-size:12px;margin-top:18px">ALTRA HRMS · Notification automatique</p>'
            . '</div>';
    }
}

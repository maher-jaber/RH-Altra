<?php

namespace App\Service;

use App\Entity\LeaveRequest;
use Psr\Log\LoggerInterface;

/**
 * Lightweight notification mailer.
 *
 * Why: Some dev stacks ship without symfony/mailer installed (stale composer.lock).
 * To avoid hard-crashes (MailerInterface class not found), we use a tiny SMTP sender
 * compatible with Mailhog (no auth, no TLS).
 */
class LeaveNotificationService
{
    public function __construct(
        private SlackNotifier $slack,
        private WhatsAppNotifier $wa,
        private LoggerInterface $logger,
        private string $mailerDsn = ''
    ) {
        $this->mailerDsn = $this->mailerDsn ?: (string) ($_ENV['MAILER_DSN'] ?? $_SERVER['MAILER_DSN'] ?? 'smtp://mailhog:1025');
    }

    public function notify(string $to, string $subject, string $htmlContent): void
    {
        // Best-effort: never crash the API for an email issue.
        try {
            $this->sendSmtp($to, $subject, $htmlContent);
        } catch (\Throwable $e) {
            $this->logger->warning('[mailer] failed to send email', [
                'to' => $to,
                'subject' => $subject,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function onSubmit(LeaveRequest $lr): void
    {
        $manager = $lr->getManager();
        if (!$manager) {
            return;
        }

        $this->notify(
            (string) $manager->getEmail(),
            'Nouvelle demande de congé',
            '<p>Une nouvelle demande de congé vous attend.</p>'
        );
    }

    public function onManagerDecision(LeaveRequest $lr): void
    {
        $user = $lr->getUser();
        if (!$user) {
            return;
        }

        $this->notify(
            (string) $user->getEmail(),
            'Décision manager sur votre congé',
            '<p>Votre manager a traité votre demande.</p>'
        );
    }

    public function onHrDecision(LeaveRequest $lr): void
    {
        $user = $lr->getUser();
        if (!$user) {
            return;
        }

        $this->notify(
            (string) $user->getEmail(),
            'Décision RH sur votre congé',
            '<p>La RH a finalisé votre demande.</p>'
        );
    }

    /**
     * Minimal SMTP client (RFC-2821-ish) for local/dev Mailhog.
     * Supports: smtp://host:port only (no auth, no TLS).
     */
    private function sendSmtp(string $to, string $subject, string $htmlContent): void
    {
        $dsn = $this->mailerDsn;
        $parts = parse_url($dsn);
        $host = $parts['host'] ?? 'mailhog';
        $port = (int) ($parts['port'] ?? 1025);

        $from = 'hr@altra-call.com';
        $to = trim($to);

        $fp = @fsockopen($host, $port, $errno, $errstr, 5);
        if (!$fp) {
            throw new \RuntimeException("SMTP connect failed: {$errstr} ({$errno})");
        }
        stream_set_timeout($fp, 5);

        $expect = function (array $codes) use ($fp): string {
            $line = '';
            while (($l = fgets($fp, 515)) !== false) {
                $line .= $l;
                // multi-line responses have a hyphen after the code, final line has a space
                if (preg_match('/^\d{3} /', $l)) {
                    break;
                }
            }
            $code = (int) substr(trim($line), 0, 3);
            if (!in_array($code, $codes, true)) {
                throw new \RuntimeException('Unexpected SMTP response: ' . trim($line));
            }
            return $line;
        };

        $send = function (string $cmd) use ($fp): void {
            fwrite($fp, $cmd . "\r\n");
        };

        $expect([220]);
        $send('EHLO altra-hrms');
        $expect([250]);

        $send('MAIL FROM:<' . $from . '>');
        $expect([250]);

        $send('RCPT TO:<' . $to . '>');
        $expect([250, 251]);

        $send('DATA');
        $expect([354]);

        $headers = [
            'From: ' . $from,
            'To: ' . $to,
            'Subject: ' . $subject,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
        ];

        $data = implode("\r\n", $headers) . "\r\n\r\n" . $htmlContent . "\r\n";
        // End of DATA with <CRLF>.<CRLF>
        fwrite($fp, $data . "\r\n.\r\n");
        $expect([250]);

        $send('QUIT');
        fclose($fp);
    }
}

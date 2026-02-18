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
        private string $mailerDsn = '',
        private string $frontendUrl = ''
    ) {
        $this->mailerDsn = $this->mailerDsn ?: (string) ($_ENV['MAILER_DSN'] ?? $_SERVER['MAILER_DSN'] ?? 'smtp://mailhog:1025');
        $this->frontendUrl = $this->frontendUrl ?: (string) ($_ENV['FRONTEND_URL'] ?? $_SERVER['FRONTEND_URL'] ?? 'http://localhost:4200');
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


    private function h(?string $s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

    private function button(string $url, string $label): string
    {
        $u = $this->h($url);
        $l = $this->h($label);
        return '<p style="margin:20px 0"><a href="'.$u.'" style="display:inline-block;background:#0d6efd;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">'.$l.'</a></p>';
    }

    private function table(array $rows): string
    {
        $out = '<table style="border-collapse:collapse;width:100%;max-width:680px">';
        foreach ($rows as [$k,$v]) {
            $out .= '<tr><td style="padding:8px 10px;border:1px solid #eee;background:#fafafa;width:180px"><b>'.$this->h($k).'</b></td><td style="padding:8px 10px;border:1px solid #eee">'.$this->h($v).'</td></tr>';
        }
        $out .= '</table>';
        return $out;
    }

    private function leaveEmailHtml(LeaveRequest $lr, string $title, string $intro): string
    {
        $emp = $lr->getUser();
        $mgr = $lr->getManager();
        $type = $lr->getType();

        $url = rtrim($this->frontendUrl, '/') . '/leaves/detail/' . $lr->getId();

        $rows = [
            ['Employé', $emp ? ($emp->getFullName() ?: $emp->getEmail()) : '—'],
            ['Type', $type ? ($type->getLabel() ?: $type->getCode()) : '—'],
            ['Du', $lr->getStartDate()?->format('Y-m-d') ?: '—'],
            ['Au', $lr->getEndDate()?->format('Y-m-d') ?: '—'],
            ['Jours', (string)($lr->getDaysCount() ?? 0)],
            ['Statut', (string)$lr->getStatus()],
        ];

        if ($mgr) $rows[] = ['Manager', $mgr->getFullName() ?: $mgr->getEmail()];
        if ($lr->getNote()) $rows[] = ['Note', $lr->getNote()];
        if (method_exists($lr, 'getManagerComment') && $lr->getManagerComment()) $rows[] = ['Commentaire manager', $lr->getManagerComment()];
        if (method_exists($lr, 'getHrComment') && $lr->getHrComment()) $rows[] = ['Commentaire RH', $lr->getHrComment()];

        return '<div style="font-family:Arial,sans-serif;line-height:1.4">'
            . '<h2 style="margin:0 0 12px 0">'.$this->h($title).'</h2>'
            . '<p style="margin:0 0 12px 0">'.$this->h($intro).'</p>'
            . $this->table($rows)
            . $this->button($url, 'Ouvrir la demande')
            . '<p style="opacity:.7;font-size:12px;margin-top:18px">ALTRA HRMS · Notification automatique</p>'
            . '</div>';
    }



    public function onEmployeeSubmit(LeaveRequest $lr): void
    {
        $user = $lr->getUser();
        if (!$user) {
            return;
        }

        $this->notify((string) $user->getEmail(), 'Congé · Demande envoyée', $this->leaveEmailHtml($lr, 'Demande de congé envoyée', 'Votre demande a été envoyée. Prochaine étape : validation du manager.'));
    }

    public function onSubmit(LeaveRequest $lr): void
    {
        $manager = $lr->getManager();
        if (!$manager) {
            return;
        }

        $this->notify((string) $manager->getEmail(), 'Nouvelle demande de congé', $this->leaveEmailHtml($lr, 'Nouvelle demande de congé', 'Une nouvelle demande est en attente de votre validation.'));
    }

    public function onManagerDecision(LeaveRequest $lr): void
    {
        $user = $lr->getUser();
        if (!$user) {
            return;
        }

        $this->notify((string) $user->getEmail(), 'Décision manager sur votre congé', $this->leaveEmailHtml($lr, 'Décision manager', 'Votre manager a traité votre demande.'));
    }

    public function onHrDecision(LeaveRequest $lr): void
    {
        $user = $lr->getUser();
        if (!$user) {
            return;
        }

        $this->notify((string) $user->getEmail(), 'Décision RH sur votre congé', $this->leaveEmailHtml($lr, 'Décision RH', 'La RH a finalisé votre demande.'));
    }

        /**
     * Minimal SMTP client for production.
     *
     * Supports:
     * - smtp://user:pass@host:587?encryption=tls   (STARTTLS + AUTH)
     * - smtps://user:pass@host:465                (TLS implicit + AUTH)
     * - smtp://host:25                           (no TLS, no auth)
     *
     * Notes:
     * - Best-effort: errors are caught by caller (notify()).
     * - We avoid external deps (symfony/mailer) to keep the image light.
     */
    private function sendSmtp(string $to, string $subject, string $htmlContent): void
    {
        $dsn = (string)$this->mailerDsn;
        if ($dsn === '' || $dsn === 'null://null') {
            return; // disabled
        }

        $parts = parse_url($dsn);
        if (!$parts || !isset($parts['host'])) {
            throw new \RuntimeException('Invalid MAILER_DSN');
        }

        $scheme = strtolower((string)($parts['scheme'] ?? 'smtp'));
        $host   = (string)$parts['host'];
        $port   = (int)($parts['port'] ?? (($scheme === 'smtps') ? 465 : 587));
        $user   = isset($parts['user']) ? rawurldecode((string)$parts['user']) : null;
        $pass   = isset($parts['pass']) ? rawurldecode((string)$parts['pass']) : null;

        parse_str((string)($parts['query'] ?? ''), $q);
        $enc = strtolower((string)($q['encryption'] ?? '')); // tls => STARTTLS

        $from = (string)($_ENV['MAIL_FROM'] ?? $_SERVER['MAIL_FROM'] ?? 'hr@altra-call.com');
        $fromName = (string)($_ENV['MAIL_FROM_NAME'] ?? $_SERVER['MAIL_FROM_NAME'] ?? 'ALTRA HRMS');
        $fromHeader = $fromName !== '' ? sprintf('"%s" <%s>', addcslashes($fromName, '"\\'), $from) : $from;

        $to = trim($to);

        $remote = ($scheme === 'smtps') ? "ssl://{$host}:{$port}" : "{$host}:{$port}";
        $fp = @stream_socket_client($remote, $errno, $errstr, 8, STREAM_CLIENT_CONNECT);
        if (!$fp) {
            throw new \RuntimeException("SMTP connect failed: {$errstr} ({$errno})");
        }
        stream_set_timeout($fp, 8);

        $readResponse = function (): string {
            $out = '';
            while (($l = fgets($GLOBALS['__smtp_fp'], 515)) !== false) {
                $out .= $l;
                if (preg_match('/^\d{3} /', $l)) break;
            }
            return $out;
        };

        // Use a global handle inside closure without PHP 8.1 readonly issues in anonymous functions.
        $GLOBALS['__smtp_fp'] = $fp;

        $expect = function (array $codes) use ($readResponse): string {
            $resp = $readResponse();
            $code = (int)substr(trim($resp), 0, 3);
            if (!in_array($code, $codes, true)) {
                throw new \RuntimeException('Unexpected SMTP response: ' . trim($resp));
            }
            return $resp;
        };

        $send = function (string $cmd) use ($fp): void {
            fwrite($fp, $cmd . "\r\n");
        };

        $expect([220]);

        $ehlo = function () use ($send, $expect): void {
            $send('EHLO altra-hrms');
            $expect([250]);
        };

        $ehlo();

        // STARTTLS
        $wantsStartTls = ($scheme === 'smtp' && $enc === 'tls');
        if ($wantsStartTls) {
            $send('STARTTLS');
            $expect([220]);

            $cryptoOk = @stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            if (!$cryptoOk) {
                throw new \RuntimeException('STARTTLS failed (crypto negotiation)');
            }
            // EHLO again after TLS
            $ehlo();
        }

        // AUTH (optional)
        if ($user !== null && $user !== '') {
            // Prefer AUTH LOGIN (widely supported)
            $send('AUTH LOGIN');
            $expect([334]);
            $send(base64_encode($user));
            $expect([334]);
            $send(base64_encode((string)$pass));
            $expect([235]);
        }

        $send('MAIL FROM:<' . $from . '>');
        $expect([250]);

        $send('RCPT TO:<' . $to . '>');
        $expect([250, 251]);

        $send('DATA');
        $expect([354]);

        $headers = [
            'From: ' . $fromHeader,
            'To: ' . $to,
            'Subject: ' . $subject,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
        ];

        $data = implode("\r\n", $headers) . "\r\n\r\n" . $htmlContent . "\r\n";
        fwrite($fp, $data . "\r\n.\r\n");
        $expect([250]);

        $send('QUIT');
        fclose($fp);
        unset($GLOBALS['__smtp_fp']);
    }
}

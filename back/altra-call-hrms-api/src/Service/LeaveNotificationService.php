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
        private string $frontendUrl = '',
        private string $projectDir = ''
    ) {
        $this->mailerDsn = $this->mailerDsn ?: (string) ($_ENV['MAILER_DSN'] ?? $_SERVER['MAILER_DSN'] ?? 'smtp://mailhog:1025');
        $this->frontendUrl = $this->frontendUrl ?: (string) ($_ENV['FRONTEND_URL'] ?? $_SERVER['FRONTEND_URL'] ?? 'http://localhost:4200');
        $this->projectDir = $this->projectDir ?: (string) ($_ENV['PROJECT_DIR'] ?? $_SERVER['PROJECT_DIR'] ?? '');
    }

    /** @param array<int,array{path:string, name?:string, mime?:string}> $attachments */
    public function notify(string $to, string $subject, string $htmlContent, array $attachments = []): void
    {
        // Best-effort: never crash the API for an email issue.
        try {
            $this->sendSmtp($to, $subject, $htmlContent, $attachments);
        } catch (\Throwable $e) {
            $this->logger->warning('[mailer] failed to send email', [
                'to' => $to,
                'subject' => $subject,
                'error' => $e->getMessage(),
            ]);
        }
    }


    private function h(?string $s): string
    {
        return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private function brandName(): string
    {
        return (string)($_ENV['APP_BRAND'] ?? $_SERVER['APP_BRAND'] ?? 'Altra-RH');
    }

    private function logoUrl(): string
    {
        // Fallback (external) URL if inline logo is not available.
        return rtrim($this->frontendUrl, '/') . '/assets/altracall-logo.png';
    }

    private function findLogoPath(): ?string
    {
        // Prefer back/public path so API-only deployments still embed the logo.
        $candidates = [
            // If PROJECT_DIR points to repo root
            $this->projectDir !== '' ? rtrim($this->projectDir, DIRECTORY_SEPARATOR) . '/back/altra-call-hrms-api/public/images/logo_altra.png' : null,
            $this->projectDir !== '' ? rtrim($this->projectDir, DIRECTORY_SEPARATOR) . '/public/images/logo_altra.png' : null,
    
            // Relative to the API package
            dirname(__DIR__, 3) . '/public/images/logo_altra.png', // /src/Service -> /public
            dirname(__DIR__, 5) . '/back/altra-call-hrms-api/public/images/logo_altra.png',
        ];
    
        foreach ($candidates as $p) {
            if ($p && is_file($p)) {
                return $p;
            }
        }
    
        // Last resort: try to locate the original front asset if present.
        $relative = 'front/src/assets/altracall-logo.png';
        $base = __DIR__;
    
        for ($i = 0; $i < 10; $i++) {
            $cand = $base . DIRECTORY_SEPARATOR . $relative;
            if (is_file($cand)) {
                return $cand;
            }
            $parent = dirname($base);
            if ($parent === $base) {
                break;
            }
            $base = $parent;
        }
    
        return null;
    }
    
    /** @return array{path:string,name:string,mime:string,cid:string,disposition:string}|null */
    private function logoInlineAttachment(): ?array
    {
        $p = $this->findLogoPath();
        if (!$p) return null;

        return [
            'path' => $p,
            'name' => 'logo_altra.png',
            'mime' => 'image/png',
            'cid'  => 'logo_altra',
            'disposition' => 'inline',
        ];
    }

    private function primaryCta(string $url, string $label): string
    {
        $u = $this->h($url);
        $l = $this->h($label);

        return ''
            . '<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">'
            . '  <tr>'
            . '    <td align="center" bgcolor="#003366" style="border-radius:8px;">'
            . '      <a href="'.$u.'" style="display:inline-block; padding:12px 22px; font-size:14px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:8px; font-family:Arial, sans-serif;">'.$l.'</a>'
            . '    </td>'
            . '  </tr>'
            . '</table>';
    }

    /** @param array<int,array{0:string,1:string}> $rows */
    private function kvTable(array $rows): string
    {
        $out = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0;width:100%">';
        foreach ($rows as [$k, $v]) {
            $out .= ''
                . '<tr>'
                . '  <td valign="top" style="padding:10px 12px;border-top:1px solid #eef2f7;width:190px;color:#334155;font-weight:600;background:#f8fafc">'.$this->h($k).'</td>'
                . '  <td valign="top" style="padding:10px 12px;border-top:1px solid #eef2f7;color:#0f172a">'.$this->h($v).'</td>'
                . '</tr>';
        }
        $out .= '</table>';
        return $out;
    }

    /**
     * Modern, brandable email layout.
     *
     * @param array<int,array{0:string,1:string}> $rows
     */
    public function renderEmail(string $title, string $intro, array $rows = [], ?string $ctaUrl = null, string $ctaLabel = 'Ouvrir', ?string $finePrint = null): string
    {
        $brand = (string)($_ENV['APP_BRAND'] ?? $_SERVER['APP_BRAND'] ?? 'Altra-RH');

        $t = $this->h($title);
        $i = $this->h($intro);

        $table = '';
        if ($rows) {
            $table .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:18px;">';
            foreach ($rows as $r) {
                $k = $this->h((string)($r[0] ?? ''));

                // Value can be a plain string OR ['html' => '<b>...</b>']
                $raw = $r[1] ?? '';
                if (is_array($raw) && isset($raw['html'])) {
                    $v = (string)$raw['html'];
                } else {
                    $v = $this->h((string)$raw);
                }

                $table .= ''
                    . '<tr>'
                    . '  <td valign="top" style="padding:10px 12px;background:#f8fafc;border-radius:6px 0 0 6px;font-weight:700;color:#111827;font-size:14px;border-bottom:6px solid #ffffff;">'.$k.'</td>'
                    . '  <td valign="top" style="padding:10px 12px;background:#f8fafc;border-radius:0 6px 6px 0;color:#111827;font-size:14px;border-bottom:6px solid #ffffff;">'.$v.'</td>'
                    . '</tr>';
            }
            $table .= '</table>';
        }

        $btn = '';
        if ($ctaUrl && $ctaUrl !== '') {
            $btn = $this->primaryCta($ctaUrl, $ctaLabel);
        }

        $fine = $finePrint ? ('<p style="margin:18px 0 0 0;font-size:13px;line-height:1.6;color:#6b7280;">'.$this->h($finePrint).'</p>') : '';

        $phone   = (string)($_ENV['APP_CONTACT_PHONE'] ?? $_SERVER['APP_CONTACT_PHONE'] ?? '');
        $address = (string)($_ENV['APP_CONTACT_ADDRESS'] ?? $_SERVER['APP_CONTACT_ADDRESS'] ?? '');
        $email   = (string)($_ENV['APP_CONTACT_EMAIL'] ?? $_SERVER['APP_CONTACT_EMAIL'] ?? '');

        $footerLines = '';
        if ($phone !== '')   $footerLines .= '<p style="margin:10px 0;">'.$this->h($phone).'</p>';
        if ($address !== '') $footerLines .= '<p style="margin:10px 0;">'.$this->h($address).'</p>';
        if ($email !== '')   $footerLines .= '<p style="margin:10px 0;">'.$this->h($email).'</p>';

        if ($footerLines === '') {
            $footerLines = '<p style="margin:10px 0;">Support : répondez à cet email.</p>';
        }

        return ''
            . '<!DOCTYPE html>'
            . '<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>'.$this->h($brand).'</title></head>'
            . '<body style="margin:0; padding:0; background:#f4f4f7; font-family:Arial, sans-serif;">'
            . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f7; padding:25px 0;">'
            . '  <tr><td align="center">'
            . '    <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.05);">'
            . '      <tr><td style="background:#fed453; height:28px; font-size:0; line-height:0;">&nbsp;</td></tr>'
            . '      <tr><td style="padding:30px 20px;">'
            . '        <table role="presentation" width="100%"><tr>'
            . '          <td align="left" style="width:150px; padding-right:20px;">'
            . '            <img src="cid:logo_altra" alt="'.$this->h($brand).'" width="110" style="display:block;">'
            . '          </td>'
            . '          <td align="left" style="color:#000;">'
            . '            <h1 style="margin:0; font-size:26px; font-weight:600; letter-spacing:1px;">'.strtoupper($this->h($brand)).'</h1>'
            . '            <div style="font-size:14px; margin-top:8px;">GESTION DES RESSOURCES HUMAINES</div>'
            . '          </td>'
            . '        </tr></table>'
            . '      </td></tr>'
            . '      <tr><td style="padding:40px 30px; color:#333; font-size:15px; line-height:1.7;">'
            . '        <p style="font-size:18px; color:#003366; margin-top:0; margin-bottom:10px; font-weight:700;">'.$t.'</p>'
            . '        <p style="margin-top:0; margin-bottom:16px;">'.$i.'</p>'
            .              $table
            . '        <div style="margin-top:22px;">'.$btn.'</div>'
            .              $fine
            . '      </td></tr>'
            . '      <tr><td align="center" style="padding:25px; font-size:13px; background:#fed453;">'
            . '        <div style="text-align:center; color:#000;">'
            . '          <p style="margin:10px 0;">Nous Contacter :</p>'
            .              $footerLines
            . '          <p style="margin:10px 0;">Copyright © '.date('Y').' '.$this->h($brand).'</p>'
            . '        </div>'
            . '      </td></tr>'
            . '    </table>'
            . '  </td></tr>'
            . '</table>'
            . '</body></html>';
    }

    /**
     * Render small inline badges (Outlook-friendly).
     *
     * @param array<int,string> $badges
     */
    public function renderInlineBadges(array $badges): string
    {
        $out = '';
        foreach ($badges as $b) {
            $out .= '<span style="display:inline-block;padding:3px 8px;margin:0 6px 6px 0;border-radius:999px;background:#e5e7eb;color:#111827;font-size:12px;font-weight:700;">'.$this->h($b).'</span>';
        }
        return $out;
    }

    /** @return array{label:string,badges:array<int,string>} */
    public function presentStatus(string $domain, ?string $status): array
    {
        $s = strtoupper((string)($status ?? ''));
        $d = strtoupper($domain);

        // Generic 2-step wording used across modules.
        return match (true) {
            $s === 'DRAFT' => ['label' => 'Brouillon', 'badges' => ['Brouillon']],
            $s === 'SUBMITTED' => ['label' => 'En attente de validation (manager)', 'badges' => ['En attente manager']],
            $s === 'MANAGER_APPROVED' => ['label' => 'Pré-validée (manager) · en attente validation finale', 'badges' => ['Pré-validation', 'Validation finale à venir']],
            in_array($s, ['HR_APPROVED','RH_APPROVED','APPROVED'], true) => ['label' => 'Validée (finale)', 'badges' => ['Validation finale']],
            $s === 'REJECTED' => ['label' => 'Refusée', 'badges' => ['Refusée']],
            $s === 'CANCELLED' => ['label' => 'Annulée', 'badges' => ['Annulée']],
            default => ['label' => ($status ?: '—'), 'badges' => [$status ?: '—']],
        };
    }


    /** @return array<int,array{path:string,name?:string,mime?:string}> */
    private function certificateAttachment(LeaveRequest $lr): array
    {
        $rel = (string)($lr->getCertificatePath() ?: '');
        if ($rel === '') return [];
        $base = $this->projectDir ?: (string)($_SERVER['KERNEL_PROJECT_DIR'] ?? '');
        if ($base === '') return [];
        $abs = rtrim($base, '/').'/'.ltrim($rel, '/');
        if (!is_file($abs)) return [];
        $name = basename($abs);
        $mime = 'application/octet-stream';
        if (function_exists('mime_content_type')) {
            $m = @mime_content_type($abs);
            if (is_string($m) && $m !== '') $mime = $m;
        }
        return [['path' => $abs, 'name' => $name, 'mime' => $mime]];
    }

    private function leaveEmailHtml(LeaveRequest $lr, string $title, string $intro): string
    {
        $emp = $lr->getUser();
        $mgr = $lr->getManager();
        $type = $lr->getType();

        $url = rtrim($this->frontendUrl, '/') . '/leaves/detail/' . $lr->getId();

        $st = $this->presentStatus('LEAVE', $lr->getStatus());
        $rows = [
            ['Employé', $emp ? ($emp->getFullName() ?: $emp->getEmail()) : '—'],
            ['Type', $type ? ($type->getLabel() ?: $type->getCode()) : '—'],
            ['Du', $lr->getStartDate()?->format('Y-m-d') ?: '—'],
            ['Au', $lr->getEndDate()?->format('Y-m-d') ?: '—'],
            ['Jours', (string)($lr->getDaysCount() ?? 0)],
            ['Statut', ['html' => $this->renderInlineBadges($st['badges']) . '<div style="margin-top:6px;color:#374151;font-size:13px;">' . $this->h($st['label']) . '</div>']],
        ];

        if ($mgr) $rows[] = ['Manager', $mgr->getFullName() ?: $mgr->getEmail()];
        if ($lr->getNote()) $rows[] = ['Note', $lr->getNote()];
        if (method_exists($lr, 'getManagerComment') && $lr->getManagerComment()) $rows[] = ['Commentaire manager', $lr->getManagerComment()];
        if (method_exists($lr, 'getHrComment') && $lr->getHrComment()) $rows[] = ['Commentaire RH', $lr->getHrComment()];

        return $this->renderEmail(
            title: $title,
            intro: $intro,
            rows: $rows,
            ctaUrl: $url,
            ctaLabel: 'Ouvrir la demande'
        );
    }



    public function onEmployeeSubmit(LeaveRequest $lr): void
    {
        $user = $lr->getUser();
        if (!$user) {
            return;
        }

        $this->notify((string) $user->getEmail(), 'Congé · Demande envoyée', $this->leaveEmailHtml($lr, 'Demande de congé envoyée', 'Votre demande a été envoyée. Prochaine étape : validation du manager.'), $this->certificateAttachment($lr));
    }

    public function onSubmit(LeaveRequest $lr): void
    {
        $manager = $lr->getManager();
        if (!$manager) {
            return;
        }

        $this->notify((string) $manager->getEmail(), 'Nouvelle demande de congé', $this->leaveEmailHtml($lr, 'Nouvelle demande de congé', 'Une nouvelle demande est en attente de votre validation.'), $this->certificateAttachment($lr));
    }

    public function onManagerDecision(LeaveRequest $lr): void
    {
        $user = $lr->getUser();
        if (!$user) {
            return;
        }

        $this->notify((string) $user->getEmail(), 'Décision manager sur votre congé', $this->leaveEmailHtml($lr, 'Décision manager', 'Votre manager a traité votre demande.'), $this->certificateAttachment($lr));
    }

    public function onHrDecision(LeaveRequest $lr): void
    {
        $user = $lr->getUser();
        if (!$user) {
            return;
        }

        $this->notify((string) $user->getEmail(), 'Décision RH sur votre congé', $this->leaveEmailHtml($lr, 'Décision RH', 'La RH a finalisé votre demande.'), $this->certificateAttachment($lr));
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
    /** @param array<int,array{path:string,name?:string,mime?:string}> $attachments */
    private function sendSmtp(string $to, string $subject, string $htmlContent, array $attachments = []): void
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
        $fromName = (string)($_ENV['MAIL_FROM_NAME'] ?? $_SERVER['MAIL_FROM_NAME'] ?? $this->brandName());
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
            $send('EHLO altra-rh');
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
];

// Always try to embed the brand logo as CID (better client compatibility).
$inline = [];
$logoInline = $this->logoInlineAttachment();
if ($logoInline) {
    $inline[] = $logoInline;
}

// Split attachments into inline vs classic attachments (certificate, etc.)
$files = [];
foreach ($attachments as $att) {
    $disp = strtolower((string)($att['disposition'] ?? 'attachment'));
    $cid  = (string)($att['cid'] ?? '');
    if ($disp === 'inline' || $cid !== '') {
        $inline[] = $att;
    } else {
        $files[] = $att;
    }
}

$hasInline = count($inline) > 0;
$hasFiles  = count($files) > 0;

if ($hasInline && $hasFiles) {
    // multipart/mixed (outer) -> multipart/related (inner) + attachments
    $bMixed   = 'bnd_m_' . bin2hex(random_bytes(8));
    $bRelated = 'bnd_r_' . bin2hex(random_bytes(8));

    $headers[] = 'Content-Type: multipart/mixed; boundary="' . $bMixed . '"';

    $body = '';
    // Start related container
    $body .= '--' . $bMixed . "\r\n";
    $body .= 'Content-Type: multipart/related; boundary="' . $bRelated . "\"\r\n\r\n";

    // HTML
    $body .= '--' . $bRelated . "\r\n";
    $body .= "Content-Type: text/html; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
    $body .= quoted_printable_encode($htmlContent) . "\r\n";

    // Inline images
    foreach ($inline as $att) {
        $p = (string)($att['path'] ?? '');
        if ($p === '' || !is_file($p)) continue;

        $name = (string)($att['name'] ?? basename($p));
        $mime = (string)($att['mime'] ?? 'application/octet-stream');
        $cid  = (string)($att['cid'] ?? 'inline_' . bin2hex(random_bytes(6)));

        $raw = @file_get_contents($p);
        if ($raw === false) continue;
        $b64 = chunk_split(base64_encode($raw), 76, "\r\n");

        $safeName = addcslashes($name, '"\\');
        $body .= '--' . $bRelated . "\r\n";
        $body .= 'Content-Type: ' . $mime . '; name="' . $safeName . "\"\r\n";
        $body .= 'Content-Disposition: inline; filename="' . $safeName . "\"\r\n";
        $body .= 'Content-ID: <' . $cid . ">\r\n";
        $body .= 'Content-Location: ' . $safeName . "\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $body .= $b64 . "\r\n";
    }

    $body .= '--' . $bRelated . "--\r\n";

    // Attachments
    foreach ($files as $att) {
        $p = (string)($att['path'] ?? '');
        if ($p === '' || !is_file($p)) continue;

        $name = (string)($att['name'] ?? basename($p));
        $mime = (string)($att['mime'] ?? 'application/octet-stream');

        $raw = @file_get_contents($p);
        if ($raw === false) continue;
        $b64 = chunk_split(base64_encode($raw), 76, "\r\n");

        $safeName = addcslashes($name, '"\\');
        $body .= '--' . $bMixed . "\r\n";
        $body .= 'Content-Type: ' . $mime . '; name="' . $safeName . "\"\r\n";
        $body .= 'Content-Disposition: attachment; filename="' . $safeName . "\"\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $body .= $b64 . "\r\n";
    }

    $body .= '--' . $bMixed . "--\r\n";

    $data = implode("\r\n", $headers) . "\r\n\r\n" . $body;
    fwrite($fp, $data . "\r\n.\r\n");
} elseif ($hasInline && !$hasFiles) {
    // multipart/related (HTML + inline images)
    $bRelated = 'bnd_r_' . bin2hex(random_bytes(8));
    $headers[] = 'Content-Type: multipart/related; boundary="' . $bRelated . '"';

    $body = '';
    $body .= '--' . $bRelated . "\r\n";
    $body .= "Content-Type: text/html; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
    $body .= quoted_printable_encode($htmlContent) . "\r\n";

    foreach ($inline as $att) {
        $p = (string)($att['path'] ?? '');
        if ($p === '' || !is_file($p)) continue;

        $name = (string)($att['name'] ?? basename($p));
        $mime = (string)($att['mime'] ?? 'application/octet-stream');
        $cid  = (string)($att['cid'] ?? 'inline_' . bin2hex(random_bytes(6)));

        $raw = @file_get_contents($p);
        if ($raw === false) continue;
        $b64 = chunk_split(base64_encode($raw), 76, "\r\n");

        $safeName = addcslashes($name, '"\\');
        $body .= '--' . $bRelated . "\r\n";
        $body .= 'Content-Type: ' . $mime . '; name="' . $safeName . "\"\r\n";
        $body .= 'Content-Disposition: inline; filename="' . $safeName . "\"\r\n";
        $body .= 'Content-ID: <' . $cid . ">\r\n";
        $body .= 'Content-Location: ' . $safeName . "\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $body .= $b64 . "\r\n";
    }

    $body .= '--' . $bRelated . "--\r\n";
    $data = implode("\r\n", $headers) . "\r\n\r\n" . $body;
    fwrite($fp, $data . "\r\n.\r\n");
} elseif (!$hasInline && $hasFiles) {
    // multipart/mixed (HTML + attachments)
    $boundary = 'bnd_' . bin2hex(random_bytes(8));
    $headers[] = 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';

    $body = '';
    $body .= '--' . $boundary . "\r\n";
    $body .= "Content-Type: text/html; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
    $body .= quoted_printable_encode($htmlContent) . "\r\n";

    foreach ($files as $att) {
        $p = (string)($att['path'] ?? '');
        if ($p === '' || !is_file($p)) continue;

        $name = (string)($att['name'] ?? basename($p));
        $mime = (string)($att['mime'] ?? 'application/octet-stream');

        $raw = @file_get_contents($p);
        if ($raw === false) continue;
        $b64 = chunk_split(base64_encode($raw), 76, "\r\n");

        $safeName = addcslashes($name, '"\\');
        $body .= '--' . $boundary . "\r\n";
        $body .= 'Content-Type: ' . $mime . '; name="' . $safeName . "\"\r\n";
        $body .= 'Content-Disposition: attachment; filename="' . $safeName . "\"\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $body .= $b64 . "\r\n";
    }

    $body .= '--' . $boundary . "--\r\n";
    $data = implode("\r\n", $headers) . "\r\n\r\n" . $body;
    fwrite($fp, $data . "\r\n.\r\n");
} else {
    // Simple HTML (no multipart)
    $headers[] = 'Content-Type: text/html; charset=UTF-8';
    $headers[] = 'Content-Transfer-Encoding: quoted-printable';
    $data = implode("\r\n", $headers) . "\r\n\r\n" . quoted_printable_encode($htmlContent) . "\r\n";
    fwrite($fp, $data . "\r\n.\r\n");
}

        $expect([250]);

        $send('QUIT');
        fclose($fp);
        unset($GLOBALS['__smtp_fp']);
    }
}

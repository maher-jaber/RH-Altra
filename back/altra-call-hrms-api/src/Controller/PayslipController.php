<?php

namespace App\Controller;

use App\Entity\Payslip;
use App\Entity\Notification;
use App\Entity\User;
use App\Service\PayslipNameMatcher;
use App\Service\PayslipPdfNameExtractor;
use App\Service\LeaveNotificationService;
use Psr\Log\LoggerInterface;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/payslips')]
class PayslipController extends ApiBase
{
    public function __construct(
        private LeaveNotificationService $mailer,
        private LoggerInterface $logger,
    ) {}

    /** @return array<string,mixed> */
    private function jsonBody(Request $r): array
    {
        $ct = (string)$r->headers->get('Content-Type', '');
        if (stripos($ct, 'application/json') === false) return [];
        $raw = (string)$r->getContent();
        if ($raw === '') return [];
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    private function payslipsDir(): string
    {
        $dir = trim((string)($_ENV['PAYSLIPS_DIR'] ?? ''));
        if ($dir === '') {
            $dir = dirname(__DIR__, 2) . '/var/storage/payslips';
        }
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        return $dir;
    }

    private function canImport(Request $r, EntityManagerInterface $em): bool
    {
        $token = $this->requireUser($r);
        if ($this->hasRole($token, 'ROLE_ADMIN')) return true;

        $me = $this->requireDbUser($r, $em);
        return $this->hasRole($token, 'ROLE_MANAGER')
            || $this->hasRole($token, 'ROLE_SUPERIOR')
            || $this->isManagerByRelation($em, $me);
    }

    /**
     * Lightweight list of employees allowed for manual assignment.
     * - Admin: all users
     * - Manager: only direct team (manager/manager2)
     */
    #[Route('/team-users', name: 'payslips_team_users', methods: ['GET'])]
    public function teamUsersEndpoint(Request $r, EntityManagerInterface $em): \Symfony\Component\HttpFoundation\JsonResponse
    {
        if (!$this->canImport($r, $em)) {
            return $this->jsonOk(['error' => 'forbidden'], 403);
        }
        $me = $this->requireDbUser($r, $em);
        $token = $this->requireUser($r);
        $isAdmin = $this->hasRole($token, 'ROLE_ADMIN');

        $users = $isAdmin ? $em->getRepository(User::class)->findAll() : $this->teamUsers($em, $me);
        $items = [];
        foreach ($users as $u) {
            if (!$u instanceof User) continue;
            $items[] = ['id' => (string)$u->getId(), 'fullName' => $u->getFullName(), 'email' => $u->getEmail()];
        }
        usort($items, fn($a,$b) => strcmp((string)($a['fullName'] ?? ''), (string)($b['fullName'] ?? '')));
        return $this->jsonOk(['items' => $items]);
    }

    /**
     * Import payslips as PDFs (multi upload).
     *
     * Form fields:
     * - month: YYYY-MM
     * - files[]: PDF files
     */
    #[Route('/import', name: 'payslips_import', methods: ['POST'])]
    public function import(Request $r, EntityManagerInterface $em, PayslipNameMatcher $matcher, PayslipPdfNameExtractor $pdfExtractor): \Symfony\Component\HttpFoundation\JsonResponse
    {
        if (!$this->canImport($r, $em)) {
            return $this->jsonOk(['error' => 'forbidden'], 403);
        }

        $me = $this->requireDbUser($r, $em);
        $month = trim((string)$r->request->get('month', ''));
        if (!preg_match('/^\d{4}\-(0[1-9]|1[0-2])$/', $month)) {
            return $this->jsonOk(['error' => 'Invalid month. Expected YYYY-MM'], 400);
        }

        /** @var array<int,UploadedFile>|null $files */
        $files = $r->files->all('files');
        if (!$files || count($files) === 0) {
            return $this->jsonOk(['error' => 'No files uploaded (field: files[])'], 400);
        }

        // Determine scope of users to match against.
        $token = $this->requireUser($r);
        $isAdmin = $this->hasRole($token, 'ROLE_ADMIN');
        $users = $isAdmin ? $em->getRepository(User::class)->findAll() : $this->teamUsers($em, $me);

        $results = [];
        $dir = $this->payslipsDir();

        foreach ($files as $file) {
            if (!$file instanceof UploadedFile) continue;
            $orig = $file->getClientOriginalName() ?: 'payslip.pdf';
            $mime = (string)$file->getClientMimeType();
            $ext = strtolower((string)$file->getClientOriginalExtension());
            if ($ext !== 'pdf' && $mime !== 'application/pdf') {
                $results[] = ['file' => $orig, 'ok' => false, 'error' => 'Only PDF allowed'];
                continue;
            }

            // Prefer extracting name from inside the PDF (more reliable than filename).
            // If PDF is image-only/scanned, extractor returns null and we fall back to filename.
            $candidateFromPdf = null;
            try {
                $candidateFromPdf = $pdfExtractor->extractCandidateFullName($file->getPathname());
            } catch (\Throwable $e) {
                $candidateFromPdf = null;
            }

            $match = $candidateFromPdf ? $matcher->matchCandidate($candidateFromPdf, $users) : $matcher->match($orig, $users);
            $best = $match['best'] ?? null;
            $ambiguous = (bool)($match['ambiguous'] ?? false);

            $status = Payslip::STATUS_UNMATCHED;
            $user = null;
            $score = null;
            $method = null;

            if ($best && isset($best['user']) && $best['user'] instanceof User) {
                /** @var User $u */
                $u = $best['user'];
                $score = (float)($best['score'] ?? 0);
                $method = $candidateFromPdf ? ($ambiguous ? 'pdf-fuzzy-ambiguous' : 'pdf-fuzzy') : ($ambiguous ? 'fuzzy-ambiguous' : 'fuzzy');

                if ($ambiguous) {
                    $status = Payslip::STATUS_AMBIGUOUS;
                    $user = $u; // keep suggestion for review
                } elseif ($score >= 0.92) {
                    $status = Payslip::STATUS_AUTO;
                    $user = $u;
                } elseif ($score >= 0.85) {
                    $status = Payslip::STATUS_PROBABLE;
                    $user = $u;
                }
            }

            $stored = $this->uniqueStoredFilename($month, $orig);
            $file->move($dir, $stored);

            $p = (new Payslip())
                ->setPeriodMonth($month)
                ->setOriginalFilename($orig)
                ->setStoredFilename($stored)
                ->setUploadedBy($me)
                ->setStatus($status)
                ->setUser($user)
                ->setMatchScore($score)
                ->setMatchMethod($method);

            $em->persist($p);
            $em->flush();

            $results[] = [
                'ok' => true,
                'id' => (string)$p->getId(),
                'file' => $orig,
                'candidate' => $match['candidate'] ?? null,
                'status' => $status,
                'matchScore' => $score,
                'matchedUser' => $user ? ['id' => (string)$user->getId(), 'fullName' => $user->getFullName()] : null,
                'topCandidates' => $match['top'] ?? [],
            ];
        }

        return $this->jsonOk(['items' => $results]);
    }

    /**
     * Manually create+publish a payslip for a specific employee.
     *
     * Form fields:
     * - month: YYYY-MM
     * - userId: employee id
     * - file: PDF
     */
    #[Route('/manual', name: 'payslips_manual', methods: ['POST'])]
    public function manual(Request $r, EntityManagerInterface $em): \Symfony\Component\HttpFoundation\JsonResponse
    {
        if (!$this->canImport($r, $em)) {
            return $this->jsonOk(['error' => 'forbidden'], 403);
        }
        $me = $this->requireDbUser($r, $em);

        $month = trim((string)$r->request->get('month', ''));
        if (!preg_match('/^\d{4}\-(0[1-9]|1[0-2])$/', $month)) {
            return $this->jsonOk(['error' => 'Invalid month. Expected YYYY-MM'], 400);
        }
        $userId = (int)$r->request->get('userId', 0);
        /** @var User|null $user */
        $user = $em->getRepository(User::class)->find($userId);
        if (!$user) return $this->jsonOk(['error' => 'User not found'], 404);

        /** @var UploadedFile|null $file */
        $file = $r->files->get('file');
        if (!$file) return $this->jsonOk(['error' => 'Missing file'], 400);
        $ext = strtolower((string)$file->getClientOriginalExtension());
        $mime = (string)$file->getClientMimeType();
        if ($ext !== 'pdf' && $mime !== 'application/pdf') {
            return $this->jsonOk(['error' => 'Only PDF allowed'], 400);
        }

        $orig = $file->getClientOriginalName() ?: 'payslip.pdf';
        $stored = $this->uniqueStoredFilename($month, $orig);
        $file->move($this->payslipsDir(), $stored);

        $p = (new Payslip())
            ->setPeriodMonth($month)
            ->setOriginalFilename($orig)
            ->setStoredFilename($stored)
            ->setUploadedBy($me)
            ->setStatus(Payslip::STATUS_PUBLISHED)
            ->setUser($user)
            ->setMatchMethod('manual')
            ->setPublishedAt(new \DateTimeImmutable());
        $em->persist($p);

        // In-app notification + email (best-effort)
        $this->notifyPayslipPublished($em, $user, $month, (string)$p->getId());

        $em->flush();

        return $this->jsonOk([
            'ok' => true,
            'id' => (string)$p->getId(),
            'user' => ['id' => (string)$user->getId(), 'fullName' => $user->getFullName()],
            'month' => $month,
        ], 201);
    }

    /** Assign/override the employee for a payslip (manual mapping). */
    #[Route('/{id}/assign', name: 'payslips_assign', methods: ['POST'])]
    public function assign(string $id, Request $r, EntityManagerInterface $em): \Symfony\Component\HttpFoundation\JsonResponse
    {
        if (!$this->canImport($r, $em)) {
            return $this->jsonOk(['error' => 'forbidden'], 403);
        }
        /** @var Payslip|null $p */
        $p = $em->getRepository(Payslip::class)->find((int)$id);
        if (!$p) return $this->jsonOk(['error' => 'Payslip not found'], 404);

        $json = $this->jsonBody($r);
        $userId = (int)($r->request->get('userId', 0) ?: ($json['userId'] ?? 0));
        /** @var User|null $user */
        $user = $em->getRepository(User::class)->find($userId);
        if (!$user) return $this->jsonOk(['error' => 'User not found'], 404);

        $p->setUser($user)
            ->setStatus(Payslip::STATUS_MANUAL)
            ->setMatchMethod('manual-assign');
        $em->flush();

        return $this->jsonOk([
            'ok' => true,
            'id' => (string)$p->getId(),
            'status' => $p->getStatus(),
            'user' => ['id' => (string)$user->getId(), 'fullName' => $user->getFullName()],
        ]);
    }

    /** Publish all payslips of a month that have a user assigned and are not yet published. */
    #[Route('/publish', name: 'payslips_publish', methods: ['POST'])]
    public function publish(Request $r, EntityManagerInterface $em): \Symfony\Component\HttpFoundation\JsonResponse
    {
        if (!$this->canImport($r, $em)) {
            return $this->jsonOk(['error' => 'forbidden'], 403);
        }
        $json = $this->jsonBody($r);
        $month = trim((string)($r->request->get('month', '') ?: ($json['month'] ?? '')));
        if (!preg_match('/^\d{4}\-(0[1-9]|1[0-2])$/', $month)) {
            return $this->jsonOk(['error' => 'Invalid month. Expected YYYY-MM'], 400);
        }

        $qb = $em->createQueryBuilder()
            ->select('p')
            ->from(Payslip::class, 'p')
            ->where('p.periodMonth = :m')
            ->andWhere('p.user IS NOT NULL')
            ->andWhere('p.publishedAt IS NULL OR p.status != :published')
            ->setParameter('m', $month)
            ->setParameter('published', Payslip::STATUS_PUBLISHED);

        $items = $qb->getQuery()->getResult();
        $now = new \DateTimeImmutable();
        $count = 0;
        foreach ($items as $p) {
            if (!$p instanceof Payslip) continue;
            $p->setStatus(Payslip::STATUS_PUBLISHED)->setPublishedAt($now);
            $count++;

            // Notify per payslip (in-app + email). Best-effort, won't crash API.
            if ($p->getUser()) {
                $this->notifyPayslipPublished($em, $p->getUser(), $month, (string)$p->getId());
            }
        }
        $em->flush();

        return $this->jsonOk(['ok' => true, 'published' => $count, 'month' => $month]);
    }

    /** List my published payslips. */
    #[Route('/my', name: 'payslips_my', methods: ['GET'])]
    public function my(Request $r, EntityManagerInterface $em): \Symfony\Component\HttpFoundation\JsonResponse
    {
        $me = $this->requireDbUser($r, $em);
        $qb = $em->createQueryBuilder()
            ->select('p')
            ->from(Payslip::class, 'p')
            ->where('p.user = :u')
            ->andWhere('p.status = :st')
            ->setParameter('u', $me)
            ->setParameter('st', Payslip::STATUS_PUBLISHED)
            ->orderBy('p.periodMonth', 'DESC')
            ->addOrderBy('p.id', 'DESC');

        $items = $qb->getQuery()->getResult();
        $out = [];
        foreach ($items as $p) {
            if (!$p instanceof Payslip) continue;
            $out[] = [
                'id' => (string)$p->getId(),
                'month' => $p->getPeriodMonth(),
                'originalFilename' => $p->getOriginalFilename(),
                'publishedAt' => $p->getPublishedAt()?->format(DATE_ATOM),
            ];
        }
        return $this->jsonOk(['items' => $out]);
    }

    /** Secure download. Owner (employee) can download, as well as Admin. */
    #[Route('/{id}/download', name: 'payslips_download', methods: ['GET'])]
    public function download(string $id, Request $r, EntityManagerInterface $em): Response
    {
        $me = $this->requireDbUser($r, $em);
        $token = $this->requireUser($r);

        /** @var Payslip|null $p */
        $p = $em->getRepository(Payslip::class)->find((int)$id);
        if (!$p) throw $this->createNotFoundException('Payslip not found');
        if (!$p->isPublished()) return $this->jsonOk(['error' => 'forbidden'], 403);
        $isAdmin = $this->hasRole($token, 'ROLE_ADMIN');
        if (!$isAdmin) {
            if (!$p->getUser() || $p->getUser()->getId() !== $me->getId()) {
                return $this->jsonOk(['error' => 'forbidden'], 403);
        }
        }

        $path = rtrim($this->payslipsDir(), '/') . '/' . $p->getStoredFilename();
        if (!is_file($path)) throw $this->createNotFoundException('File missing on server');

        // IMPORTANT: avoid BinaryFileResponse mime guessing (requires symfony/mime).
        // We stream the file with an explicit Content-Type.
        $downloadName = $p->getOriginalFilename() ?: ('payslip-' . $p->getPeriodMonth() . '.pdf');

        $resp = new StreamedResponse(function () use ($path) {
            $h = fopen($path, 'rb');
            if ($h === false) {
                return;
            }
            while (!feof($h)) {
                echo fread($h, 1024 * 1024);
                @ob_flush();
                flush();
            }
            fclose($h);
        });

        $resp->headers->set('Content-Type', 'application/pdf');
        $resp->headers->set('Content-Length', (string)filesize($path));
        $resp->headers->set('X-Content-Type-Options', 'nosniff');
        $disposition = $resp->headers->makeDisposition(ResponseHeaderBag::DISPOSITION_ATTACHMENT, $downloadName);
        $resp->headers->set('Content-Disposition', $disposition);
        return $resp;
    }

    /** @return User[] */
    private function teamUsers(EntityManagerInterface $em, User $manager): array
    {
        $qb = $em->createQueryBuilder()
            ->select('u')
            ->from(User::class, 'u')
            ->where('u.manager = :m OR u.manager2 = :m')
            ->setParameter('m', $manager)
            ->orderBy('u.fullName', 'ASC');
        return $qb->getQuery()->getResult();
    }

    private function uniqueStoredFilename(string $month, string $orig): string
    {
        $safeOrig = preg_replace('/[^a-zA-Z0-9\.\-_ ]/', '_', $orig) ?? $orig;
        $safeOrig = str_replace(' ', '_', $safeOrig);
        $rand = bin2hex(random_bytes(8));
        return $month . '__' . $rand . '__' . $safeOrig;
    }

    private function notifyPayslipPublished(EntityManagerInterface $em, User $user, string $month, string $payslipId): void
    {
        // In-app
        $n = (new Notification())
            ->setUser($user)
            ->setType('PAYSLIP')
            ->setTitle('Fiche de paie disponible')
            ->setBody('Votre fiche de paie (' . $month . ') est disponible.')
            ->setActionUrl('/payslips/my')
            ->setPayload(['month' => $month, 'payslipId' => $payslipId]);
        $em->persist($n);

        // Email (best-effort). SMTP is already used in other flows (leave/authorization).
        $to = (string)$user->getEmail();
        if ($to !== '') {
            try {
                $subject = 'Fiche de paie disponible - ' . $month;
                $frontend = rtrim((string)($_ENV['FRONTEND_URL'] ?? $_SERVER['FRONTEND_URL'] ?? 'http://localhost:8008'), '/');
                $url = $frontend . '/payslips/my';

                $html = $this->mailer->renderEmail(
                    title: 'Fiche de paie disponible',
                    intro: 'Votre fiche de paie est maintenant disponible dans le portail.',
                    rows: [
                        ['Mois', $month],
                        ['Référence', $payslipId],
                    ],
                    ctaUrl: $url,
                    ctaLabel: 'Ouvrir le portail',
                    finePrint: 'Si vous ne reconnaissez pas cette fiche de paie, contactez le service RH.'
                );

                $this->mailer->notify($to, $subject, $html);
                $this->logger->info('Payslip mail sent', ['to' => $to, 'month' => $month, 'payslipId' => $payslipId]);
            } catch (\Throwable $e) {
                $this->logger->error('Payslip mail failed', ['to' => $to, 'month' => $month, 'payslipId' => $payslipId, 'error' => $e->getMessage()]);
            }
        } else {
            $this->logger->warning('Payslip mail skipped: empty user email', ['userId' => $user->getId(), 'month' => $month, 'payslipId' => $payslipId]);
        }
    }
}

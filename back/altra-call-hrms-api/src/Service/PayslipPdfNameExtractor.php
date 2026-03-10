<?php

namespace App\Service;

/**
 * Extract an employee name from a payslip PDF.
 *
 * Goal: be VERY conservative to avoid false positives (e.g. "Catégorie", "Échelon", company name).
 * We prefer specific payroll patterns (like "0832 - JABER Maher") and only fall back to generic patterns
 * with strong noise filtering.
 *
 * Uses: pdftotext (poppler-utils). No OCR in this version.
 */
class PayslipPdfNameExtractor
{
    /**
     * Returns a candidate full name (e.g. "JABER Maher") or null.
     */
    public function extractCandidateFullName(string $pdfPath): ?string
    {
        // 0) Prefer Python microservice if configured (much better extraction + fuzzy robustness)
        $fromPy = $this->pythonExtract($pdfPath);
        if (is_string($fromPy) && trim($fromPy) !== '') {
            return $fromPy;
        }

        $text = $this->pdftotext($pdfPath);
        if ($text === null) return null;

        $text = str_replace("\r", "\n", $text);
        $lines = preg_split("/\n+/", $text) ?: [];

        // Strong noise blacklist (normalized, no accents) to avoid matching payroll labels.
        $noise = [
            'categorie','catégorie','echelon','échelon','poste','fonction','societe','société','adresse',
            'matricule','cnss','rib','banque','date','periode','période','salaire','bulletin','paie','paye',
            'base','brut','net','cotisation','cotisations','retenue','retenues','prime','primes',
            'taux','gain','gains','deduction','déduction','total','totaux',
            'altra','call',
        ];

        // 1) FIRST PASS: scan for the most reliable pattern: "digits - LAST FIRST"
        // Example in your sample PDF: "0832 - JABER Maher"
        $reIdDash = '/^\s*\d{2,6}\s*-\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ\'\- ]{1,})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\'\- ]{1,})(?:\s|$)/u';

        foreach ($lines as $line) {
            $line = $this->squeeze($line);
            if ($line === '') continue;

            if (preg_match($reIdDash, $line, $m)) {
                $candidate = $this->buildCandidate($m[1], $m[2]);
                if ($candidate !== null && !$this->isNoisy($candidate, $noise)) {
                    return $candidate;
                }
            }
        }

        // 2) SECOND PASS: look near the "Employé" block, then apply same strict scan.
        $idxEmploye = $this->findLineIndexContaining($lines, ['employe', 'employé']);
        if ($idxEmploye !== null) {
            $start = max(0, $idxEmploye);
            $end = min(count($lines) - 1, $idxEmploye + 20);
            for ($i = $start; $i <= $end; $i++) {
                $line = $this->squeeze($lines[$i] ?? '');
                if ($line === '') continue;

                if (preg_match($reIdDash, $line, $m)) {
                    $candidate = $this->buildCandidate($m[1], $m[2]);
                    if ($candidate !== null && !$this->isNoisy($candidate, $noise)) {
                        return $candidate;
                    }
                }
            }
        }

        // 3) LAST RESORT: generic "LAST First" line, but with strong filtering.
        // - LAST must be mostly uppercase (>= 3 chars)
        // - First must contain at least one lowercase letter (to avoid ALL CAPS labels)
        $reGeneric = '/^\s*([A-ZÀ-Ÿ]{3,}[A-ZÀ-Ÿ\'\- ]{0,})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\'\- ]{1,})\s*$/u';

        foreach ($lines as $line) {
            $line = $this->squeeze($line);
            if ($line === '') continue;

            if (preg_match($reGeneric, $line, $m)) {
                // First name should contain a lowercase character to be human-like
                if (!preg_match('/[a-zà-ÿ]/u', $m[2])) continue;

                $candidate = $this->buildCandidate($m[1], $m[2]);
                if ($candidate !== null && !$this->isNoisy($candidate, $noise)) {
                    return $candidate;
                }
            }
        }

        return null;
    }

    private function buildCandidate(string $lastRaw, string $firstRaw): ?string
    {
        $last = $this->cleanHumanName($lastRaw);
        $first = $this->cleanHumanName($firstRaw);

        if ($last === '' || $first === '') return null;

        // Keep last name uppercase-ish (do not force to avoid losing accents)
        $full = trim($last . ' ' . $first);
        return $full !== '' ? $full : null;
    }

    private function squeeze(string $s): string
    {
        $s = trim($s);
        $s = preg_replace('/\s+/', ' ', $s) ?? $s;
        return $s;
    }

    private function isNoisy(string $candidate, array $noiseWords): bool
    {
        $n = $this->normalize($candidate);
        foreach ($noiseWords as $w) {
            $nw = $this->normalize($w);
            if ($nw !== '' && str_contains($n, $nw)) {
                return true;
            }
        }
        return false;
    }

    private function normalize(string $s): string
    {
        $s = mb_strtolower($s);
        $s = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s) ?: $s;
        $s = preg_replace('/[^a-z0-9\s]/', ' ', $s) ?? $s;
        $s = preg_replace('/\s+/', ' ', $s) ?? $s;
        return trim($s);
    }

    private function findLineIndexContaining(array $lines, array $needles): ?int
    {
        foreach ($lines as $i => $line) {
            $n = $this->normalize((string)$line);
            foreach ($needles as $needle) {
                $nn = $this->normalize($needle);
                if ($nn !== '' && str_contains($n, $nn)) {
                    return (int)$i;
                }
            }
        }
        return null;
    }

    private function cleanHumanName(string $s): string
    {
        $s = trim($s);
        $s = preg_replace('/\s+/', ' ', $s) ?? $s;
        $s = trim($s, " \t\n\r\0\x0B-_");
        return $s;
    }


/**
 * Call Python PDF service (FastAPI) to extract candidate name.
 * Returns null when service is not configured or fails.
 */
private function pythonExtract(string $pdfPath): ?string
{
    $base = $_ENV['PDFSVC_URL'] ?? getenv('PDFSVC_URL') ?: '';
    $base = rtrim((string)$base, '/');
    if ($base === '' || !is_file($pdfPath)) return null;

    $url = $base . '/extract-name';

    if (!function_exists('curl_init')) return null;

    $ch = curl_init($url);
    if ($ch === false) return null;

    $cfile = new \CURLFile($pdfPath, 'application/pdf', basename($pdfPath));
    $post = ['file' => $cfile];

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POSTFIELDS => $post,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_TIMEOUT => 10,
    ]);

    $resp = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!is_string($resp) || $resp === '' || $code < 200 || $code >= 300) {
        return null;
    }

    $data = json_decode($resp, true);
    if (!is_array($data)) return null;

    $cand = isset($data['candidate_full_name']) ? (string)$data['candidate_full_name'] : '';
    $conf = isset($data['confidence']) ? (float)$data['confidence'] : 0.0;

    if ($cand === '' || $conf < 0.70) {
        return null;
    }

    return trim($cand);
}
    /**
     * Convert PDF to text using poppler's pdftotext.
     * Returns null on failure or empty output.
     */
    private function pdftotext(string $pdfPath): ?string
    {
        if (!is_file($pdfPath)) return null;

        $cmd = ['pdftotext', '-layout', '-nopgbrk', '-enc', 'UTF-8', $pdfPath, '-'];

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $proc = @proc_open($cmd, $descriptors, $pipes);
        if (!is_resource($proc)) return null;

        @fclose($pipes[0]);
        $out = stream_get_contents($pipes[1]);
        @fclose($pipes[1]);
        $err = stream_get_contents($pipes[2]);
        @fclose($pipes[2]);

        $code = proc_close($proc);
        if ($code !== 0) return null;

        if (!is_string($out) || trim($out) === '') return null;

        return $out;
    }
}

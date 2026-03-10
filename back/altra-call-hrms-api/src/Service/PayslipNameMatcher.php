<?php

namespace App\Service;

use App\Entity\User;

/**
 * Lightweight fuzzy matcher to associate a payslip PDF to the right employee.
 *
 * - source of truth: User.fullName stored in the HR app
 * - input: PDF filename (often contains the name)
 * - tolerant to accents, separators, order inversion, and small typos
 */
class PayslipNameMatcher
{
    /**
     * Keywords frequently present in filenames that should not be part of the employee name.
     */
    private const STOP_WORDS = [
        'fiche', 'paye', 'paie', 'bulletin', 'salaire', 'salary', 'payslip',
        'mensuel', 'mensuelle', 'mois',
        'janvier','fevrier','février','mars','avril','mai','juin','juillet','aout','août','septembre','octobre','novembre','decembre','décembre',
    ];

    public function extractNameCandidateFromFilename(string $filename): string
    {
        $base = preg_replace('/\.[a-zA-Z0-9]{2,5}$/', '', $filename) ?? $filename;
        $base = str_replace(['_', '-', '.', '(', ')', '[', ']', '{', '}', ','], ' ', $base);
        $base = preg_replace('/\s+/', ' ', $base) ?? $base;

        // Remove obvious date patterns
        $base = preg_replace('/\b(19|20)\d{2}\b/', ' ', $base) ?? $base; // year
        $base = preg_replace('/\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/', ' ', $base) ?? $base; // dd-mm-yyyy etc
        $base = preg_replace('/\b\d{6}\b/', ' ', $base) ?? $base; // 032026
        $base = preg_replace('/\b\d{1,2}\b/', ' ', $base) ?? $base; // standalone numbers
        $base = preg_replace('/\s+/', ' ', $base) ?? $base;

        $tokens = array_values(array_filter(explode(' ', trim($base))));
        $clean = [];
        $stop = array_map([$this, 'normalize'], self::STOP_WORDS);
        foreach ($tokens as $t) {
            $n = $this->normalize($t);
            if ($n === '') continue;
            if (in_array($n, $stop, true)) continue;
            if (strlen($n) < 2) continue;
            $clean[] = $t;
        }
        return trim(implode(' ', $clean));
    }

    /**
     * @param User[] $users
     * @return array{candidate?:string, best?:array, top?:array<int,array>, ambiguous:bool}
     */
    public function match(string $filename, array $users): array
    {
        $candidate = $this->extractNameCandidateFromFilename($filename);
        return $this->matchCandidate($candidate, $users);
    }

    /**
     * Match a full name candidate (coming from PDF text extraction or elsewhere).
     *
     * @param User[] $users
     * @return array{candidate?:string, best?:array, top?:array<int,array>, ambiguous:bool}
     */
    public function matchCandidate(string $candidate, array $users): array
    {
        $candNorm = $this->normalize($candidate);
        if ($candNorm === '' || count($users) === 0) {
            return ['ambiguous' => false, 'top' => [], 'candidate' => $candidate];
        }

        $scores = [];
        foreach ($users as $u) {
            $full = trim((string)($u->getFullName() ?? ''));
            if ($full === '') continue;
            $fullNorm = $this->normalize($full);
            $s = $this->bestSimilarity($candNorm, $fullNorm);
            $scores[] = [
                'user' => $u,
                'score' => $s,
                'fullName' => $full,
            ];
        }

        usort($scores, fn($a, $b) => $b['score'] <=> $a['score']);
        $top = array_slice($scores, 0, 5);
        $best = $top[0] ?? null;

        $ambiguous = false;
        if ($best && isset($top[1])) {
            $ambiguous = (($best['score'] - $top[1]['score']) < 0.03) && ($best['score'] >= 0.85);
        }

        return [
            'candidate' => $candidate,
            'best' => $best,
            'top' => array_map(function ($x) {
                /** @var User $u */
                $u = $x['user'];
                return [
                    'userId' => (string)$u->getId(),
                    'fullName' => $x['fullName'],
                    'score' => round((float)$x['score'], 4),
                ];
            }, $top),
            'ambiguous' => $ambiguous,
        ];
    }

    private function normalize(string $s): string
    {
        $s = trim(mb_strtolower($s));
        if ($s === '') return '';
        $t = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
        if ($t !== false) $s = $t;
        $s = preg_replace('/[^a-z\s]/', ' ', $s) ?? $s;
        $s = preg_replace('/\s+/', ' ', $s) ?? $s;
        return trim($s);
    }

    private function bestSimilarity(string $a, string $b): float
    {
        $direct = $this->similarity($a, $b);
        $sorted = $this->similarity($this->sortTokens($a), $this->sortTokens($b));
        $init = $this->similarity($this->initials($a), $this->initials($b));
        return max($direct, $sorted, $init);
    }

    private function sortTokens(string $s): string
    {
        $t = array_values(array_filter(explode(' ', trim($s))));
        sort($t);
        return implode(' ', $t);
    }

    private function initials(string $s): string
    {
        $t = array_values(array_filter(explode(' ', trim($s))));
        $out = '';
        foreach ($t as $w) {
            $out .= $w[0] ?? '';
        }
        return $out;
    }

    private function similarity(string $a, string $b): float
    {
        $a = trim($a);
        $b = trim($b);
        if ($a === '' || $b === '') return 0.0;
        if ($a === $b) return 1.0;
        $max = max(strlen($a), strlen($b));
        if ($max === 0) return 0.0;
        $dist = levenshtein($a, $b);
        $sim = 1.0 - ($dist / $max);
        return max(0.0, min(1.0, $sim));
    }
}

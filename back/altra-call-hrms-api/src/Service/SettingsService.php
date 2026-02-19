<?php

namespace App\Service;

use App\Entity\AppSetting;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

class SettingsService
{
    public const KEY_MAIL_NOTIFS = 'mail_notifications';
    public const KEY_ANNUAL_LEAVE_DAYS = 'annual_leave_days';
    public const KEY_EXIT_ENFORCE_HOURS = 'exit_enforce_hours';
    public const KEY_EXIT_WORK_START = 'exit_work_start';
    public const KEY_EXIT_WORK_END = 'exit_work_end';

    // Work week / working days
    public const KEY_WEEKEND_DAYS = 'weekend_days'; // ISO-8601 N values (1=Mon..7=Sun)

    // Leave policy
    public const KEY_LEAVE_MIN_NOTICE_DAYS = 'leave_min_notice_days';
    public const KEY_LEAVE_MAX_DAYS_PER_REQUEST = 'leave_max_days_per_request';
    public const KEY_LEAVE_ALLOW_PAST_DATES = 'leave_allow_past_dates';

    // Leave accrual (monthly)
    // Sick leave policy
    public const KEY_SICK_LEAVE_POLICY_BY_CONTRACT = 'sick_leave_policy_by_contract';
    public const KEY_SICK_LEAVE_DEFAULT_POLICY = 'sick_leave_default_policy';

    // Sick leave annual quota (days/year)
    public const KEY_SICK_LEAVE_ANNUAL_QUOTA_BY_CONTRACT = 'sick_leave_annual_quota_by_contract';
    public const KEY_SICK_LEAVE_DEFAULT_ANNUAL_QUOTA = 'sick_leave_default_annual_quota';

    public const KEY_LEAVE_ACCRUAL_PER_MONTH = 'leave_accrual_per_month';
    public const KEY_LEAVE_DEFAULT_INITIAL_BALANCE = 'leave_default_initial_balance';
    public const KEY_LEAVE_ACCRUAL_CYCLE_DAY = 'leave_accrual_cycle_day';
    public const KEY_LEAVE_ACCRUAL_BY_CONTRACT = 'leave_accrual_by_contract';

    public function __construct(private EntityManagerInterface $em) {}

    /** @return mixed */
    public function get(string $key, $default = null)
    {
        $row = $this->em->getRepository(AppSetting::class)->findOneBy(['keyName' => $key]);
        return $row ? $row->getValue() : $default;
    }

    public function set(string $key, $value): void
    {
        $repo = $this->em->getRepository(AppSetting::class);
        /** @var AppSetting|null $row */
        $row = $repo->findOneBy(['keyName' => $key]);
        if (!$row) {
            $row = new AppSetting();
            $row->setKeyName($key);
            $this->em->persist($row);
        }

        $row->setValue($value);
        $this->em->flush();
    }

    /** @return int[] ISO-8601 N values */
    public function getWeekendDays(): array
    {
        $v = $this->get(self::KEY_WEEKEND_DAYS, [6, 7]);
        if (!is_array($v) || count($v) === 0) {
            return [6, 7];
        }

        $out = [];
        foreach ($v as $x) {
            $n = (int) $x;
            if ($n >= 1 && $n <= 7) {
                $out[] = $n;
            }
        }

        $out = array_values(array_unique($out));
        sort($out);
        return $out ?: [6, 7];
    }

    public function leaveMinNoticeDays(): int
    {
        $v = (int) $this->get(self::KEY_LEAVE_MIN_NOTICE_DAYS, 0);
        if ($v < 0) $v = 0;
        if ($v > 365) $v = 365;
        return $v;
    }

    public function leaveMaxDaysPerRequest(): int
    {
        $v = (int) $this->get(self::KEY_LEAVE_MAX_DAYS_PER_REQUEST, 60);
        if ($v < 1) $v = 1;
        if ($v > 365) $v = 365;
        return $v;
    }

    public function leaveAllowPastDates(): bool
    {
        return (bool) $this->get(self::KEY_LEAVE_ALLOW_PAST_DATES, false);
    }

    /** Monthly accrual rate (days/month). 0 disables accrual logic. */
    public function leaveAccrualPerMonth(): float
    {
        $v = (float) $this->get(self::KEY_LEAVE_ACCRUAL_PER_MONTH, 0.0);
        if ($v < 0) $v = 0;
        if ($v > 10) $v = 10;
        return $v;
    }

    /** Default initial leave balance applied when creating a new employee (if not specified). */
    public function leaveDefaultInitialBalance(): float
    {
        $v = (float) $this->get(self::KEY_LEAVE_DEFAULT_INITIAL_BALANCE, 0.0);
        if ($v < 0) $v = 0;
        if ($v > 365) $v = 365;
        return $v;
    }


    /** Day of month (1-28) that defines the leave accrual cycle boundary. Example: 21 means cycle is 21 -> 21. */
    public function leaveAccrualCycleDay(): int
    {
        $v = (int) $this->get(self::KEY_LEAVE_ACCRUAL_CYCLE_DAY, 21);
        if ($v < 1) $v = 1;
        if ($v > 28) $v = 28;
        return $v;
    }

    /** Map of contractType => monthly accrual rate (days/month). */
    public function leaveAccrualByContract(): array
    {
        $m = $this->get(self::KEY_LEAVE_ACCRUAL_BY_CONTRACT, null);
        if (!is_array($m)) return [];
        $out = [];
        foreach ($m as $k => $v) {
            $key = strtoupper(trim((string)$k));
            if ($key === '') continue;
            $f = (float)$v;
            if ($f < 0) $f = 0;
            if ($f > 10) $f = 10;
            $out[$key] = $f;
        }
        return $out;
    }

    /** Resolve monthly accrual rate for a given contract type (falls back to leaveAccrualPerMonth()). */
    public function leaveAccrualPerMonthForContract(?string $contractType): float
    {
        $base = $this->leaveAccrualPerMonth();
        if (!$contractType) return $base;
        $map = $this->leaveAccrualByContract();
        $key = strtoupper(trim($contractType));
        if ($key !== '' && array_key_exists($key, $map)) return (float)$map[$key];
        return $base;
    }

    /** Compute accrued annual leave allowance for a user for a given year (initial balance + monthly accrual cycles). */
    public function accruedAnnualAllowanceForUser(User $u, int $year, ?\DateTimeImmutable $asOf = null): float
    {
        $accrual = $this->leaveAccrualPerMonthForContract(method_exists($u, 'getContractType') ? $u->getContractType() : null);
        if ($accrual <= 0) {
            return (float)$u->getLeaveInitialBalance();
        }

        $cycleDay = $this->leaveAccrualCycleDay();
        $today = $asOf ?: new \DateTimeImmutable('today');

        $from = new \DateTimeImmutable(sprintf('%04d-01-01', $year));
        $to   = new \DateTimeImmutable(sprintf('%04d-12-31', $year));

        $hire = $u->getHireDate() ?: ($u->getCreatedAt() instanceof \DateTimeImmutable ? $u->getCreatedAt() : new \DateTimeImmutable('today'));
        $start = $hire > $from ? $hire : $from;

        // Accrue only up to "today" for current year (no future accrual)
        $periodEnd = $to;
        if ((int)$today->format('Y') === $year && $today < $periodEnd) {
            $periodEnd = $today;
        }

        // Find first boundary (cycleDay) on/after $start.
        $boundaryThisMonth = (new \DateTimeImmutable($start->format('Y-m-01')))
            ->setDate((int)$start->format('Y'), (int)$start->format('m'), $cycleDay);

        $periodStart = ($start <= $boundaryThisMonth) ? $boundaryThisMonth : $boundaryThisMonth->modify('+1 month');

        // Count completed cycles: each time we pass a boundary after periodStart.
        $months = 0;
        if ($periodEnd > $periodStart) {
            $cursor = $periodStart->modify('+1 month');
            while ($cursor <= $periodEnd) {
                $months++;
                $cursor = $cursor->modify('+1 month');
            }
        }

        $allow = (float)$u->getLeaveInitialBalance() + ($months * $accrual);
        if ($allow < 0) $allow = 0;
        if ($allow > 3650) $allow = 3650;
        return $allow;
    }

    /** Default sick leave policy. Values: OWN (separate balance) or ANNUAL (deduct from annual leave). */
    public function sickLeaveDefaultPolicy(): string
    {
        $v = strtoupper(trim((string)$this->get(self::KEY_SICK_LEAVE_DEFAULT_POLICY, 'OWN')));
        return in_array($v, ['OWN','ANNUAL'], true) ? $v : 'OWN';
    }

    /** Map of contractType => policy (OWN|ANNUAL). */
    public function sickLeavePolicyByContract(): array
    {
        $m = $this->get(self::KEY_SICK_LEAVE_POLICY_BY_CONTRACT, null);
        if (!is_array($m)) return [];
        $out = [];
        foreach ($m as $k => $v) {
            $key = strtoupper(trim((string)$k));
            if ($key === '') continue;
            $p = strtoupper(trim((string)$v));
            if (!in_array($p, ['OWN','ANNUAL'], true)) $p = $this->sickLeaveDefaultPolicy();
            $out[$key] = $p;
        }
        return $out;
    }

    /** Resolve sick leave policy for a given contract type (falls back to default). */
    public function sickLeavePolicyForContract(?string $contractType): string
    {
        $def = $this->sickLeaveDefaultPolicy();
        if (!$contractType) return $def;
        $map = $this->sickLeavePolicyByContract();
        $key = strtoupper(trim((string)$contractType));
        if ($key !== '' && array_key_exists($key, $map)) return (string)$map[$key];
        return $def;
    }

    /** Convenience: is sick leave deducted from annual balance for user? */
    public function sickLeaveCountsAsAnnual(User $u): bool
    {
        $ct = method_exists($u, 'getContractType') ? $u->getContractType() : null;
        return $this->sickLeavePolicyForContract($ct) === 'ANNUAL';
    }

    /** Default sick annual quota (days/year) used when policy=OWN and contract isn't mapped. */
    public function sickLeaveDefaultAnnualQuota(): float
    {
        $v = (float)$this->get(self::KEY_SICK_LEAVE_DEFAULT_ANNUAL_QUOTA, 0.0);
        if ($v < 0) $v = 0;
        if ($v > 365) $v = 365;
        return $v;
    }

    /** Map of contractType => annual quota (days/year). */
    public function sickLeaveAnnualQuotaByContract(): array
    {
        $m = $this->get(self::KEY_SICK_LEAVE_ANNUAL_QUOTA_BY_CONTRACT, null);
        if (!is_array($m)) return [];
        $out = [];
        foreach ($m as $k => $v) {
            $key = strtoupper(trim((string)$k));
            if ($key === '') continue;
            $f = (float)$v;
            if ($f < 0) $f = 0;
            if ($f > 365) $f = 365;
            $out[$key] = $f;
        }
        return $out;
    }

    /** Resolve sick annual quota for a contract type (falls back to default). */
    public function sickLeaveAnnualQuotaForContract(?string $contractType): float
    {
        $def = $this->sickLeaveDefaultAnnualQuota();
        if (!$contractType) return $def;
        $map = $this->sickLeaveAnnualQuotaByContract();
        $key = strtoupper(trim((string)$contractType));
        if ($key !== '' && array_key_exists($key, $map)) return (float)$map[$key];
        return $def;
    }

    public function roleBucket(User $u): string
    {
        $roles = $u->getRoles();
        if (in_array('ROLE_ADMIN', $roles, true)) return 'admin';
        if (in_array('ROLE_SUPERIOR', $roles, true) || in_array('ROLE_MANAGER', $roles, true)) return 'manager';
        return 'employee';
    }

    public function canSendEmail(User $u, string $type): bool
    {
        $map = $this->get(self::KEY_MAIL_NOTIFS, null);
        if (!is_array($map)) return true; // default on

        $bucket = $this->roleBucket($u);
        $type = strtoupper($type);

        // support either map[bucket][TYPE] or map[bucket]['ALL']
        $b = $map[$bucket] ?? null;
        if (!is_array($b)) return true;
        if (array_key_exists($type, $b)) return (bool) $b[$type];
        if (array_key_exists('ALL', $b)) return (bool) $b['ALL'];
        return true;
    }
}

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

    public function roleBucket(User $u): string
    {
        $roles = $u->getRoles();
        if (in_array('ROLE_ADMIN', $roles, true)) return 'admin';
        if (in_array('ROLE_SUPERIOR', $roles, true)) return 'manager';
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

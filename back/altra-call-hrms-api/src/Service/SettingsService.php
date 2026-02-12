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
        if (array_key_exists($type, $b)) return (bool)$b[$type];
        if (array_key_exists('ALL', $b)) return (bool)$b['ALL'];
        return true;
    }
}

<?php

namespace App\Controller;

use App\Service\SettingsService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class SettingsController extends ApiBase
{
    public function __construct(private EntityManagerInterface $em, private SettingsService $settings) {}

    private function requireAdmin(Request $request): void
    {
        $u = $this->requireUser($request);
        if (!in_array('ROLE_ADMIN', $u->roles ?? [], true)) {
            throw $this->createAccessDeniedException('Admin only');
        }
    }

    #[Route('/api/settings', methods: ['GET'])]
    public function getAll(Request $request): JsonResponse
    {
        $this->requireAdmin($request);

        $data = [
            'mailNotifications' => $this->settings->get(SettingsService::KEY_MAIL_NOTIFS, [
                'employee' => ['ALL' => true],
                'manager'  => ['ALL' => true],
                'admin'    => ['ALL' => true],
            ]),
            'workWeek' => [
                'weekendDays' => $this->settings->getWeekendDays(),
            ],
            'leaveRules' => [
                'minNoticeDays' => $this->settings->leaveMinNoticeDays(),
                'maxDaysPerRequest' => $this->settings->leaveMaxDaysPerRequest(),
                'allowPastDates' => $this->settings->leaveAllowPastDates(),
            ],
            'leaveAccrual' => [
                'perMonth' => $this->settings->leaveAccrualPerMonth(),
                'defaultInitialBalance' => $this->settings->leaveDefaultInitialBalance(),
                'cycleDay' => $this->settings->leaveAccrualCycleDay(),
                'byContract' => $this->settings->leaveAccrualByContract(),
            ],
            'sickLeave' => [
                'defaultPolicy' => $this->settings->sickLeaveDefaultPolicy(),
                'byContract' => $this->settings->sickLeavePolicyByContract(),
                'defaultAnnualQuotaDays' => $this->settings->sickLeaveDefaultAnnualQuota(),
                'annualQuotaByContract' => $this->settings->sickLeaveAnnualQuotaByContract(),
            ],
            'exit' => [
                'enforceHours' => (bool)$this->settings->get(SettingsService::KEY_EXIT_ENFORCE_HOURS, false),
                'workStart' => (string)$this->settings->get(SettingsService::KEY_EXIT_WORK_START, '08:00'),
                'workEnd'   => (string)$this->settings->get(SettingsService::KEY_EXIT_WORK_END, '18:00'),
            ],
        ];

        return $this->jsonOk($data);
    }

    #[Route('/api/settings', methods: ['PUT'])]
    public function update(Request $request): JsonResponse
    {
        $this->requireAdmin($request);
        $data = json_decode((string)$request->getContent(), true) ?: [];

        if (isset($data['mailNotifications']) && is_array($data['mailNotifications'])) {
            $this->settings->set(SettingsService::KEY_MAIL_NOTIFS, $data['mailNotifications']);
        }

        if (isset($data['workWeek']) && is_array($data['workWeek'])) {
            $w = $data['workWeek'];
            if (isset($w['weekendDays']) && is_array($w['weekendDays'])) {
                $vals = [];
                foreach ($w['weekendDays'] as $x) {
                    $n = (int)$x;
                    if ($n >= 1 && $n <= 7) $vals[] = $n;
                }
                $vals = array_values(array_unique($vals));
                sort($vals);
                if (count($vals) === 0) $vals = [6,7];
                $this->settings->set(SettingsService::KEY_WEEKEND_DAYS, $vals);
            }
        }

        if (isset($data['leaveRules']) && is_array($data['leaveRules'])) {
            $lr = $data['leaveRules'];
            if (array_key_exists('minNoticeDays', $lr)) {
                $v = (int)$lr['minNoticeDays'];
                if ($v < 0) $v = 0;
                if ($v > 365) $v = 365;
                $this->settings->set(SettingsService::KEY_LEAVE_MIN_NOTICE_DAYS, $v);
            }
            if (array_key_exists('maxDaysPerRequest', $lr)) {
                $v = (int)$lr['maxDaysPerRequest'];
                if ($v < 1) $v = 1;
                if ($v > 365) $v = 365;
                $this->settings->set(SettingsService::KEY_LEAVE_MAX_DAYS_PER_REQUEST, $v);
            }
            if (array_key_exists('allowPastDates', $lr)) {
                $this->settings->set(SettingsService::KEY_LEAVE_ALLOW_PAST_DATES, (bool)$lr['allowPastDates']);
            }
        }

        if (isset($data['leaveAccrual']) && is_array($data['leaveAccrual'])) {
            $la = $data['leaveAccrual'];
            if (array_key_exists('perMonth', $la)) {
                $v = (float) $la['perMonth'];
                if ($v < 0) $v = 0;
                if ($v > 10) $v = 10;
                $this->settings->set(SettingsService::KEY_LEAVE_ACCRUAL_PER_MONTH, $v);
            }
            if (array_key_exists('defaultInitialBalance', $la)) {
                $v = (float) $la['defaultInitialBalance'];
                if ($v < 0) $v = 0;
                if ($v > 365) $v = 365;
                $this->settings->set(SettingsService::KEY_LEAVE_DEFAULT_INITIAL_BALANCE, $v);
            }
            if (array_key_exists('cycleDay', $la)) {
                $v = (int) $la['cycleDay'];
                if ($v < 1) $v = 1;
                if ($v > 28) $v = 28;
                $this->settings->set(SettingsService::KEY_LEAVE_ACCRUAL_CYCLE_DAY, $v);
            }
            if (array_key_exists('byContract', $la)) {
                $m = $la['byContract'];
                // store as map of contractType => float
                if (!is_array($m)) $m = [];
                $out = [];
                foreach ($m as $k => $v) {
                    $key = strtoupper(trim((string)$k));
                    if ($key === '') continue;
                    $f = (float)$v;
                    if ($f < 0) $f = 0;
                    if ($f > 10) $f = 10;
                    $out[$key] = $f;
                }
                $this->settings->set(SettingsService::KEY_LEAVE_ACCRUAL_BY_CONTRACT, $out);
            }
        }


        if (isset($data['sickLeave']) && is_array($data['sickLeave'])) {
            $sl = $data['sickLeave'];
            if (array_key_exists('defaultPolicy', $sl)) {
                $v = strtoupper(trim((string)$sl['defaultPolicy']));
                if (!in_array($v, ['OWN','ANNUAL'], true)) $v = 'OWN';
                $this->settings->set(SettingsService::KEY_SICK_LEAVE_DEFAULT_POLICY, $v);
            }
            if (array_key_exists('byContract', $sl)) {
                $m = $sl['byContract'];
                if (!is_array($m)) $m = [];
                $out = [];
                foreach ($m as $k => $v) {
                    $key = strtoupper(trim((string)$k));
                    if ($key === '') continue;
                    $p = strtoupper(trim((string)$v));
                    if (!in_array($p, ['OWN','ANNUAL'], true)) $p = 'OWN';
                    $out[$key] = $p;
                }
                $this->settings->set(SettingsService::KEY_SICK_LEAVE_POLICY_BY_CONTRACT, $out);
            }

            if (array_key_exists('defaultAnnualQuotaDays', $sl)) {
                $v = (float)$sl['defaultAnnualQuotaDays'];
                if ($v < 0) $v = 0;
                if ($v > 365) $v = 365;
                $this->settings->set(SettingsService::KEY_SICK_LEAVE_DEFAULT_ANNUAL_QUOTA, $v);
            }

            if (array_key_exists('annualQuotaByContract', $sl)) {
                $m = $sl['annualQuotaByContract'];
                if (!is_array($m)) $m = [];
                $out = [];
                foreach ($m as $k => $v) {
                    $key = strtoupper(trim((string)$k));
                    if ($key === '') continue;
                    $f = (float)$v;
                    if ($f < 0) $f = 0;
                    if ($f > 365) $f = 365;
                    $out[$key] = $f;
                }
                $this->settings->set(SettingsService::KEY_SICK_LEAVE_ANNUAL_QUOTA_BY_CONTRACT, $out);
            }
        }

        if (isset($data['exit']) && is_array($data['exit'])) {
            $e = $data['exit'];
            if (array_key_exists('enforceHours', $e)) {
                $this->settings->set(SettingsService::KEY_EXIT_ENFORCE_HOURS, (bool)$e['enforceHours']);
            }
            if (isset($e['workStart'])) {
                $this->settings->set(SettingsService::KEY_EXIT_WORK_START, (string)$e['workStart']);
            }
            if (isset($e['workEnd'])) {
                $this->settings->set(SettingsService::KEY_EXIT_WORK_END, (string)$e['workEnd']);
            }
        }

        $this->em->flush();
        return $this->jsonOk(['ok' => true]);
    }
}

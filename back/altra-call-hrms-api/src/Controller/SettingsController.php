<?php

namespace App\Controller;

use App\Entity\LeaveType;
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
            'annualLeaveDays' => $this->settings->get(SettingsService::KEY_ANNUAL_LEAVE_DAYS, 18),
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

        if (isset($data['annualLeaveDays'])) {
            $v = (float)$data['annualLeaveDays'];
            if ($v < 0) $v = 0;
            if ($v > 60) $v = 60;
            $this->settings->set(SettingsService::KEY_ANNUAL_LEAVE_DAYS, $v);

            // also sync LeaveType ANNUAL allowance for consistency
            $t = $this->em->getRepository(LeaveType::class)->findOneBy(['code' => 'ANNUAL']);
            if ($t) {
                $t->setAnnualAllowance($v);
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

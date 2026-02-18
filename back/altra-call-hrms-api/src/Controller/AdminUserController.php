<?php

namespace App\Controller;

use App\Entity\User;
use App\Entity\Department;
use App\Service\SettingsService;
use App\Service\LeaveNotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class AdminUserController extends ApiBase
{
    private function requireAdmin(Request $request): void
    {
        $u = $this->requireUser($request);
        $roles = $u->roles ?? [];
        if (!in_array('ROLE_ADMIN', $roles, true)) {
            throw $this->createAccessDeniedException('Admin only');
        }
    }

    #[Route('/api/admin/users', name: 'api_admin_users_list', methods: ['GET'])]
    public function list(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $this->requireAdmin($request);

        $pg = $this->parsePagination($request);
        $q = trim((string)$request->query->get('q', ''));

        if (!$pg['enabled']) {
            $users = $em->getRepository(User::class)->findBy([], ['id' => 'DESC']);
            $items = array_map(fn(User $u) => [
                'id' => (string)$u->getId(),
                'email' => $u->getEmail(),
                'fullName' => $u->getFullName(),
                'roles' => $u->getRoles(),
                'netSalary' => $u->getNetSalary(),
                'hireDate' => $u->getHireDate()?->format('Y-m-d'),
                'leaveInitialBalance' => $u->getLeaveInitialBalance(),
                'contractType' => method_exists($u,'getContractType') ? $u->getContractType() : null,
                'departmentId' => $u->getDepartment()?->getId() ? (string)$u->getDepartment()->getId() : null,
                'managerId' => $u->getManager()?->getId() ? (string)$u->getManager()->getId() : null,
                'manager2Id' => $u->getManager2()?->getId() ? (string)$u->getManager2()->getId() : null,
            ], $users);
            return $this->jsonOk(['items' => $items]);
        }

        $qb = $em->createQueryBuilder()
            ->select('u')
            ->from(User::class, 'u')
            ->orderBy('u.id', 'DESC')
            ->setFirstResult($pg['offset'])
            ->setMaxResults($pg['limit']);

        if ($q !== '') {
            $qb->andWhere('LOWER(u.email) LIKE :q OR LOWER(u.fullName) LIKE :q')
               ->setParameter('q', '%'.mb_strtolower($q).'%');
        }

        $users = $qb->getQuery()->getResult();

        $countQb = $em->createQueryBuilder()
            ->select('COUNT(u2.id)')
            ->from(User::class, 'u2');

        if ($q !== '') {
            $countQb->where('LOWER(u2.email) LIKE :q OR LOWER(u2.fullName) LIKE :q')
                    ->setParameter('q', '%'.mb_strtolower($q).'%');
        }

        $total = (int)$countQb->getQuery()->getSingleScalarResult();

        $items = array_map(fn(User $u) => [
            'id' => (string)$u->getId(),
            'email' => $u->getEmail(),
            'fullName' => $u->getFullName(),
            'roles' => $u->getRoles(),
            'netSalary' => $u->getNetSalary(),
            'hireDate' => $u->getHireDate()?->format('Y-m-d'),
            'leaveInitialBalance' => $u->getLeaveInitialBalance(),
                'contractType' => method_exists($u,'getContractType') ? $u->getContractType() : null,
            'departmentId' => $u->getDepartment()?->getId() ? (string)$u->getDepartment()->getId() : null,
            'managerId' => $u->getManager()?->getId() ? (string)$u->getManager()->getId() : null,
            'manager2Id' => $u->getManager2()?->getId() ? (string)$u->getManager2()->getId() : null,
        ], $users);

        return $this->jsonOk([
            'items' => $items,
            'meta' => [
                'page' => $pg['page'],
                'limit' => $pg['limit'],
                'total' => $total,
                'pages' => (int)ceil($total / max(1,$pg['limit'])),
            ]
        ]);
    }

    

    #[Route('/api/admin/users', name: 'api_admin_users_create', methods: ['POST'])]
    public function create(Request $request, EntityManagerInterface $em, SettingsService $settings, LeaveNotificationService $notifier): JsonResponse
    {
        $this->requireAdmin($request);
        $data = json_decode((string)$request->getContent(), true) ?: [];

        $email = strtolower(trim((string)($data['email'] ?? '')));
        $password = (string)($data['password'] ?? '');
        $fullName = trim((string)($data['fullName'] ?? ''));
        $roles = $data['roles'] ?? ['ROLE_EMPLOYEE'];
        $departmentId = $data['departmentId'] ?? null;
        $managerId = $data['managerId'] ?? null;
        $manager2Id = $data['manager2Id'] ?? null;
        $hireDateStr = (string)($data['hireDate'] ?? '');
        $contractType = (string)($data['contractType'] ?? '');
        $initialLeaveBalance = $data['initialLeaveBalance'] ?? null;
        if (!is_array($roles) || count($roles) === 0) $roles = ['ROLE_EMPLOYEE'];

        if ($email === '' || $password === '') {
            return $this->json(['error' => 'email/password required'], 400);
        }

        $existing = $em->getRepository(User::class)->findOneBy(['email' => $email]);
        if ($existing) {
            return $this->json(['error' => 'email_exists'], 409);
        }

        $u = new User();
        $u->setEmail($email);
        $u->setFullName($fullName !== '' ? $fullName : $email);
        if (method_exists($u,'setContractType')) { $u->setContractType($contractType); }
        $u->setRoles($roles);
        $u->setPasswordHash(password_hash($password, PASSWORD_BCRYPT));
        $u->setApiKey(bin2hex(random_bytes(24)));
        $u->setCreatedAt(new \DateTimeImmutable());

        // Hire date + initial leave balance are defined only at employee creation.
        // If not provided, we apply sensible defaults.
        try {
            $u->setHireDate($hireDateStr ? new \DateTimeImmutable($hireDateStr) : new \DateTimeImmutable('today'));
        } catch (\Throwable) {
            $u->setHireDate(new \DateTimeImmutable('today'));
        }

        $init = $initialLeaveBalance === null || $initialLeaveBalance === ''
            ? $settings->leaveDefaultInitialBalance()
            : (float)$initialLeaveBalance;
        if ($init < 0) $init = 0;
        if ($init > 365) $init = 365;
        $u->setLeaveInitialBalance($init);

        if ($departmentId) {
            $dept = $em->getRepository(Department::class)->find($departmentId);
            if ($dept) $u->setDepartment($dept);
        }
        if ($managerId) {
            $m = $em->getRepository(User::class)->find($managerId);
            if ($m) $u->setManager($m);
        }
        if ($manager2Id) {
            $m2 = $em->getRepository(User::class)->find($manager2Id);
            if ($m2) $u->setManager2($m2);
        }

        $em->persist($u);
        $em->flush();

        // Send welcome email with credentials (best-effort)
        $loginUrl = rtrim((string)($_ENV['FRONTEND_URL'] ?? $_SERVER['FRONTEND_URL'] ?? ''), '/') . '/login';
        $subject = 'Votre compte AltraCall HRMS';
        $pwdPlain = (string)$data['password'];
        $html = '<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto">'
            . '<h2 style="margin:0 0 10px">Bienvenue sur AltraCall HRMS</h2>'
            . '<p>Bonjour <strong>'.htmlspecialchars($u->getFullName() ?: $u->getEmail(), ENT_QUOTES|ENT_SUBSTITUTE, 'UTF-8').'</strong>,</p>'
            . '<p>Votre compte a été créé. Voici vos informations de connexion :</p>'
            . '<ul>'
            . '<li><strong>Email :</strong> '.htmlspecialchars($u->getEmail(), ENT_QUOTES|ENT_SUBSTITUTE, 'UTF-8').'</li>'
            . '<li><strong>Mot de passe :</strong> '.htmlspecialchars($pwdPlain, ENT_QUOTES|ENT_SUBSTITUTE, 'UTF-8').'</li>'
            . '</ul>'
            . '<p style="margin:14px 0">Nous vous recommandons de changer votre mot de passe après votre première connexion.</p>'
            . (strpos($loginUrl, 'http')===0 ? '<p><a href="'.htmlspecialchars($loginUrl, ENT_QUOTES|ENT_SUBSTITUTE, 'UTF-8').'" style="display:inline-block;background:#0d6efd;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">Se connecter</a></p>' : '')
            . '<p style="color:#6c757d;font-size:12px;margin-top:24px">Cet email a été envoyé automatiquement — merci de ne pas répondre.</p>'
            . '</div>';
        $notifier->notify($u->getEmail(), $subject, $html);


        $forceLogout = false;
        if ($token && ($token->apiKey === $originalApiKey)) {
            if ($originalRoles !== $u->getRoles()) {
                $forceLogout = true;
            }
            if ($originalApiKey !== $u->getApiKey()) {
                $forceLogout = true;
            }
        }

        return $this->jsonOk([
            'forceLogout' => $forceLogout,

            'user' => [
                'id' => (string)$u->getId(),
                'email' => $u->getEmail(),
                'fullName' => $u->getFullName(),
                'roles' => $u->getRoles(),
                'netSalary' => $u->getNetSalary(),
                'hireDate' => $u->getHireDate()?->format('Y-m-d'),
                'leaveInitialBalance' => $u->getLeaveInitialBalance(),
                'contractType' => method_exists($u,'getContractType') ? $u->getContractType() : null,
            'department' => $u->getDepartment() ? ['id' => (string)$u->getDepartment()->getId(), 'name' => $u->getDepartment()->getName()] : null,
            'manager' => $u->getManager() ? ['id' => (string)$u->getManager()->getId(), 'fullName' => $u->getManager()->getFullName(), 'email' => $u->getManager()->getEmail()] : null,
            'manager2' => $u->getManager2() ? ['id' => (string)$u->getManager2()->getId(), 'fullName' => $u->getManager2()->getFullName(), 'email' => $u->getManager2()->getEmail()] : null,
                'createdAt' => $u->getCreatedAt()->format('c'),
            ]
        ], 201);
    }

    #[Route('/api/admin/users/{id}', name: 'api_admin_users_update', methods: ['PUT'])]
    public function update(string $id, Request $request, EntityManagerInterface $em): JsonResponse
    {
        $token = $this->requireUser($request);
        $this->requireAdmin($request);
        $data = json_decode((string)$request->getContent(), true) ?: [];

        /** @var User|null $u */
        $u = $em->getRepository(User::class)->find($id);
        if (!$u) return $this->json(['error' => 'not_found'], 404);

        $originalRoles = $u->getRoles();
        $originalApiKey = $u->getApiKey();

        if (isset($data['email'])) {
            $email = strtolower(trim((string)$data['email']));
            if ($email === '') return $this->json(['error' => 'email_required'], 400);
            $other = $em->getRepository(User::class)->findOneBy(['email' => $email]);
            if ($other && (string)$other->getId() !== (string)$u->getId()) {
                return $this->json(['error' => 'email_exists'], 409);
            }
            $u->setEmail($email);
        }
        if (isset($data['fullName'])) {
            $fullName = trim((string)$data['fullName']);
            $u->setFullName($fullName !== '' ? $fullName : $u->getEmail());
        }

        if (array_key_exists('departmentId', $data)) {
            $departmentId = $data['departmentId'];
            if ($departmentId) {
                $dept = $em->getRepository(Department::class)->find($departmentId);
                $u->setDepartment($dept ?: null);
            } else {
                $u->setDepartment(null);
            }
        }
        if (array_key_exists('managerId', $data)) {
            $managerId = $data['managerId'];
            if ($managerId) {
                $m = $em->getRepository(User::class)->find($managerId);
                $u->setManager($m ?: null);
            } else {
                $u->setManager(null);
            }
        }
        if (array_key_exists('manager2Id', $data)) {
            $manager2Id = $data['manager2Id'];
            if ($manager2Id) {
                $m2 = $em->getRepository(User::class)->find($manager2Id);
                $u->setManager2($m2 ?: null);
            } else {
                $u->setManager2(null);
            }
        }

        if (array_key_exists('netSalary', $data)) {
            $v = $data['netSalary'];
            $u->setNetSalary($v === null || $v === '' ? null : (float)$v);
        }

        if (array_key_exists('hireDate', $data)) {
            $hireDateStr = $data['hireDate'];
            if ($hireDateStr) {
                try { $u->setHireDate(new \DateTimeImmutable((string)$hireDateStr)); } catch (\Throwable) {}
            } else {
                $u->setHireDate(null);
            }
        }

        if (array_key_exists('contractType', $data)) {
            $v = (string)($data['contractType'] ?? '');
            if (method_exists($u,'setContractType')) { $u->setContractType($v); }
        }

        if (array_key_exists('initialLeaveBalance', $data)) {
            $v = $data['initialLeaveBalance'];
            if ($v === null || $v === '') {
                // keep existing
            } else {
                $f = (float)$v;
                if ($f < 0) $f = 0; if ($f > 365) $f = 365;
                $u->setLeaveInitialBalance($f);
            }
        }

        if (isset($data['roles']) && is_array($data['roles']) && count($data['roles']) > 0) {
            $u->setRoles($data['roles']);
        }
        if (isset($data['password']) && (string)$data['password'] !== '') {
            $u->setPasswordHash(password_hash((string)$data['password'], PASSWORD_BCRYPT));
        }
        if (!empty($data['rotateApiKey'])) {
            $u->setApiKey(bin2hex(random_bytes(24)));
        }

        $em->flush();

        $forceLogout = false;
        if ($token && ($token->apiKey === $originalApiKey)) {
            if ($originalRoles !== $u->getRoles()) {
                $forceLogout = true;
            }
            if ($originalApiKey !== $u->getApiKey()) {
                $forceLogout = true;
            }
        }

        return $this->jsonOk([
            'forceLogout' => $forceLogout,

            'user' => [
                'id' => (string)$u->getId(),
                'email' => $u->getEmail(),
                'fullName' => $u->getFullName(),
                'roles' => $u->getRoles(),
                'netSalary' => $u->getNetSalary(),
                'hireDate' => $u->getHireDate()?->format('Y-m-d'),
                'leaveInitialBalance' => $u->getLeaveInitialBalance(),
                'contractType' => method_exists($u,'getContractType') ? $u->getContractType() : null,
            'department' => $u->getDepartment() ? ['id' => (string)$u->getDepartment()->getId(), 'name' => $u->getDepartment()->getName()] : null,
            'manager' => $u->getManager() ? ['id' => (string)$u->getManager()->getId(), 'fullName' => $u->getManager()->getFullName(), 'email' => $u->getManager()->getEmail()] : null,
            'manager2' => $u->getManager2() ? ['id' => (string)$u->getManager2()->getId(), 'fullName' => $u->getManager2()->getFullName(), 'email' => $u->getManager2()->getEmail()] : null,
                'createdAt' => $u->getCreatedAt()->format('c'),
            ]
        ]);
    }

    #[Route('/api/admin/users/{id}', name: 'api_admin_users_delete', methods: ['DELETE'])]
    public function delete(string $id, Request $request, EntityManagerInterface $em): JsonResponse
    {
        $this->requireAdmin($request);

        /** @var User|null $u */
        $u = $em->getRepository(User::class)->find($id);
        if (!$u) return $this->json(['error' => 'not_found'], 404);

        $originalRoles = $u->getRoles();
        $originalApiKey = $u->getApiKey();

        $em->remove($u);
        $em->flush();

        $forceLogout = false;
        if ($token && ($token->apiKey === $originalApiKey)) {
            if ($originalRoles !== $u->getRoles()) {
                $forceLogout = true;
            }
            if ($originalApiKey !== $u->getApiKey()) {
                $forceLogout = true;
            }
        }

        return $this->jsonOk([
            'forceLogout' => $forceLogout,
'ok' => true]);
    }
}

<?php

namespace App\Controller;

use App\Entity\User;
use App\Entity\Department;
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

        $users = $em->getRepository(User::class)->findBy([], ['id' => 'DESC']);
        $items = array_map(fn(User $u) => [
            'id' => (string)$u->getId(),
            'email' => $u->getEmail(),
            'fullName' => $u->getFullName(),
            'roles' => $u->getRoles(),
            'apiKey' => $u->getApiKey(),
            'department' => $u->getDepartment() ? ['id' => (string)$u->getDepartment()->getId(), 'name' => $u->getDepartment()->getName()] : null,
            'manager' => $u->getManager() ? ['id' => (string)$u->getManager()->getId(), 'fullName' => $u->getManager()->getFullName(), 'email' => $u->getManager()->getEmail()] : null,
            'manager2' => $u->getManager2() ? ['id' => (string)$u->getManager2()->getId(), 'fullName' => $u->getManager2()->getFullName(), 'email' => $u->getManager2()->getEmail()] : null,
            'createdAt' => $u->getCreatedAt()->format('c'),
        ], $users);

        return $this->jsonOk(['items' => $items]);
    }

    #[Route('/api/admin/users', name: 'api_admin_users_create', methods: ['POST'])]
    public function create(Request $request, EntityManagerInterface $em): JsonResponse
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
        $u->setRoles($roles);
        $u->setPasswordHash(password_hash($password, PASSWORD_BCRYPT));
        $u->setApiKey(bin2hex(random_bytes(24)));
        $u->setCreatedAt(new \DateTimeImmutable());

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

        return $this->jsonOk([
            'user' => [
                'id' => (string)$u->getId(),
                'email' => $u->getEmail(),
                'fullName' => $u->getFullName(),
                'roles' => $u->getRoles(),
                'apiKey' => $u->getApiKey(),
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
        $this->requireAdmin($request);
        $data = json_decode((string)$request->getContent(), true) ?: [];

        /** @var User|null $u */
        $u = $em->getRepository(User::class)->find($id);
        if (!$u) return $this->json(['error' => 'not_found'], 404);

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

        return $this->jsonOk([
            'user' => [
                'id' => (string)$u->getId(),
                'email' => $u->getEmail(),
                'fullName' => $u->getFullName(),
                'roles' => $u->getRoles(),
                'apiKey' => $u->getApiKey(),
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

        $em->remove($u);
        $em->flush();

        return $this->jsonOk(['ok' => true]);
    }
}

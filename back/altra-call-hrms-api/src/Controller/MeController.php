<?php

namespace App\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

class MeController extends ApiBase
{
    #[Route('/api/me', methods: ['GET'])]
    public function me(Request $request, EntityManagerInterface $em): JsonResponse
    {
        // Return DB user to include fullName/email reliably
        $u = $this->requireDbUser($request, $em);

        return $this->jsonOk([
            'id' => (string)$u->getId(),
            'fullName' => (string)($u->getFullName() ?? $u->getEmail()),
            'email' => $u->getEmail(),
            'roles' => $u->getRoles(),
        ]);
    }

    #[Route('/api/me', methods: ['PUT'])]
    public function update(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $u = $this->requireDbUser($request, $em);

        $data = json_decode((string)$request->getContent(), true);
        if (!is_array($data)) $data = [];

        // Update full name
        if (array_key_exists('fullName', $data)) {
            $fullName = trim((string)$data['fullName']);
            $u->setFullName($fullName !== '' ? $fullName : null);
        }

        // Update email (must stay unique)
        if (array_key_exists('email', $data)) {
            $email = strtolower(trim((string)$data['email']));
            if ($email === '') {
                return new JsonResponse(['error' => 'email_required'], 400);
            }
            if ($email !== $u->getEmail()) {
                $existing = $em->getRepository(User::class)->findOneBy(['email' => $email]);
                if ($existing && $existing->getId() !== $u->getId()) {
                    return new JsonResponse(['error' => 'email_exists'], 409);
                }
                $u->setEmail($email);
            }
        }

        // Change password (optional)
        $currentTrim = trim((string)($data['currentPassword'] ?? ''));
        $newTrim = trim((string)($data['newPassword'] ?? ''));

        // Only treat it as a password change if the user provided a NEW password.
        // This avoids errors when the browser auto-fills currentPassword by mistake.
        if ($newTrim !== '') {
            if ($currentTrim === '') {
                return new JsonResponse(['error' => 'password_fields_required'], 400);
            }
            if (!password_verify($currentTrim, $u->getPasswordHash())) {
                return new JsonResponse(['error' => 'wrong_password'], 400);
            }
            if (strlen($newTrim) < 6) {
                return new JsonResponse(['error' => 'weak_password'], 400);
            }
            $u->setPasswordHash(password_hash($newTrim, PASSWORD_BCRYPT));
        }

        $em->persist($u);
        $em->flush();

        return $this->jsonOk([
            'id' => (string)$u->getId(),
            'fullName' => (string)($u->getFullName() ?? $u->getEmail()),
            'email' => $u->getEmail(),
            'roles' => $u->getRoles(),
        ]);
    }
}

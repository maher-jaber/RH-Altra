<?php

namespace App\Controller;

use App\Entity\User;
use App\Entity\PasswordResetToken;
use App\Service\LeaveNotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class AuthController extends ApiBase
{
    public function __construct(private LeaveNotificationService $mailer) {}

    #[Route('/api/auth/login', name: 'api_auth_login', methods: ['POST'])]
    public function login(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $data = json_decode((string)$request->getContent(), true) ?: [];
        $email = strtolower(trim((string)($data['email'] ?? '')));
        $password = (string)($data['password'] ?? '');

        if ($email === '' || $password === '') {
            return $this->json(['error' => 'email/password required'], 400);
        }

        /** @var User|null $user */
        $user = $em->getRepository(User::class)->findOneBy(['email' => $email]);
        if (!$user || !password_verify($password, $user->getPasswordHash())) {
            return $this->json(['error' => 'invalid_credentials'], 401);
        }

        return $this->jsonOk([
            'token' => $user->getApiKey(),
            'me' => [
                'id' => (string)$user->getId(),
                'apiKey' => $user->getApiKey(),
                'roles' => $user->getRoles(),
                'fullName' => $user->getFullName() ?: $user->getEmail(),
            ]
        ]);
    }

    #[Route('/api/auth/forgot-password', name: 'api_auth_forgot', methods: ['POST'])]
    public function forgot(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $data = json_decode((string)$request->getContent(), true) ?: [];
        $email = strtolower(trim((string)($data['email'] ?? '')));

        // Always return ok to avoid user enumeration
        if ($email !== '') {
            /** @var User|null $user */
            $user = $em->getRepository(User::class)->findOneBy(['email' => $email]);
            if ($user) {
                $token = bin2hex(random_bytes(24));
                $prt = (new PasswordResetToken())
                    ->setUserId((int)$user->getId())
                    ->setToken($token)
                    ->setExpiresAt((new \DateTimeImmutable())->modify('+1 hour'));
                $em->persist($prt);
                $em->flush();

                // Send reset link by email (never expose token in API response)
                $frontend = (string) ($_ENV['FRONTEND_URL'] ?? $_SERVER['FRONTEND_URL'] ?? 'http://localhost:4200');
                $link = rtrim($frontend, '/') . '/reset-password?token=' . urlencode($token);
                $name = $user->getFullName() ?: $user->getEmail();
                $html = '<div style="font-family:Arial,sans-serif;line-height:1.4">'
                    . '<h2 style="margin:0 0 12px 0">Réinitialisation du mot de passe</h2>'
                    . '<p style="margin:0 0 12px 0">Bonjour ' . htmlspecialchars((string)$name, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . ',</p>'
                    . '<p style="margin:0 0 12px 0">Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe. Le lien expire dans 1 heure.</p>'
                    . '<p style="margin:20px 0"><a href="' . htmlspecialchars($link, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '" style="display:inline-block;background:#0d6efd;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">Réinitialiser mon mot de passe</a></p>'
                    . '<p style="opacity:.7;font-size:12px;margin-top:18px">Si vous n\'êtes pas à l\'origine de cette demande, vous pouvez ignorer cet email.</p>'
                    . '</div>';

                $this->mailer->notify((string) $user->getEmail(), 'Réinitialisation du mot de passe', $html);
            }
        }

        return $this->jsonOk(['ok' => true]);
    }

    #[Route('/api/auth/reset-password', name: 'api_auth_reset', methods: ['POST'])]
    public function reset(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $data = json_decode((string)$request->getContent(), true) ?: [];
        $token = trim((string)($data['token'] ?? ''));
        $password = (string)($data['password'] ?? '');

        if ($token === '' || $password === '' || strlen($password) < 6) {
            return $this->json(['error' => 'token/password invalid'], 400);
        }

        /** @var PasswordResetToken|null $prt */
        $prt = $em->getRepository(PasswordResetToken::class)->findOneBy(['token' => $token]);
        if (!$prt || $prt->getUsedAt() !== null || $prt->getExpiresAt() < new \DateTimeImmutable()) {
            return $this->json(['error' => 'token_invalid'], 400);
        }

        /** @var User|null $user */
        $user = $em->getRepository(User::class)->find((int)$prt->getUserId());
        if (!$user) {
            return $this->json(['error' => 'user_not_found'], 400);
        }

        $user->setPasswordHash(password_hash($password, PASSWORD_BCRYPT));
        $prt->setUsedAt(new \DateTimeImmutable());
        $em->flush();

        return $this->jsonOk(['ok' => true]);
    }
}

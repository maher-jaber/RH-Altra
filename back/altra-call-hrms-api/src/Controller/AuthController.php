<?php

namespace App\Controller;

use App\Entity\User;
use App\Entity\PasswordResetToken;
use App\Service\LeaveNotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class AuthController extends ApiBase
{
    public function __construct(private LeaveNotificationService $mailer, private LoggerInterface $logger) {}

    #[Route('/api/auth/login', name: 'api_auth_login', methods: ['POST'])]
    public function login(Request $request, EntityManagerInterface $em): JsonResponse
    {
        try {
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
                    'roles' => $user->getRoles(),
                    'fullName' => $user->getFullName() ?: $user->getEmail(),
                ]
            ]);
        } catch (\Throwable $e) {
            // In prod, avoid a generic 500 that the front can't distinguish from "wrong password".
            // Most common causes here are DB connectivity or schema mismatch (migrations not applied).
            $this->logger->error('[auth] login failed', [
                'error' => $e->getMessage(),
                'class' => get_class($e),
            ]);

            $debug = ($_ENV['APP_DEBUG'] ?? $_SERVER['APP_DEBUG'] ?? '0') === '1';
            return $this->json([
                'error' => 'api_unavailable',
                'message' => $debug ? $e->getMessage() : 'API indisponible (erreur serveur). Vérifie DB/migrations/logs.',
            ], 503);
        }
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
                $frontend = (string) ($_ENV['FRONTEND_URL'] ?? $_SERVER['FRONTEND_URL'] ?? 'http://localhost:8008');
                $link = rtrim($frontend, '/') . '/reset-password?token=' . urlencode($token);
                $name = $user->getFullName() ?: $user->getEmail();
                $html = $this->mailer->renderEmail(
                    title: 'Réinitialisation du mot de passe',
                    intro: 'Bonjour ' . $name . ', cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe. Le lien expire dans 1 heure.',
                    rows: [],
                    ctaUrl: $link,
                    ctaLabel: 'Réinitialiser mon mot de passe',
                    finePrint: "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email."
                );

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

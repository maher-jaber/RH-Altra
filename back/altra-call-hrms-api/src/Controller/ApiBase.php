<?php

namespace App\Controller;

use App\Security\AuthContext;
use App\Security\ApiKeyUser;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\UnauthorizedHttpException;

abstract class ApiBase extends AbstractController
{
    /**
     * Symfony controllers expose a smaller service-locator. If we want to
     * fetch custom services from $this->container (like AuthContext), we must
     * explicitly subscribe them.
     */
    public static function getSubscribedServices(): array
    {
        return array_merge(parent::getSubscribedServices(), [
            AuthContext::class => AuthContext::class,
        ]);
    }

    protected function requireUser(Request $request): ApiKeyUser
    {
        $user = $this->container->get(AuthContext::class)->fromRequest($request);
        if (!$user) {
            throw new UnauthorizedHttpException('X-API-KEY', 'Missing or invalid token');
        }
        return $user;
    }

    /**
     * Most endpoints work with the real DB user entity (relations: manager, department, ...).
     * Use this helper to convert the API key identity into the corresponding User row.
     */
    protected function requireDbUser(Request $request, EntityManagerInterface $em): User
    {
        $ak = $this->requireUser($request);
        /** @var User|null $user */
        $user = $em->getRepository(User::class)->findOneBy(['apiKey' => $ak->apiKey]);
        if (!$user) {
            throw $this->createNotFoundException('User not found for this API key. Create the user via Admin first.');
        }
        return $user;
    }

 
protected function requireRole(Request $request, string $role): ApiKeyUser
{
    $u = $this->requireUser($request);
    if (!in_array($role, $u->roles, true)) {
        throw new UnauthorizedHttpException('X-API-KEY', 'Forbidden');
    }
    return $u;
}

protected function hasRole(ApiKeyUser $u, string $role): bool
{
    return in_array($role, $u->roles, true);
}


    protected function jsonOk(array $data = [], int $status = 200): JsonResponse
    {
        // IMPORTANT: avoid Serializer normalizer edge-cases with Doctrine proxies.
        // We only return arrays/scalars from controllers, so JsonResponse is enough.
        return new JsonResponse($data, $status, ['Content-Type' => 'application/json']);
    }
}

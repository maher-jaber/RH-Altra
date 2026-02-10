<?php

namespace App\Controller;

use App\Security\AuthContext;
use App\Security\ApiKeyUser;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\UnauthorizedHttpException;

abstract class ApiBase extends AbstractController
{
    protected function requireUser(Request $request): ApiKeyUser
    {
        $user = $this->container->get(AuthContext::class)->fromRequest($request);
        if (!$user) {
            throw new UnauthorizedHttpException('X-API-KEY', 'Missing or invalid token');
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
        return $this->json($data, $status, ['Content-Type' => 'application/json']);
    }
}

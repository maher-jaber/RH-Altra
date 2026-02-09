<?php

namespace App\Controller;

use App\Security\ApiKeyAuth;
use App\Security\ApiKeyUser;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\UnauthorizedHttpException;

abstract class ApiBase extends AbstractController
{
    protected function requireUser(Request $request): ApiKeyUser
    {
        $user = ApiKeyAuth::fromRequest($request);
        if (!$user) {
            throw new UnauthorizedHttpException('X-API-KEY', 'Missing or invalid API key');
        }
        return $user;
    }

    protected function jsonOk(array $data = [], int $status = 200): JsonResponse
    {
        return $this->json($data, $status, ['Content-Type' => 'application/json']);
    }
}

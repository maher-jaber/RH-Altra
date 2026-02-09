<?php

namespace App\Controller;

use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

class MeController extends ApiBase
{
    #[Route('/api/me', methods: ['GET'])]
    public function me(Request $request): JsonResponse
    {
        $u = $this->requireUser($request);

        return $this->jsonOk([
            'id' => $u->id,
            'fullName' => $u->fullName,
            'roles' => $u->roles,
        ]);
    }
}

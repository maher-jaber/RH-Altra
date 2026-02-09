<?php

namespace App\Controller;

use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class CorsPreflightController
{
    #[Route('/api/{any}', requirements: ['any' => '.*'], methods: ['OPTIONS'])]
    public function preflight(): Response
    {
        return new Response('', 204);
    }
}

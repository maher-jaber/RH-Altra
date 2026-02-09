<?php

namespace App\Security;

class ApiKeyUser
{
    public function __construct(
        public readonly string $id,
        public readonly string $apiKey,
        /** @var string[] */
        public readonly array $roles,
        public readonly string $fullName
    ) {}
}

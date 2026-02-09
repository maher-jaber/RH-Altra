<?php

namespace App\Security;

use Symfony\Component\HttpFoundation\Request;

class ApiKeyAuth
{
    /**
     * Parse API_KEYS env format: key:ROLE_A|ROLE_B;key2:ROLE_X
     * Returns ApiKeyUser or null.
     */
    public static function fromRequest(Request $request): ?ApiKeyUser
    {
        $key = trim((string) $request->headers->get('X-API-KEY', ''));
        if ($key === '') return null;

        $raw = (string) ($_ENV['API_KEYS'] ?? $_SERVER['API_KEYS'] ?? '');
        $pairs = array_filter(array_map('trim', explode(';', $raw)));

        foreach ($pairs as $pair) {
            [$k, $rolesRaw] = array_pad(explode(':', $pair, 2), 2, '');
            if (trim($k) === $key) {
                $roles = array_values(array_filter(array_map('trim', explode('|', $rolesRaw))));
                $fullName = $key === 'admin' ? 'Admin' : 'Employé';
                $id = $key; // MVP
                return new ApiKeyUser($id, $key, $roles ?: ['ROLE_EMPLOYEE'], $fullName);
            }
        }

        return null;
    }
}

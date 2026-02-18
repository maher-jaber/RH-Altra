<?php

namespace App\Security;

use Doctrine\DBAL\Connection;
use Symfony\Component\HttpFoundation\Request;

class AuthContext
{
    public function __construct(private Connection $db) {}

    public function fromRequest(Request $request): ?ApiKeyUser
    {
        // Prefer standard Authorization: Bearer <token>
        $auth = trim((string)$request->headers->get('Authorization',''));
        $key = '';
        if (stripos($auth, 'Bearer ') === 0) { $key = trim(substr($auth, 7)); }
        if ($key === '') {
            $key = trim((string) $request->headers->get('X-API-KEY', ''));
        }

        if ($key === '') { $key = trim((string)$request->query->get('api_key','')); }
        if ($key === '') return null;

        // 1) Prefer DB users if table exists
        try {
            $row = $this->db->fetchAssociative('SELECT id, email, full_name, roles, api_key FROM users WHERE api_key = ?', [$key]);
            if ($row) {
                $roles = [];
                try { $roles = json_decode((string)($row['roles'] ?? '[]'), true) ?: []; } catch (\Throwable) {}
                $fullName = $row['full_name'] ?: $row['email'];
                return new ApiKeyUser((string)$row['id'], (string)$row['api_key'], $roles ?: ['ROLE_EMPLOYEE'], (string)$fullName);
            }
        } catch (\Throwable) {
            // ignore (table might not exist yet)
        }

        // 2) Fallback to ENV API_KEYS (legacy)
        $raw = (string) ($_ENV['API_KEYS'] ?? $_SERVER['API_KEYS'] ?? '');
        $pairs = array_filter(array_map('trim', explode(';', $raw)));

        foreach ($pairs as $pair) {
            [$k, $rolesRaw] = array_pad(explode(':', $pair, 2), 2, '');
            if (trim($k) === $key) {
                $roles = array_values(array_filter(array_map('trim', explode('|', $rolesRaw))));
                $fullName = $key === 'admin' ? 'Admin' : 'Employé';
                $id = $key;
                return new ApiKeyUser($id, $key, $roles ?: ['ROLE_EMPLOYEE'], $fullName);
            }
        }

        return null;
    }
}

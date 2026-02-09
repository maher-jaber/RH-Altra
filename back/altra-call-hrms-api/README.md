# Altra Call HRMS API (Symfony 6.4)

Backend API (MVP) aligné avec le front Angular:
- Auth MVP via header `X-API-KEY`
- Endpoints:
  - GET /api/me
  - POST /api/leave-requests
  - GET /api/leave-requests/my
  - POST /api/leave-requests/{id}/submit
  - POST /api/leave-requests/{id}/cancel
  - GET /api/notifications
  - POST /api/notifications/{id}/read
- Workflow (state machine) pour les congés
- Notifications persistées + publication Mercure via Messenger

## Prérequis
- PHP 8.2+
- Composer
- Docker (optionnel) pour Postgres/Redis/Mercure

## Démarrage rapide (local)
```bash
cd altra-call-hrms-api
cp .env .env.local
composer install
php bin/console doctrine:database:create
php bin/console doctrine:migrations:migrate
symfony server:start -d
```

API: http://localhost:8000

## Docker infra (Postgres + Redis + Mercure)
Dans `infra/docker-compose.yaml` (à la racine du ZIP).
```bash
cd infra
docker compose up -d
```

## Auth MVP (API KEYS)
Dans `.env`:
- `API_KEYS` format: `key:ROLE_A|ROLE_B;key2:ROLE_X`
Ex:
`API_KEYS=admin:ROLE_ADMIN|ROLE_SUPERVISOR;user:ROLE_EMPLOYEE`

Le front envoie `X-API-KEY: admin` ou `X-API-KEY: user`.

## Mercure
- `MERCURE_PUBLIC_URL` : URL du hub (ex: http://localhost:3000/.well-known/mercure)
- `MERCURE_JWT_SECRET` : doit correspondre à l'infra Mercure
Le backend publie sur topic: `/users/{apiKey}/notifications`

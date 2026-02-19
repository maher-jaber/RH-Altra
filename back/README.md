# Altra-RH – Backend Symfony (ZIP)

Ce ZIP contient:
- `altra-call-hrms-api/` : backend Symfony 6.4 (API)
- `infra/` : Postgres + Redis + Mercure

## Étapes
1) Lancer l'infra:
```bash
cd infra
docker compose up -d
```

2) Installer et démarrer l'API:
```bash
cd ../altra-call-hrms-api
composer install
php bin/console doctrine:database:create
php bin/console doctrine:migrations:migrate
symfony server:start
```

3) Tester:
```bash
curl -H "X-API-KEY: user" http://localhost:8000/api/me
```

## Topics Mercure
Le backend publie:
- `/users/{apiKey}/notifications`

Ex: `/users/admin/notifications`

# RH-Altra — Déploiement Production (Docker)

Ce pack ajoute une configuration **PROD** (sans `ng serve`).

## Prérequis
- Docker + Docker Compose
- Un serveur Linux (recommandé) avec au minimum **2 vCPU / 4 Go RAM** pour ~100 connexions “normales”.

## 1) Préparer les variables
Copie le fichier d'exemple puis adapte les valeurs :

```bash
cp deploy/prod/.env.prod.example .env.prod
```

- Mets des secrets forts (JWT Mercure, APP_SECRET, mots de passe DB)

## 2) Build & Run

```bash
docker compose -f deploy/prod/docker-compose.prod.yml --env-file .env.prod up -d --build
```

Ensuite :
- App : http://localhost (ou ton domaine)
- API (via Nginx) : http://localhost/api
- Mercure : http://localhost/.well-known/mercure (si activé)

## 3) Migrations

```bash
docker compose -f deploy/prod/docker-compose.prod.yml --env-file .env.prod exec api php bin/console doctrine:migrations:migrate --no-interaction --env=prod
```

## 4) Notes Performance
- Front: servi en statique par Nginx (très rapide)
- API: PHP-FPM + OPcache activé
- Redis: cache/sessions possible (activé)

## 5) HTTPS
Recommandé: mettre un reverse-proxy TLS devant (Traefik/Caddy/Nginx+Let'sEncrypt).

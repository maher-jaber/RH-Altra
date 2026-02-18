#!/usr/bin/env sh
set -e

docker compose -f deploy/prod/docker-compose.prod.yml --env-file .env.prod up -d --build

# Dev Docker (RH-Altra)

## Démarrer
```bash
docker compose up -d --build
```

- Front: http://localhost:4200
- API:   http://localhost:8000
- Mailhog: http://localhost:8025
- Mercure: http://localhost:3000/.well-known/mercure

## Logs
```bash
docker compose logs -f api
```

## Reset DB
```bash
docker compose down -v
docker compose up -d --build
```

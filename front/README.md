# Altra-RH UI (Angular)

Starter Angular (standalone) for:
- Gestion des congés (demande, soumission, suivi)
- Notifications temps réel (SSE/Mercure)
- Rôles (admin / supérieur / employé) via infos renvoyées par l'API
- Structure "dashboard" moderne avec Angular Material

## Prérequis
- Node.js 18+ (recommandé)
- npm 9+

## Installation
```bash
cd altra-call-hrms-ui
npm install
npm start
```

Ouvre: http://localhost:4200

## Configuration API / Mercure
Fichier: `src/environments/environment.ts`

- `apiBaseUrl`: URL de l'API Symfony (ex: http://localhost:8000)
- `mercureUrl`: URL du hub Mercure (ex: http://localhost:3000/.well-known/mercure)

## Auth MVP (API KEY)
Ce starter utilise une auth simple `X-API-KEY` (MVP).
- Sur l'écran Login, saisis une clé (ex: `admin` ou `user` selon ton backend).
- La clé est stockée en `localStorage` et injectée dans chaque requête via un HttpInterceptor.

## Notifications temps réel
- Le front ouvre une connexion SSE vers Mercure via `EventSource`.
- Topic recommandé: `/users/{apiKey}/notifications`
- Le backend doit publier les notifications sur ce topic.

## Pages
- /login
- /dashboard
- /leave/new
- /leave/my
- /notifications

## Notes
- Ce projet ne contient pas `node_modules` (normal). `npm install` est nécessaire.
- UI: Angular Material (toolbar, sidenav, cards, tables, snackbars).

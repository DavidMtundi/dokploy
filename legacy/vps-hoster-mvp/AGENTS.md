# VPS Hoster

Self-hosted Railway-style deploy panel. Runs on the VPS with Docker + Traefik.

## Layout

- `src/app/` — Next.js UI + API routes
- `src/lib/` — deploy engine, auth, addons, nixpacks
- `src/middleware.ts` — session / API key gate
- `prisma/` — SQLite schema
- `docker-compose.yml` — Traefik + panel on VPS

## Dev

```bash
npm install && npx prisma db push && npm run dev
```

First visit → `/setup` to create admin. Docker Desktop required for deploys.

## VPS

Configure `.env` (see `.env.example`), then `./scripts/install.sh`.

Required production env: `VPS_HOSTER_SESSION_SECRET`.

## Security

Docker socket = root. Auth required for all routes except webhooks.

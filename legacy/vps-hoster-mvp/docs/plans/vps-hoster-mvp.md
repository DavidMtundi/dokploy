# VPS Hoster — Full Plan

## Chunk 1 — MVP ✅
Dashboard, deploy, domains, GitHub webhooks, Traefik SSL.

## Chunk 2 — Auth ✅
- First-run `/setup` creates admin account
- Session login at `/login` (JWT cookie, 7-day expiry)
- API keys at `/settings` (`Authorization: Bearer vph_…`)
- Middleware protects all routes except login, setup, webhooks

## Chunk 3 — Nixpacks buildpacks ✅
- **AUTO** (default): Dockerfile if present, else Nixpacks
- **DOCKERFILE**: force Dockerfile / template build
- **NIXPACKS**: always use Railway Nixpacks image
- Build method selector on project page

## Chunk 4 — Add-ons ✅
- **PostgreSQL 16** — provisions container, injects `DATABASE_URL` / `POSTGRES_URL`
- **Redis 7** — provisions container, injects `REDIS_URL`
- One of each per project; UI on project page

## Future (not in scope)
- Multi-server agents
- Preview environments per PR
- Team RBAC / orgs
- Metrics & billing
- Blue/green zero-downtime deploys

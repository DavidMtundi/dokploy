# Railway parity roadmap

Goal: feel like Railway on your own VPS, built on Dokploy.

## Done

- [x] Dokploy import (Traefik, Nixpacks, Railpack, Postgres/Redis, Git deploy, previews)
- [x] `railway.toml` — parse `[build]` / `[deploy]` and apply before build
- [x] Post-deploy HTTP health check before marking deployment `done`
- [x] Auto-detect container port from image EXPOSE / build metadata
- [x] Default new Git apps to **railpack** builder
- [x] PR preview deployments enabled by default
- [x] VPS Hoster branding + Railway purple dark theme
- [x] `watchPatterns` → `watchPaths` from `railway.toml`
- [x] Docker smoke test: `scripts/railway-parity-docker-test.sh`

## Chunk 2 — UX

- [ ] Env var editor: bulk paste, Railway-style groups
- [ ] Project dashboard layout closer to Railway service graph
- [ ] Branded one-line VPS installer script

## Chunk 3 — Workflows

- [ ] Staging/production environment templates per project
- [ ] `railway.toml` custom domain hints
- [ ] `railway.toml` `buildCommand` mapping

## Chunk 4 — Optional

- [ ] CLI (`vph deploy`, `vph logs`) wrapping Dokploy API

## Build type guide

| Railway        | VPS Hoster / Dokploy     |
|----------------|--------------------------|
| Nixpacks       | `nixpacks` or `railpack` |
| Dockerfile     | `dockerfile`             |
| Static         | `static` + publish dir   |

Use **Railpack** (default) for closest Railway build behavior.

## Testing

```bash
chmod +x scripts/railway-parity-docker-test.sh
./scripts/railway-parity-docker-test.sh

cd apps/dokploy && pnpm test __test__/railway-toml/
```

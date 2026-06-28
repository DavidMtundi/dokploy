# VPS Hoster (Dokploy fork)

Railway-oriented fork of [Dokploy](https://github.com/Dokploy/dokploy) for self-hosted deploys on a single VPS.

## Layout

- `apps/dokploy/` — Next.js dashboard + tRPC API
- `packages/server/` — deploy engine, builders (Nixpacks, Railpack), Traefik, DB services
- `legacy/vps-hoster-mvp/` — archived custom MVP (reference only, not maintained)
- `docs/FORK.md` — upstream sync and fork policy
- `docs/RAILWAY-ROADMAP.md` — Railway-parity work items

## Upstream

```bash
git fetch upstream
git merge upstream/canary   # or rebase your fork branch
```

Default branch tracks Dokploy `canary`. Original VPS Hoster history is on local branch `main`.

## Dev

Requires Node 24+ and pnpm 10+.

```bash
pnpm install
pnpm dokploy:setup    # DB + env
pnpm dokploy:dev      # dashboard on :3000
```

Full stack on a VPS: `curl -sSL https://dokploy.com/install.sh | bash` (or adapt for this fork).

## Fork customizations (Railway parity)

- `railway.toml` parsed at deploy: builder, start command, health check, replicas, watch patterns
- **Railpack** default build type (closest to Railway)
- Post-deploy HTTP health gate before marking deploy `done`
- Auto port sync from image `EXPOSE` / railpack-info / nixpacks metadata
- PR preview deployments on by default
- VPS Hoster branding + Railway purple dark theme

## Testing

```bash
./scripts/railway-parity-docker-test.sh   # Docker port + health smoke test
cd apps/dokploy && pnpm test __test__/railway-toml/
pnpm test:quick-deploy                    # Git clone + deploy pipeline (needs disk space)
```

See [docs/GITHUB-QUICK-DEPLOY.md](docs/GITHUB-QUICK-DEPLOY.md) for Railway-style GitHub connect + deploy.

Requires ~10GB free disk for Railpack/Nixpacks builds.

## Security

Docker socket access is root-equivalent. Run on a dedicated VPS; do not expose the panel without TLS and auth.

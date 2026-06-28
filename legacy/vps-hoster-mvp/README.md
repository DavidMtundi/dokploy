# VPS Hoster

**Railway-style deployments on your own VPS** — one-click deploy, GitHub auto-deploy, custom domains, Nixpacks buildpacks, managed Postgres/Redis, and automatic HTTPS via Traefik.

## Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Railway-inspired UI to manage projects |
| **One-click deploy** | Clone → build → run container |
| **Nixpacks** | Deploy without a Dockerfile (auto-detect stack) |
| **GitHub webhooks** | Auto-deploy on push |
| **Custom domains** | Subdomains + your own domains with Let's Encrypt |
| **Auth** | Admin login + API keys for automation |
| **Add-ons** | Managed PostgreSQL and Redis per project |

## Architecture

```
GitHub push ──webhook──► VPS Hoster API ──► Nixpacks or Dockerfile build
                                              │
                                              ▼
                                    App + Postgres/Redis containers
                                              │
                                              ▼
                                    Traefik (:80/:443 + TLS)
```

## Quick start (local)

```bash
npm install
npx prisma db push
npm run dev
```

1. Open http://localhost:3000 → redirected to **Setup**
2. Create admin account
3. Create a project, click **Deploy** (Docker Desktop required)

## Deploy to VPS

1. Clone on VPS, copy `.env.example` → `.env`
2. Set `VPS_HOSTER_BASE_DOMAIN`, `PANEL_DOMAIN`, `LETSENCRYPT_EMAIL`, `VPS_HOSTER_SESSION_SECRET`
3. DNS: panel domain + wildcard `*.apps.yourdomain.com` → VPS IP
4. Run `./scripts/install.sh`

## First visit

1. Open your panel URL → **Setup** (one-time admin account)
2. **Settings** → create API keys for CI/scripts
3. **New Project** → Git repo → **Deploy**

## Build methods

| Method | Behavior |
|--------|----------|
| `AUTO` | Dockerfile if present, else Nixpacks |
| `DOCKERFILE` | Dockerfile or framework template only |
| `NIXPACKS` | Always use Nixpacks buildpack |

## Add-ons

On any project page, click **+ PostgreSQL** or **+ Redis**. Connection URLs are injected as environment variables on the next deploy.

## API authentication

```bash
curl -H "Authorization: Bearer vph_your_key" https://hoster.example.com/api/projects
```

Webhooks remain public (verified via per-project `webhookSecret`).

## Security

- Set a strong `VPS_HOSTER_SESSION_SECRET` in production
- Docker socket access = root — panel must stay private/trusted
- GitHub webhook signatures verified in production

## License

MIT

# Fork policy

This repository is a **fork of Dokploy** customized for a Railway-like self-hosted PaaS experience.

## Remotes

| Remote   | URL                                      | Purpose              |
|----------|------------------------------------------|----------------------|
| upstream | https://github.com/Dokploy/dokploy.git   | Pull upstream fixes  |
| origin   | *(your GitHub remote — add when ready)*  | Push your fork       |

After cloning, add your fork:

```bash
git remote add origin git@github.com:YOU/vps-hoster.git
git push -u origin canary
```

## Branches

- **canary** — active Dokploy-based code (tracks upstream `canary`)
- **main** — original VPS Hoster Next.js MVP (one commit; kept for history)

## Legacy MVP

The pre-fork app lives in `legacy/vps-hoster-mvp/` (gitignored `node_modules` / build artifacts). Do not run it in production; use Dokploy instead.

## License

Dokploy core is Apache 2.0 (`LICENSE.MD`). Code under `apps/dokploy/proprietary/` is source-available — see `LICENSE_PROPRIETARY.md`. Fork customizations outside `proprietary/` should stay Apache 2.0 compatible.

## Syncing upstream

```bash
git fetch upstream
git checkout canary
git merge upstream/canary
# resolve conflicts; run pnpm install && pnpm typecheck
```

Prefer merging upstream regularly over large divergent patches.

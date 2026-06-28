#!/usr/bin/env bash
set -euo pipefail

echo "==> VPS Hoster install script"
echo "Requires: Docker, Docker Compose, git"

if ! command -v docker &>/dev/null; then
  echo "Docker not found. Install: https://docs.docker.com/engine/install/"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env — edit VPS_HOSTER_BASE_DOMAIN, PANEL_DOMAIN, LETSENCRYPT_EMAIL"
fi

docker network inspect vps-hoster &>/dev/null || docker network create vps-hoster

echo "==> Starting Traefik + control panel..."
docker compose up -d --build

echo ""
echo "Done! Open your panel domain (PANEL_DOMAIN in .env)."
echo "Point *.your-base-domain DNS to this server's IP for app subdomains."

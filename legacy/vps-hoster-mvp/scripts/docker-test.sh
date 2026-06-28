#!/usr/bin/env bash
# Full local Docker test — run after Docker Desktop is running.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Checking Docker daemon..."
if ! docker ps >/dev/null 2>&1; then
  echo "ERROR: Docker daemon is not running."
  echo "Start Docker Desktop manually, wait until it shows 'Running', then re-run:"
  echo "  ./scripts/docker-test.sh"
  exit 1
fi

echo "==> Building and starting containers..."
docker compose --env-file .env.docker \
  -f docker-compose.yml \
  -f docker-compose.local.yml \
  down 2>/dev/null || true

docker compose --env-file .env.docker \
  -f docker-compose.yml \
  -f docker-compose.local.yml \
  up --build -d

echo "==> Waiting for panel on :3000..."
for i in $(seq 1 30); do
  if curl -sf -o /dev/null http://localhost:3000/api/auth/setup; then
    echo "Panel ready after ${i} attempts"
    break
  fi
  sleep 2
done

echo "==> Running smoke tests against Docker container..."
BASE_URL=http://localhost:3000 bash "$ROOT/scripts/smoke-test.sh"

echo ""
echo "==> Docker test complete. Panel: http://localhost:3000"
echo "    Logs: docker compose -f docker-compose.yml -f docker-compose.local.yml logs -f app"

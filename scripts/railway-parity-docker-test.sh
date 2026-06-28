#!/usr/bin/env bash
# Railway parity Docker smoke test — port detection + health probe utilities.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NETWORK="vph-test-network"
IMAGE="vph-railway-parity-test"
CONTAINER="vph-railway-parity-test-run"
PORT=5000
BUILD_CTX="$ROOT/.docker-test/parity-app"

echo "== Railway parity Docker test =="

if ! docker info >/dev/null 2>&1; then
  echo "FAIL: Docker is not running (try: colima start)"
  exit 1
fi

docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null

rm -rf "$BUILD_CTX"
mkdir -p "$BUILD_CTX"

cat > "$BUILD_CTX/Dockerfile" <<'DOCKERFILE'
FROM node:22-alpine
WORKDIR /app
RUN echo '{"name":"parity","scripts":{"start":"node server.js"}}' > package.json
RUN printf '%s\n' \
  'const http = require("http");' \
  'const port = process.env.PORT || 5000;' \
  'http.createServer((_, res) => { res.writeHead(200); res.end("ok"); }).listen(port);' \
  > server.js
EXPOSE 5000
CMD ["npm", "start"]
DOCKERFILE

echo "-- Building test image (EXPOSE 5000)..."
docker build -t "$IMAGE" "$BUILD_CTX" >/dev/null

echo "-- Verifying port detection from docker inspect..."
INSPECT=$(docker image inspect "$IMAGE" --format '{{json .Config.ExposedPorts}}')
DETECTED_PORT=$(echo "$INSPECT" | node -e "
const j = JSON.parse(require('fs').readFileSync(0,'utf8'));
const keys = Object.keys(j || {});
const port = parseInt((keys[0] || '').split('/')[0], 10);
if (port !== 5000) { console.error('expected 5000 got', port); process.exit(1); }
console.log(port);
")
echo "port detect OK: $DETECTED_PORT"

echo "-- Starting container on $NETWORK..."
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" --network "$NETWORK" -e PORT=$PORT "$IMAGE" >/dev/null

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "-- Probing health via curl on overlay network..."
for i in $(seq 1 20); do
  CODE=$(docker run --rm --network "$NETWORK" curlimages/curl:8.5.0 \
    -sf -o /dev/null -w "%{http_code}" "http://${CONTAINER}:${PORT}/" 2>/dev/null || echo "000")
  if [[ "$CODE" == "200" ]]; then
    echo "health probe OK: HTTP $CODE"
    echo ""
    echo "PASS: Railway parity Docker smoke test"
    exit 0
  fi
  sleep 1
done

echo "FAIL: service did not return HTTP 200 within timeout"
exit 1

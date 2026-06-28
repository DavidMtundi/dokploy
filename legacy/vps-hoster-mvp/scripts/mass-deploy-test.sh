#!/usr/bin/env bash
# Mass deploy test — multiple small public repos on one VPS Hoster instance.
set -uo pipefail

BASE="${BASE_URL:-http://localhost:3000}"
COOKIE_JAR="$(mktemp)"
LOG_DIR="${LOG_DIR:-./test-results}"
mkdir -p "$LOG_DIR"
trap 'rm -f "$COOKIE_JAR"' EXIT

EMAIL="${TEST_EMAIL:-docker-test@example.com}"
PASSWORD="${TEST_PASSWORD:-testpass123}"

pass=0
fail=0
docker_ok=0

log() { echo "[$(date +%H:%M:%S)] $*"; }

# name|repo|branch|buildMethod|port|description
TESTS=(
  "node-express|https://github.com/heroku/node-js-getting-started.git|main|NIXPACKS|5000|Node/Express (Nixpacks)"
  "python-flask|https://github.com/heroku/python-getting-started.git|main|NIXPACKS|8000|Python/Flask (Nixpacks)"
  "go-app|https://github.com/heroku/go-getting-started.git|main|DOCKERFILE|5000|Go (Heroku Dockerfile)"
  "php-app|https://github.com/heroku/php-getting-started.git|main|NIXPACKS|8000|PHP (Nixpacks)"
  "sinatra-ruby|https://github.com/heroku/ruby-getting-started.git|main|NIXPACKS|4567|Ruby (Nixpacks)"
  "static-nginx|https://github.com/nginxinc/NGINX-Demos.git|master|DOCKERFILE|80|NGINX demo (skip - monorepo)"
)

login() {
  local code
  code=$(curl -s -c "$COOKIE_JAR" -w "%{http_code}" -o /tmp/login.json -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
  if [[ "$code" != "200" ]]; then
    code=$(curl -s -c "$COOKIE_JAR" -w "%{http_code}" -o /tmp/setup.json -X POST "$BASE/api/auth/setup" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Mass Test\"}")
    [[ "$code" == "201" ]] || { log "Auth failed ($code)"; exit 1; }
  fi
  log "Authenticated"
}

docker_ok_check() {
  if docker ps >/dev/null 2>&1; then
    docker_ok=1
    log "Docker daemon: OK"
    docker network inspect vps-hoster >/dev/null 2>&1 || docker network create vps-hoster
  else
    docker_ok=0
    log "Docker daemon: NOT AVAILABLE"
  fi
}

poll_deploy() {
  local project_id="$1" name="$2" logfile="$3" max_wait="${4:-900}"
  local elapsed=0 final=""

  while [[ $elapsed -lt $max_wait ]]; do
    sleep 10
    elapsed=$((elapsed + 10))
    curl -s -b "$COOKIE_JAR" "$BASE/api/projects/$project_id" -o "/tmp/proj_${name}.json"
    python3 -c "
import json
p=json.load(open('/tmp/proj_${name}.json'))
d=p.get('deployments',[{}])[0]
open('$logfile','w').write(d.get('logs',''))
print(d.get('status','?'), p.get('status','?'))
" | {
      read -r final proj
      log "  [${elapsed}s] deploy=$final project=$proj"
    }
    final=$(python3 -c "import json; p=json.load(open('/tmp/proj_${name}.json')); print(p.get('deployments',[{}])[0].get('status','?'))")
    if [[ "$final" == "SUCCESS" ]]; then return 0; fi
    if [[ "$final" == "FAILED" ]]; then return 1; fi
  done
  return 2
}

run_test() {
  local name="$1" repo="$2" branch="$3" method="$4" port="$5" desc="$6"
  local slug="t2-${name}-$(date +%s | tail -c 6)"
  local logfile="$LOG_DIR/${name}-run2.log"
  local metafile="$LOG_DIR/${name}-run2.json"

  log "━━━ $desc ━━━"

  local code
  code=$(curl -s -b "$COOKIE_JAR" -w "%{http_code}" -o "$metafile" -X POST "$BASE/api/projects" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$slug\",\"repoUrl\":\"$repo\",\"branch\":\"$branch\",\"buildMethod\":\"$method\",\"port\":$port}")

  if [[ "$code" != "201" ]]; then log "  ✗ CREATE ($code)"; fail=$((fail+1)); return; fi

  local pid actual_slug
  pid=$(python3 -c "import json; print(json.load(open('$metafile'))['id'])")
  actual_slug=$(python3 -c "import json; print(json.load(open('$metafile'))['slug'])")

  code=$(curl -s -b "$COOKIE_JAR" -w "%{http_code}" -o /tmp/dep.json -X POST "$BASE/api/projects/$pid/deploy")
  if [[ "$code" != "202" ]]; then log "  ✗ DEPLOY trigger ($code)"; fail=$((fail+1)); return; fi

  poll_deploy "$pid" "$name" "$logfile" 1200
  local rc=$?
  if [[ $rc -eq 0 ]]; then
    log "  ✓ SUCCESS"
    docker ps --format '{{.Names}}' 2>/dev/null | grep -q "vps-hoster-${actual_slug}" && log "  ✓ Container up"
    pass=$((pass+1))
  else
    log "  ✗ FAILED/TIMEOUT"
    tail -20 "$logfile" | sed 's/^/    /'
    fail=$((fail+1))
  fi
}

log "Mass deploy test (run 2) → $BASE"
login
docker_ok_check
echo ""

# Skip static-nginx (monorepo - bad test)
for entry in "${TESTS[@]}"; do
  IFS='|' read -r name repo branch method port desc <<< "$entry"
  [[ "$name" == "static-nginx" ]] && continue
  run_test "$name" "$repo" "$branch" "$method" "$port" "$desc" || true
  echo ""
done

log "━━━ RUNNING CONTAINERS ━━━"
docker ps --filter "name=vps-hoster-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
log "━━━ SUMMARY: $pass passed, $fail failed ━━━"
exit $(( fail > 0 ? 1 : 0 ))

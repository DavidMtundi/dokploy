#!/usr/bin/env bash
# Focused multi-site test — 3 small apps on one VPS Hoster instance.
set -euo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
CJ=$(mktemp); trap 'rm -f "$CJ"' EXIT
mkdir -p test-results

login() {
  curl -s -c "$CJ" -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"docker-test@example.com","password":"testpass123"}' >/dev/null
}

deploy_and_wait() {
  local name="$1" repo="$2" branch="$3" method="$4" port="$5"
  local slug="final-${name}-$(date +%s | tail -c 5)"
  echo "=== Deploying $name ($method) ==="
  local proj
  proj=$(curl -s -b "$CJ" -X POST "$BASE/api/projects" -H "Content-Type: application/json" \
    -d "{\"name\":\"$slug\",\"repoUrl\":\"$repo\",\"branch\":\"$branch\",\"buildMethod\":\"$method\",\"port\":$port}")
  local pid slug_actual
  pid=$(echo "$proj" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
  slug_actual=$(echo "$proj" | python3 -c "import json,sys; print(json.load(sys.stdin)['slug'])")
  curl -s -b "$CJ" -X POST "$BASE/api/projects/$pid/deploy" >/dev/null
  for i in $(seq 1 60); do
    sleep 10
    local data status
    data=$(curl -s -b "$CJ" "$BASE/api/projects/$pid")
    status=$(echo "$data" | python3 -c "import json,sys; print(json.load(sys.stdin)['deployments'][0]['status'])")
    echo "  [${i}0s] $status"
    if [[ "$status" == "SUCCESS" ]]; then
      echo "  ✓ $name deployed as $slug_actual"
      echo "$slug_actual" >> test-results/successful-slugs.txt
      return 0
    fi
    if [[ "$status" == "FAILED" ]]; then
      echo "$data" | python3 -c "import json,sys; print(json.load(sys.stdin)['deployments'][0]['logs'][-800:])"
      return 1
    fi
  done
  echo "  ✗ timeout"; return 1
}

probe_containers() {
  echo ""
  echo "=== Running containers ==="
  docker ps --filter "name=vps-hoster-t" --format "table {{.Names}}\t{{.Status}}\t{{.Networks}}"
  echo ""
  echo "=== HTTP probes (via container IP on vps-hoster network) ==="
  while read -r slug; do
    [[ -z "$slug" ]] && continue
    local cname="vps-hoster-${slug}"
    local ip
    ip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$cname" 2>/dev/null || echo "")
    if [[ -z "$ip" ]]; then echo "  $cname: no IP"; continue; fi
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "http://${ip}:5000/" 2>/dev/null || \
           curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "http://${ip}:8000/" 2>/dev/null || \
           echo "fail")
    echo "  $cname @ $ip → HTTP $code"
  done < test-results/successful-slugs.txt 2>/dev/null || true
}

: > test-results/successful-slugs.txt
docker context use colima >/dev/null
docker network inspect vps-hoster >/dev/null 2>&1 || docker network create vps-hoster
login

PASS=0; FAIL=0
deploy_and_wait "node" "https://github.com/heroku/node-js-getting-started.git" "main" "DOCKERFILE" 5000 && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
deploy_and_wait "python" "https://github.com/heroku/python-getting-started.git" "main" "DOCKERFILE" 8000 && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
deploy_and_wait "php" "https://github.com/heroku/php-getting-started.git" "main" "NIXPACKS" 8000 && PASS=$((PASS+1)) || FAIL=$((FAIL+1))

probe_containers
echo ""
echo "RESULT: $PASS succeeded, $FAIL failed"

#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE_URL:-http://localhost:3000}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

pass=0
fail=0

assert() {
  local name="$1"
  local ok="$2"
  if [[ "$ok" == "1" ]]; then
    echo "✓ $name"
    pass=$((pass + 1))
  else
    echo "✗ $name"
    fail=$((fail + 1))
  fi
}

echo "==> Testing VPS Hoster at $BASE"
echo ""

SETUP_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/setup")
[[ "$SETUP_HTTP" == "200" || "$SETUP_HTTP" == "307" ]] && ok=1 || ok=0
assert "GET /setup reachable ($SETUP_HTTP)" "$ok"

SETUP_API=$(curl -sf "$BASE/api/auth/setup")
echo "$SETUP_API" | grep -q needsSetup && ok=1 || ok=0
assert "GET /api/auth/setup" "$ok"

LOGIN_HTTP=$(curl -s -c "$COOKIE_JAR" -o /tmp/login.json -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"docker-test@example.com","password":"testpass123"}')
[[ "$LOGIN_HTTP" == "200" ]] && ok=1 || ok=0
assert "POST /api/auth/login ($LOGIN_HTTP)" "$ok"

ME=$(curl -sf -b "$COOKIE_JAR" "$BASE/api/auth/me")
echo "$ME" | grep -q docker-test@example.com && ok=1 || ok=0
assert "GET /api/auth/me" "$ok"

PROJECTS=$(curl -sf -b "$COOKIE_JAR" "$BASE/api/projects")
echo "$PROJECTS" | grep -q '\[' && ok=1 || ok=0
assert "GET /api/projects" "$ok"

PROJECT_HTTP=$(curl -s -b "$COOKIE_JAR" -o /tmp/project.json -w "%{http_code}" -X POST "$BASE/api/projects" \
  -H "Content-Type: application/json" \
  -d '{"name":"smoke-test-'"$(date +%s)"'","repoUrl":"https://github.com/vercel/next.js.git","branch":"canary"}')
[[ "$PROJECT_HTTP" == "201" ]] && ok=1 || ok=0
assert "POST /api/projects ($PROJECT_HTTP)" "$ok"

if [[ "$PROJECT_HTTP" == "201" ]]; then
  PROJECT_ID=$(python3 -c "import json; print(json.load(open('/tmp/project.json'))['id'])")
  DETAIL_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$BASE/api/projects/$PROJECT_ID")
  [[ "$DETAIL_HTTP" == "200" ]] && ok=1 || ok=0
  assert "GET /api/projects/:id ($DETAIL_HTTP)" "$ok"
fi

UNAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/projects")
[[ "$UNAUTH" == "401" ]] && ok=1 || ok=0
assert "Unauthenticated API returns 401 ($UNAUTH)" "$ok"

HOME=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$BASE/")
[[ "$HOME" == "200" ]] && ok=1 || ok=0
assert "GET / with session ($HOME)" "$ok"

echo ""
echo "==> Results: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]

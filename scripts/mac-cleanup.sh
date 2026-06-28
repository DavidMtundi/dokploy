#!/usr/bin/env bash
# Safe Mac dev cleanup — caches, package managers, Docker, Xcode.
# Usage: ./scripts/mac-cleanup.sh
# Optional nuclear Docker reset: RESET_COLIMA=1 ./scripts/mac-cleanup.sh
set -euo pipefail

echo "== Mac dev cleanup =="
echo "Before: $(df -h / | tail -1)"

echo "-- Docker (Colima) prune..."
if docker info >/dev/null 2>&1; then
  docker system prune -af --volumes 2>/dev/null || true
else
  echo "  Docker not running, skipping prune"
fi

if [[ "${RESET_COLIMA:-0}" == "1" ]]; then
  echo "-- Reset Colima VM (frees ~/.colima, fixes corrupted Docker)..."
  colima stop 2>/dev/null || true
  colima delete -f 2>/dev/null || true
  colima start --cpu 4 --memory 8 --disk 40
  docker context use colima 2>/dev/null || true
fi

echo "-- pnpm store..."
command -v pnpm >/dev/null && pnpm store prune 2>/dev/null || true

echo "-- npm cache..."
command -v npm >/dev/null && npm cache clean --force 2>/dev/null || true

echo "-- yarn cache..."
command -v yarn >/dev/null && yarn cache clean 2>/dev/null || true

echo "-- Homebrew..."
command -v brew >/dev/null && brew cleanup -s 2>/dev/null || true

echo "-- Xcode DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/* 2>/dev/null || true

echo "-- Flutter pub cache (temp + stale)..."
rm -rf ~/.pub-cache/_temp 2>/dev/null || true
# Full wipe (re-run flutter pub get in projects): FLUTTER_PUB_CACHE_CLEAN=1
if [[ "${FLUTTER_PUB_CACHE_CLEAN:-0}" == "1" ]]; then
  rm -rf ~/.pub-cache 2>/dev/null || true
fi

echo "-- Safe cache folders..."
rm -rf \
  ~/Library/Caches/Homebrew \
  ~/Library/Caches/pip \
  ~/Library/Caches/CocoaPods \
  ~/Library/Caches/typescript \
  ~/Library/Caches/node-gyp \
  ~/.cache/yarn \
  2>/dev/null || true

echo "-- Optional: remove node_modules in current repo (set CLEAN_NODE_MODULES=1)..."
if [[ "${CLEAN_NODE_MODULES:-0}" == "1" && -f package.json ]]; then
  rm -rf node_modules apps/*/node_modules packages/*/node_modules
  echo "  removed node_modules — run pnpm install to restore"
fi

echo ""
echo "After: $(df -h / | tail -1)"
echo "Done."

#!/usr/bin/env bash
set -euo pipefail

ensure_sidecar() {
  local bin=".bin/opd-go"
  if [[ ! -f "$bin" ]]; then
    echo "[info] Building Go sidecar..."
    pnpm -s build:go:nix >/dev/null
  fi
  echo "$bin"
}

: "${NETLIFY_AUTH_TOKEN:?NETLIFY_AUTH_TOKEN is required}"
: "${OPD_NETLIFY_SITE:?OPD_NETLIFY_SITE must be set to your Netlify site id/name}"
if [[ "${OPD_SMOKE_RUN_NETLIFY_DIRECT:-0}" != "1" ]]; then
  echo "[skip] OPD_SMOKE_RUN_NETLIFY_DIRECT!=1 (set to 1 to enable)"
  exit 0
fi

export OPD_GO_FORCE=1
export OPD_NDJSON=1
export OPD_PTY=0

BIN=$(ensure_sidecar)

ROOT="scripts/smoke/tmp"
mkdir -p "$ROOT"
DIST="$ROOT/nl-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DIST"
printf '<!doctype html><title>Netlify Direct Smoke</title>\n' > "$DIST/index.html"

REQ=$(printf '{"action":"netlify-deploy-dir","src":"%s","site":"%s","prod":false}' "$DIST" "$OPD_NETLIFY_SITE")
OUT=$(echo "$REQ" | "$BIN")

echo "$OUT" | grep -q '"event"\s*:\s*"done"\s*,\s*"ok"\s*:\s*true' || { echo "direct deploy did not complete ok" >&2; exit 1; }
LOGS=$(echo "$OUT" | sed -nE 's/.*"logsUrl"\s*:\s*"([^"]+)".*/\1/p' | head -n1)
URL=$(echo "$OUT" | sed -nE 's/.*"url"\s*:\s*"([^"]+)".*/\1/p' | head -n1)

echo "[ok] Netlify direct deploy smoke passed: url=$URL logs=$LOGS"

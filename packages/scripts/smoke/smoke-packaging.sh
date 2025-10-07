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

export OPD_GO_FORCE=1
export OPD_NDJSON=1
export OPD_PTY=0

BIN=$(ensure_sidecar)

ROOT="scripts/smoke/tmp"
mkdir -p "$ROOT"
PACKDIR="$ROOT/pack-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$PACKDIR"
printf '<!doctype html><title>Smoke</title>\n' > "$PACKDIR/index.html"
printf '{"ok":true}\n' > "$PACKDIR/meta.json"

ARTIFACTS=".artifacts"
mkdir -p "$ARTIFACTS"
ZIPPED="$ARTIFACTS/smoke-netlify-$(date +%Y%m%d-%H%M%S).zip"

REQ_ZIP=$(printf '{"action":"zip-dir","src":"%s","dest":"%s"}' "$PACKDIR" "$ZIPPED")
OUT_ZIP=$(echo "$REQ_ZIP" | "$BIN")
echo "$OUT_ZIP" | grep -q '"event"\s*:\s*"done"' || { echo "zip-dir did not emit done" >&2; exit 1; }
[[ -f "$ZIPPED" ]] || { echo "zip artifact not found: $ZIPPED" >&2; exit 1; }

REQ_CHK=$(printf '{"action":"checksum-file","src":"%s","algo":"sha256"}' "$ZIPPED")
OUT_CHK=$(echo "$REQ_CHK" | "$BIN")
DIGEST=$(echo "$OUT_CHK" | sed -nE 's/.*"digest"\s*:\s*"([0-9a-fA-F]{64})".*/\1/p')
[[ -n "$DIGEST" ]] || { echo "checksum digest not found or invalid" >&2; exit 1; }

echo "[ok] Packaging helpers smoke passed: $ZIPPED sha256=$DIGEST"

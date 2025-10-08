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
export OPD_PTY=0
export OPD_NDJSON=1

BIN=$(ensure_sidecar)

echo "[info] Running sidecar run-stream handshake smoke..."
REQ='{"action":"run-stream","cmd":"node -v"}'
OUT=$(echo "$REQ" | "$BIN")

echo "$OUT" | grep -q '"event"\s*:\s*"hello"' || { echo "hello event not observed" >&2; exit 1; }
echo "$OUT" | grep -q '"event"\s*:\s*"done"' || { echo "done event not observed" >&2; exit 1; }

echo "[ok] Sidecar handshake + run-stream smoke passed"

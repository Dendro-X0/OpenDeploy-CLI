#!/usr/bin/env bash
set -euo pipefail

# OpenDeploy CLI installer (Linux/macOS)
# - Downloads the latest GitHub Release binary for your OS/arch
# - Installs to $HOME/.local/bin by default (no sudo required)
# - Set PREFIX=/usr/local if you prefer a system install

OWNER="Dendro-X0"
REPO="OpenDeploy-CLI"
UA="opd-installer"

OS_UNAME=$(uname -s)
case "$OS_UNAME" in
  Darwin) OS="macos" ;;
  Linux)  OS="linux" ;;
  *) echo "Unsupported OS: $OS_UNAME" >&2; exit 1 ;;
esac

ARCH_UNAME=$(uname -m)
case "$ARCH_UNAME" in
  x86_64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported arch: $ARCH_UNAME" >&2; exit 1 ;;
esac

ASSET="opd-${OS}-${ARCH}"
# Use direct latest/download URL to avoid API rate limits
URL="https://github.com/${OWNER}/${REPO}/releases/latest/download/${ASSET}"

PREFIX_DIR=${PREFIX:-"$HOME/.local"}
BIN_DIR="${PREFIX_DIR}/bin"
mkdir -p "$BIN_DIR"

echo "Downloading ${ASSET} -> ${BIN_DIR}/opd"
HDR=(-H "User-Agent: ${UA}")
if [ -n "${GH_TOKEN:-}" ]; then HDR+=( -H "Authorization: Bearer ${GH_TOKEN}" ); fi
curl -fSLo "${BIN_DIR}/opd" "${URL}" "${HDR[@]}"
chmod +x "${BIN_DIR}/opd"

echo "Installed: ${BIN_DIR}/opd"
if ! command -v opd >/dev/null 2>&1; then
  echo "Note: ${BIN_DIR} may not be on your PATH. Add this to your shell profile:"
  echo "  export PATH=\"${BIN_DIR}:\$PATH\""
fi

# Show version if reachable
if command -v opd >/dev/null 2>&1; then
  opd -v || true
fi

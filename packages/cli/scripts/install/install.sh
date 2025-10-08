#!/usr/bin/env bash
set -euo pipefail

OWNER="Dendro-X0"
REPO="OpenDeploy-CLI"
ASSET="opd.js"
INSTALL_DIR="${HOME}/.opd"
WRAPPER="${INSTALL_DIR}/opd"
# Allow pinning a specific tag via OPD_VERSION (e.g., v1.2.0-rc.1); default to latest
VERSION="${OPD_VERSION:-latest}"
if [ "${VERSION}" = "latest" ]; then
  URL_BASE="https://github.com/${OWNER}/${REPO}/releases/latest/download"
else
  URL_BASE="https://github.com/${OWNER}/${REPO}/releases/download/${VERSION}"
fi

log() { printf "[opd] %s\n" "$*"; }
err() { printf "[opd] ERROR: %s\n" "$*" >&2; }

# Ensure dependencies
if ! command -v curl >/dev/null 2>&1; then err "curl is required"; exit 1; fi
if ! command -v node >/dev/null 2>&1; then err "Node.js >= 18 is required"; exit 1; fi

mkdir -p "${INSTALL_DIR}"
cd "${INSTALL_DIR}"

log "Downloading ${ASSET} ..."
curl -fsSL "${URL_BASE}/${ASSET}" -o "${ASSET}.tmp"

# Optional checksum verification
if command -v shasum >/dev/null 2>&1 || command -v sha256sum >/dev/null 2>&1; then
  log "Verifying checksum ..."
  curl -fsSL "${URL_BASE}/checksums.txt" -o checksums.txt
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum --check --ignore-missing checksums.txt || { err "Checksum mismatch"; exit 1; }
  else
    SHATMP=$(shasum -a 256 "${ASSET}.tmp" | awk '{print $1}')
    if ! grep -q "${SHATMP}  ${ASSET}" checksums.txt; then err "Checksum mismatch"; exit 1; fi
  fi
else
  log "Skipping checksum verification (shasum/sha256sum not found)"
fi

mv -f "${ASSET}.tmp" "${ASSET}"

cat > "${WRAPPER}" <<'EOS'
#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "${DIR}/opd.js" "$@"
EOS
chmod +x "${WRAPPER}"

# PATH help
if ! echo ":$PATH:" | grep -q ":${INSTALL_DIR}:"; then
  log "Add to PATH (one-time):"
  log "  echo 'export PATH=\"${INSTALL_DIR}:$PATH\"' >> ~/.bashrc && source ~/.bashrc"
  log "Or add ${INSTALL_DIR} to your shell profile (zsh/fish)"
fi

log "Installed ${WRAPPER}"
log "Run: opd --help"

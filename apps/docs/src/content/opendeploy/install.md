# Install

This page describes supported installation methods for the OpenDeploy CLI. The recommended method is GitHub Releases, which gives you the short `opd` command.

## Install (recommended)

Download a prebuilt binary from GitHub Releases, make it executable, and place it in your PATH.

- Windows (PowerShell):
```powershell
$version = "v1.1.1"
$dest = "$env:USERPROFILE\\bin"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Invoke-WebRequest -Uri "https://github.com/Dendro-X0/OpenDeploy-CLI/releases/download/$version/opd-windows-x64.exe" -OutFile "$dest/opd.exe"
# Ensure $env:USERPROFILE\bin is on PATH, then:
opd -h
```

- macOS (Apple Silicon):
```bash
VERSION=v1.1.1
curl -L -o opd https://github.com/Dendro-X0/OpenDeploy-CLI/releases/download/$VERSION/opd-darwin-arm64
chmod +x opd && sudo mv opd /usr/local/bin/opd
opd -h
```

- macOS (Intel):
```bash
VERSION=v1.1.1
curl -L -o opd https://github.com/Dendro-X0/OpenDeploy-CLI/releases/download/$VERSION/opd-darwin-x64
chmod +x opd && sudo mv opd /usr/local/bin/opd
opd -h
```

- Linux (x64):
```bash
VERSION=v1.1.1
curl -L -o opd https://github.com/Dendro-X0/OpenDeploy-CLI/releases/download/$VERSION/opd-linux-x64
chmod +x opd && sudo mv opd /usr/local/bin/opd
opd -h
```

- Linux (arm64):
```bash
VERSION=v1.1.1
curl -L -o opd https://github.com/Dendro-X0/OpenDeploy-CLI/releases/download/$VERSION/opd-linux-arm64
chmod +x opd && sudo mv opd /usr/local/bin/opd
opd -h
```

Notes:
- The binary is self-contained; no Node.js is required.
- Prefer the Docker method below if you cannot install binaries system-wide.

### Windows (PowerShell) — auto-detect latest

```powershell
$Owner = 'Dendro-X0'
$Repo  = 'OpenDeploy-CLI'
# Detect latest tag; set $Version = 'v1.1.1' to pin
$hdr   = @{ 'User-Agent' = 'opd-installer' }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$rel   = Invoke-RestMethod -Headers $hdr "https://api.github.com/repos/$Owner/$Repo/releases/latest"
$Version = $rel.tag_name
$arch = (Get-CimInstance Win32_Processor).Architecture
$isArm = ($arch -eq 12)
$asset = if ($isArm) { 'opd-windows-arm64.exe' } else { 'opd-windows-x64.exe' }
$url = ($rel.assets | Where-Object name -eq $asset).browser_download_url
if (-not $url) { throw "Asset not found: $asset in $Version" }
$dest = "$env:USERPROFILE\bin"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Invoke-WebRequest -Headers $hdr -Uri $url -OutFile "$dest/opd.exe"
"Installed: $dest\opd.exe"; & "$dest/opd.exe" -v
```

### macOS/Linux — auto-detect latest

```bash
set -euo pipefail
OWNER=Dendro-X0 REPO=OpenDeploy-CLI UA=opd-installer
VERSION=$(curl -sH "User-Agent: $UA" https://api.github.com/repos/$OWNER/$REPO/releases/latest | jq -r .tag_name)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "$ARCH" in x86_64) ARCH=x64 ;; aarch64|arm64) ARCH=arm64 ;; *) echo "Unsupported arch: $ARCH"; exit 1 ;; esac
NAME="opd-${OS}-${ARCH}"
URL=$(curl -sH "User-Agent: $UA" https://api.github.com/repos/$OWNER/$REPO/releases/tags/$VERSION | jq -r ".assets[] | select(.name==\"$NAME\") | .browser_download_url")
sudo curl -L "$URL" -o /usr/local/bin/opd && sudo chmod +x /usr/local/bin/opd
opd -v
```

Troubleshooting downloads:
- If `Invoke-WebRequest` shows an HTML page or fails with a web exception, the URL may be wrong (no release/tag yet) or headers are missing. Use the API‑based scripts above, ensure a tag like `v1.1.1` exists, and that assets are attached (e.g., `opd-windows-x64.exe`).

## Docker/OCI (no Node required)

Use the container image published to GHCR (if available for your architecture).

```bash
docker run --rm -it \
  -v "$PWD:/work" -w /work \
  ghcr.io/dendro-x0/opd:latest start --provider vercel --env preview
```

Tip: add a tiny shell/pwsh wrapper named `opd` that calls the container so you can run `opd …` locally.

## Package managers (alternative)

Not available yet. We’ll update docs when the package is published to registries. Use GitHub Releases (above) or Docker instead.

### Git (dlx) — experimental

Running directly from Git is currently not supported for most users. It may work in limited scenarios, but we recommend the Releases binaries above (or Docker). We’ll revisit this path later.

## Verify

- Show help:
```bash
opd -h
```
- Run a dry-run plan:
```bash
opd -s --provider vercel --env preview --dry-run --json
```
- Use NDJSON streaming in CI:
```bash
OPD_NDJSON=1 opd start --provider vercel --env preview --ci
```

### First deploy (minimal)

```bash
# Non-interactive defaults, auto-detects framework and provider:
opd start --minimal

# Monorepo path example:
opd start --minimal --path apps/web
```

Shortcuts:
- `opd -v` — version
- `opd -h` — help
- `opd -s` — start wizard (equivalent to `opd start`)

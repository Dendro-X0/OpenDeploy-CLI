# Quick Start: Cloudflare Pages (Lite Mode)

Deploy to Cloudflare Pages using the official Wrangler CLI through OpenDeploy's lightweight wrappers.

## 1) Install `opd` wrapper

- Windows PowerShell
```powershell
$dest = "$env:USERPROFILE\bin\opd.ps1"
iwr "https://raw.githubusercontent.com/Dendro-X0/OpenDeploy-CLI/main/scripts/lite/opd.ps1" -UseBasicParsing -OutFile $dest
[Environment]::SetEnvironmentVariable('PATH', "$env:USERPROFILE\bin;" + $env:PATH, 'User')
$env:PATH = "$env:USERPROFILE\bin;" + $env:PATH
opd.ps1 --help
```

- macOS/Linux
```bash
mkdir -p ~/.local/bin
curl -fsSL "https://raw.githubusercontent.com/Dendro-X0/OpenDeploy-CLI/main/scripts/lite/opd.sh" -o ~/.local/bin/opd
chmod +x ~/.local/bin/opd
export PATH="$HOME/.local/bin:$PATH"
opd --help
```

## 2) Install provider CLI (Wrangler)

```bash
npm i -g wrangler
# requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID for non-interactive deploys
```

## 3) Deploy with a single command

```bash
opd start --path <APP_PATH> --provider cloudflare-pages --env preview --output dist
```

Tips:

- In monorepos, set `<APP_PATH>` to the app folder that contains `package.json` (not the repo root).
- Next on Pages is more reliable on Linux/CI or WSL for Windows users.
- Provide `--env production` or `--prod` for production deploys.

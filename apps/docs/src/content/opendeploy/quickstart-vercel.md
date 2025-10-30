# Quick Start: Vercel (Lite Mode)

Deploy to Vercel using the official Vercel CLI through OpenDeploy's lightweight wrappers. No binary packaging required.

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

## 2) Install provider CLI (Vercel)

```bash
npm i -g vercel
# optional, for non-interactive deploys
# export VERCEL_TOKEN=... (PowerShell: $env:VERCEL_TOKEN = "...")
```

## 3) Deploy with a single command

```bash
opd start --path <APP_PATH> --provider vercel --env preview
```

Tips:

- In monorepos, set `<APP_PATH>` to the app folder that contains `package.json` (not the repo root).
- Use `--env production` or `--prod` for a production deploy.
- If you prefer a guided flow, add `-s` to enable the wizard prompts.

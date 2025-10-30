# Quick Start: GitHub Pages (Lite Mode)

Deploy a static site to GitHub Pages using OpenDeploy's lightweight wrappers (delegates to `npx gh-pages`).

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

## 2) Prerequisites

- Ensure you have a writable git remote for the repository.
- For Next.js static export, set in `next.config.*`:
  - `output: 'export'`
  - `images.unoptimized: true`
  - `trailingSlash: true` (recommended)
  - If using Project Pages: `basePath: '/<repo>'` and `assetPrefix: '/<repo>/'`

## 3) Deploy with a single command

```bash
opd start --path <APP_PATH> --provider github-pages --output dist
```

Tips:

- In monorepos, set `<APP_PATH>` to the app folder that contains `package.json` (not the repo root).
- Use your framework’s build to write `dist/` (e.g., `pnpm build && pnpm next export`).
- The wrapper runs `npx gh-pages -d dist` from your app directory.

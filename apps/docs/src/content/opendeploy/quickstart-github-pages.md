# Quick Start: GitHub Pages (3 steps)

Deploy a static Next.js/SSG site to GitHub Pages using OpenDeploy CLI.

## 1) Install and Start

```bash
# macOS/Linux
curl -fsSL "https://raw.githubusercontent.com/Dendro-X0/OpenDeploy-CLI/main/packages/cli/install/install.sh" | bash
opd start

# Windows PowerShell
iwr "https://raw.githubusercontent.com/Dendro-X0/OpenDeploy-CLI/main/packages/cli/install/install.ps1" -UseBasicParsing | iex
opd start
```

The Start wizard detects your framework and provider. For GitHub Pages, it offers to:

- Ensure `public/.nojekyll` exists (avoids asset mangling).
- Patch `next.config.*` for static export (if Next.js):
  - `output: 'export'`
  - `images.unoptimized: true`
  - `trailingSlash: true` (recommended)
  - `basePath` and `assetPrefix` for Project Pages: expected `basePath` is `/<repo>`, and `assetPrefix` is `/<repo>/`

In JSON/CI mode, these fixes auto‑apply.

## 2) Configure CI Workflow

Use the wizard’s “GitHub Actions (recommended)” option. It writes `.github/workflows/deploy-pages.yml` and prints a deep‑link to Actions.

Per‑app reusable workflow (monorepo):

```bash
opd generate github --reusable
# writes .github/workflows/deploy-app-gh-pages.yml using _reusable-gh-pages.yml
```

Then commit and push:

```bash
git add .github/workflows/deploy-pages.yml
git commit -m "chore(ci): deploy to GitHub Pages"
git push origin HEAD
```

Optionally, set the repo’s Pages settings to deploy from “GitHub Actions”.

## 3) Verify Deployment

- Open your site at `https://<owner>.github.io/<repo>`
- Or use:

```bash
opd open github
```

Tips:

- Local build before pushing:

```bash
# static export (Next.js)
pnpm build && pnpm next export
# or use your framework’s build command
```

- Troubleshooting common issues (missing CSS/assets):

```bash
opd doctor --strict
opd up github --preflight-only --strict-preflight --json
```

Notes:

- The CLI ensures a `.nojekyll` marker in your artifact so `_next/` assets are published.
- For Project Pages, mismatched `basePath`/`assetPrefix` is the most common cause of missing CSS/JS. The CLI now prints explicit hints if it detects a mismatch.

## Screenshots (placeholders)

<div style={{ display: 'grid', gap: 12 }}>
  <img alt="Start wizard" src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/screens/wizard-start.svg`} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--gray-800)' }} />
  <img alt="GitHub Actions run" src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/screens/github-actions-run.svg`} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--gray-800)' }} />
</div>

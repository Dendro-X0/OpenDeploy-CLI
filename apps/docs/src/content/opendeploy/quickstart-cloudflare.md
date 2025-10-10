# Quick Start: Cloudflare Pages (3 steps)

Deploy a Next.js (SSR/hybrid) or static site to Cloudflare Pages with OpenDeploy CLI.

## 1) Install and Start

```bash
# macOS/Linux
curl -fsSL "https://raw.githubusercontent.com/Dendro-X0/OpenDeploy-CLI/main/packages/cli/install/install.sh" | bash
opd start

# Windows PowerShell
iwr "https://raw.githubusercontent.com/Dendro-X0/OpenDeploy-CLI/main/packages/cli/install/install.ps1" -UseBasicParsing | iex
opd start
```

The Start wizard detects your framework and provider. For Cloudflare Pages, it offers to:

- Generate `wrangler.toml` with Next on Pages defaults.
- Patch `next.config.*` (if Next.js) to remove static‑export settings, empty `basePath`, and recommend `trailingSlash: false`.

In JSON/CI mode, these fixes auto‑apply.

## 2) Preview Deploy

```bash
opd start --provider cloudflare --env preview --json
```

- Streams deploy and prints a final JSON summary with `final: true`.
- Also prints a logs/dashboard URL if available.

Tip (Windows): Next on Pages is most reliable on Linux/CI or WSL; prefer the generated GitHub Actions workflow for repeatable builds.

## 3) Production

Deploy production builds by setting `--env prod` or via your workflow triggers:

```bash
opd start --provider cloudflare --env prod
```

Tips:

- Logs/dashboard URL:

```bash
opd deploy logs cloudflare --open
```

- Preflight (no side effects):

```bash
opd up cloudflare --preflight-only --strict-preflight --json
```

## Screenshots (placeholders)

<div style={{ display: 'grid', gap: 12 }}>
  <img alt="Start wizard" src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/screens/wizard-start.svg`} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--gray-800)' }} />
  <img alt="Cloudflare Pages dashboard" src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/screens/cloudflare-dashboard.svg`} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--gray-800)' }} />
</div>

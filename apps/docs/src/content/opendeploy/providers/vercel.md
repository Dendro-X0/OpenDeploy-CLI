---
title: Vercel — Provider Guide
description: Follow Logs, Alias/Rollback, Doctor & Preflight checks, and VSCode onboarding for Vercel with OpenDeploy.
---

# Vercel — Provider Guide

This page covers Vercel-specific workflows in OpenDeploy: following logs, setting aliases, rolling back production, doctor & preflight checks, and the VSCode extension onboarding.

## Follow Logs

- CLI

```bash
opd logs vercel --follow
```

Notes:
- Streams human-readable logs by default.
- If you enable NDJSON (e.g., `OPD_NDJSON=1` or `--ndjson`), you also receive a final JSON summary at the end.

- VSCode Extension
  - Command Palette: "OpenDeploy: Follow Logs" (Ctrl+Alt+L / Cmd+Alt+L)
  - Control Panel: "Follow Logs" button
  - Summary Panel: "Follow Logs" button

## Alias & Rollback

- CLI

Set alias:
```bash
opd alias vercel --set <domain> --deployment <idOrUrl> [--project <id>] [--org <id>] [--path <dir>] [--json]
```

Rollback to a prior successful production deployment (existing command):
```bash
opd rollback vercel --alias <prod-domain> [--to <url|sha>] [--path <dir>] [--project <id>] [--org <id>] [--dry-run] [--json]
```

Notes:
- Monorepos: the CLI prefers a linked app directory (`apps/*/.vercel/project.json`), then falls back to the repo root if linked there.
- If `--project` or `--org` are provided, OpenDeploy attempts a non-interactive `vercel link` before aliasing.
- `--json` or `--ndjson` emit final JSON summaries useful for automation.

- VSCode Extension
  - Command Palette:
    - "OpenDeploy: Vercel — Set Alias" (Ctrl+Alt+A / Cmd+Alt+A)
    - "OpenDeploy: Vercel — Rollback" (Ctrl+Alt+R / Cmd+Alt+R)
  - Summary Panel affordances:
    - "Alias" button appears for Vercel deployments and pre-fills the deployment URL.

## Doctor & Preflight (Actionable Hints)

Run:
```bash
opd doctor [--json] [--verbose] [--fix] [--path <dir>]
```

Vercel checks and hints include:
- Vercel CLI installed and authenticated (`vercel whoami`).
- Vercel linking presence (`.vercel/project.json`) in the app directory.
- Monorepo root and app path detection for safe deploy cwd.
- Cloudflare Wrangler auth (for multi-provider repos).
- Optional toolchain checks (pnpm, Bun, Prisma, Drizzle, psql) with caveats.

Next on Pages (for Cloudflare) and Next static export (for GH Pages) checks:
- Presence of `.vercel/output/static` (Next on Pages build artifact directory).
- Presence of `wrangler.toml` with `name = "<project>"`.
- For GitHub Pages + Next.js static export:
  - `next.config` has `output: 'export'`, `trailingSlash: true`, `images.unoptimized: true`.
  - `basePath`/`assetPrefix` alignment with repo name when deploying to Project Pages.
  - `.nojekyll` present in `public/` or `out/`.

Use `--fix` to auto-write `.nojekyll` and attempt `vercel link`/`netlify link` when IDs are provided.

## VSCode Extension — Onboarding Wizard

Open the wizard:
- Command Palette: "OpenDeploy: Onboarding" (shows a guided flow)

Flow:
1. Pick a project/app path (monorepo-aware).
2. Pick a provider (Vercel | Cloudflare Pages).
3. Check provider authentication; if missing, one-click opens a login terminal.
4. Choose an action: Plan, Deploy, or Follow Logs.
5. Open the Summary Panel for actionable buttons (Open URL, Open Logs, Follow Logs, Alias for Vercel).

Tips:
- Enable JSON view in the extension to capture NDJSON events and final JSON summaries.
- Use the Control Panel for quick access and toggles.

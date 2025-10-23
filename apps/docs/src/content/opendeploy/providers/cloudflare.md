---
title: Cloudflare Pages — Provider Guide
description: Follow Logs, Inspect/Dashboard links, Next on Pages preflight checks, and VSCode onboarding for Cloudflare Pages with OpenDeploy.
---

# Cloudflare Pages — Provider Guide

This page covers Cloudflare Pages workflows in OpenDeploy: opening/inspecting logs, Next on Pages preflight checks, and the VSCode extension onboarding.

## Logs & Inspect

- CLI

```bash
opd logs cloudflare [--open] [--json]
```

Notes:
- Resolves the latest deployment URL and an Inspect/Dashboard link.
- `--open` opens the dashboard in your browser.
- Emits a final JSON summary with `url`/`inspectUrl` when `--json` or `--ndjson` is enabled.

- VSCode Extension
  - Command Palette: "OpenDeploy: Follow Logs"
  - Control Panel: "Follow Logs" button (choose Cloudflare)
  - Summary Panel: "Open Logs" button

## Doctor & Preflight (Next on Pages)

Run:
```bash
opd doctor [--json] [--verbose] [--fix] [--path <dir>]
```

Checks include (best-effort):
- `.vercel/output/static` directory exists (Next on Pages artifact).
- `wrangler.toml` presence and fields:
  - `name = "<project>"`
  - `pages_build_output_dir = ".vercel/output/static"`
  - `pages_functions_directory = ".vercel/output/functions"` (optional)

Suggestions:
- If missing, generate config and build locally:
  - `opd generate cloudflare --reusable --project-name <name>`
  - `npx @cloudflare/next-on-pages@1`

## VSCode Extension — Onboarding Wizard

Open the wizard:
- Command Palette: "OpenDeploy: Onboarding" (guided in-panel flow)

Flow:
1. Pick project/app path (monorepo-aware).
2. Pick provider (Cloudflare Pages).
3. Check Wrangler authentication; if missing, quick link to login.
4. Choose an action: Plan, Deploy, or Follow Logs.
5. Use Summary affordances for quick links (Open Logs).

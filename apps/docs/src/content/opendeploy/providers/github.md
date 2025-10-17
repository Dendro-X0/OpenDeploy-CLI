---
title: GitHub Pages — Provider Guide
description: Deploy, open logs (Actions), Doctor & Preflight checks, and VSCode onboarding for GitHub Pages with OpenDeploy.
---

# GitHub Pages — Provider Guide

This page covers GitHub Pages workflows in OpenDeploy: opening logs (Actions), deployment basics, doctor & preflight checks for static export, and the VSCode extension onboarding.

## Open Logs (GitHub Actions)

- CLI

```bash
opd open github
```

This opens your repository's GitHub Actions page. Use it to view job logs and artifacts.

- VSCode Extension
  - Command Palette: "OpenDeploy: Open GitHub Actions" (Ctrl+Alt+G / Cmd+Alt+G)
  - Control Panel: "Open GitHub" button
  - Summary Panel: "Open Logs" button (when appropriate)

## Deploy (Basics)

Use the generator to scaffold reusable GitHub Pages workflows for static exports (e.g., Next.js `output: 'export'`). See the [Workflow Generation](/docs/opendeploy/workflows) guide.

Common issues are surfaced via `opd doctor` (see below).

## Doctor & Preflight (Static Export Checks)

Run:
```bash
opd doctor [--json] [--verbose] [--fix] [--path <dir>]
```

Checks include:
- Git remote origin and `gh-pages` remote branch readiness.
- Next.js static export hints for GitHub Pages:
  - `next.config` has `output: 'export'`, `trailingSlash: true`, `images.unoptimized: true`.
  - `basePath`/`assetPrefix` aligned with repo name for Project Pages.
  - `.nojekyll` present in `public/` or `out/`.

Use `--fix` to auto-write `.nojekyll` and other best-effort remediations.

## VSCode Extension — Onboarding Wizard

Open the wizard:
- Command Palette: "OpenDeploy: Onboarding" (guided in-panel flow)

Flow:
1. Pick project/app path (monorepo-aware).
2. Pick provider (GitHub Pages).
3. Choose an action: Plan, Deploy, or Open Logs (Actions).
4. Check Summary affordances for quick links (Open URL, Open Logs).

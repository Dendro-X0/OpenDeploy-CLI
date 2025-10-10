# Roadmap

OpenDeploy’s roadmap captures near‑term priorities, planned enhancements, and longer‑term expansions. It mirrors the repository’s `ROADMAP.md` and stays updated alongside releases.

> Scope: OpenDeploy targets web deployments (static or SSR) on web providers. Mobile (app stores) and desktop (installers) are out of scope.

## Current Status

- Vercel, Cloudflare Pages, and GitHub Pages supported in the Start wizard with consistent `url` / `logsUrl` summaries.
- TypeScript‑first stacks and frameworks prioritized (Next.js, Astro, SvelteKit, Remix static).
- Deterministic JSON summaries (`final: true`), NDJSON progress, `--gha` preset for CI.

## Near‑Term (1–2 sprints)

- __Wizard & Summaries__
  - Ensure `done` NDJSON always emits (success/failure). Clear `reason` fields for timeouts and cancels.
  - Improve `explain` clarity and parity with `up` plan.
- __Cloudflare Pages__
  - Surface Inspect links consistently via `opd logs cloudflare --open`.
  - Explore SSR support paths and guidance.
- __GitHub Pages__
  - Site origin helpers, workflow hints, and better error remediation tips.
- __Docs & DX__
  - Streamline Overview/Quick Start; unify examples with `opd` alias.
  - Dynamic site version (synced from CLI) with release links.
  - A11y and layout polish across sidebar, pager, and reading indicator.

## Medium‑Term (Outlook)

- __Stacks__
  - Go and Rust support (detectors, build outputs, and minimal templates).
- __Providers__
  - AWS (e.g., Amplify/CloudFront/Lambda@Edge) exploration; Render/Fly.io adapters backlog.
- __Tooling__
  - IDE extension and/or MCP integration for in‑editor flows (detect, plan, env, deploy).

## UX & CI Improvements

- Better error mapping and actionable remedies (`errorLogTail`, `logsUrl`).
- Always‑on capture in CI (`--gha` or `--capture`), compact JSON with timestamps.
- Monorepo ergonomics: workspace lock, link hints, path selection cues.

## Known Limitations

- SSR adapters for Remix/React Router v7 vary by provider; static is supported broadly.
- pnpm secure scripts may block native post‑installs; approve builds or add `trustedDependencies`.

## Change Log & Updates

- Release notes ship with every tag on GitHub.
- See also: `docs/commands.md` and `docs/recipes.md` for usage patterns.

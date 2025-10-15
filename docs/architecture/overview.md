# OpenDeploy vNext Architecture — Overview (Phase 1)

Status: research draft during project pause. This document maps the current monorepo and frames the proposed boundaries for a reliable vNext.

## Monorepo layout

- `apps/`
  - `apps/extension/`: VSCode extension (TypeScript). Entry `dist/extension.js` from `src/extension.ts`. Minimal UI via webviews (`src/panel.ts`, `src/summary.ts`), status bar (`src/status.ts`), run plumbing (`src/run.ts`).
  - `apps/docs/`: Next.js docs site (non-critical for vNext shipping; keep archived until later).
- `packages/`
  - `packages/cli/`: Node/TS CLI. Contains `src/index.ts` entry, commands, core utilities, providers, schemas, and tests. Includes historical Go sidecar (`packages/cli/go/`) for process execution; keep optional.

## Tooling

- Package manager: `pnpm` (pinned in root `package.json`).
- Orchestration: Turborepo (`turbo.json` basic tasks).
- Workspaces: `pnpm-workspace.yaml` → `apps/*`, `packages/*`.
- Extension packaging: `vsce` via staging script (`apps/extension/scripts/stage-package.mjs`).
- CLI bundling: `tsup` in `packages/cli`.

## Current responsibilities (as-implemented)

- CLI (`packages/cli`)
  - Commands under `src/commands/` for providers and utilities (CI sync/summarize, doctor, etc.).
  - Core helpers under `src/core/`, `src/utils/`, `src/types/`.
  - Providers under `src/providers/` (GitHub Pages, Cloudflare, Vercel; maturity varies).
  - Emits human text and JSON/NDJSON lines (see Events doc).
- Extension (`apps/extension`)
  - Presents a Control Panel (`src/panel.ts`) and Summary panel (`src/summary.ts`).
  - Orchestrates runs (`src/run.ts`), prints Output Channel banners, and surfaces a best logs URL.
  - Provides generator for GH Pages workflow (`src/generate.ts`).

## vNext boundaries (proposed)

- `packages/core` (new): shared types (event/summary/hint), provider interfaces, logger abstraction.
- `packages/providers/github-pages` (MVP): implements provider contract; `vercel`, `cloudflare` later.
- `packages/cli`: thin wrapper; pulls providers via `core` interfaces; only prints.
- `apps/extension`: UI only; calls CLI or a thin RPC boundary; no provider logic inside UI.

## Minimal viable feature set (vNext)

- Providers: GitHub Pages only (Plan, Doctor, Generate workflow). Others deferred.
- Outputs: Deterministic NDJSON events, final summary, and top N hints.
- Two smoke tests (Windows-first): CLI Plan+Doctor on a tiny static sample; Extension run via VSIX.

## Risks and friction (current)

- Windows path/process quirks.
- Monorepo packaging (vsce scanning, staged VSIX) — mitigated with staging.
- Feature creep pre-MVP; address by freezing scope above.

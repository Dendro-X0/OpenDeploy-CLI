# Code Inventory (Phase 1)

This document maps important code paths to their responsibilities to help guide the vNext redesign.

## apps/extension/

- `src/extension.ts` — entrypoint. Registers commands, status bar, and connects webviews (panel/summary) to run plumbing.
- `src/panel.ts` — Control Panel webview (app picker, Plan/Deploy/Doctor/Detect, JSON toggle, GH Pages generator, auth buttons, open summary). Posts messages back to `extension.ts`.
- `src/summary.ts` — Summary webview (compact JSON summary rendering).
- `src/run.ts` — Runs the CLI via child process, streams stdout/stderr, collects candidate log URLs, surfaces best link, optional callbacks `onJson`, `onAuthRequired`.
- `src/generate.ts` — Writes GitHub Pages workflow (inline/reusable variant) into `.github/workflows/deploy-gh-pages.yml`.
- `src/detect.ts` — Finds candidate apps in monorepo (scans `apps/`, `packages/`).
- `src/config.ts` — Reads extension settings (runner, npmBinary, dockerImage, defaultPath, preferJson).
- `src/status.ts` — Status bar items and "Plan" quick action.
- `src/output.ts` — Output channel utilities.
- `src/storage.ts` — Workspace state helpers for remembering last selected app.

## packages/cli/

- `src/index.ts` — CLI entrypoint (Commander). Wires subcommands.
- `src/commands/` — Primary features:
  - `plan.ts`, `doctor.ts`, `deploy.ts`, `up.ts`, `start.ts` (wizard), `detect.ts` (framework), `generate.ts` (workflows), `ci-logs.ts` (CI helpers), etc.
- `src/core/`, `src/utils/`, `src/types/` — Helpers (summaries, schema validation, timing, logging), type definitions.
- `src/providers/` — Provider-specific logic (GitHub Pages, Cloudflare, Vercel). Varying maturity and special cases.
- `src/schemas/` — JSON Schemas for outputs; draft-07 aligned.
- Tests under `src/__tests__/` — Include logsUrl expectations and provider mocks.

## Packaging/Tooling

- Root: Turborepo (`turbo.json`), workspace (`pnpm-workspace.yaml`), scripts for CI log sync.
- CLI: `tsup` bundling (`build`), optional `pkg` binary targets, `vitest` tests.
- Extension: `tsc` build to `dist/`, `vsce` packaging via staged script `scripts/stage-package.mjs`.

## Notable complexity & debt (to address in vNext)

- Mixed concerns between CLI and Extension (provider details occasionally bleed into UI expectations).
- Event field naming inconsistencies (`phase`/`stage`/`event`).
- Windows path/process quirks in long-running child processes.
- Provider sprawl and differing maturity; GH Pages should be the MVP focus.

# vNext Migration Plan (Phase 2)

This plan maps the current codebase to the proposed vNext package layout and describes the refactor steps to reach a stable MVP.

## Target package layout

- `packages/core/`
  - `src/contracts/` — provider/event/summary/hint types (see `core-contract.md`)
  - `src/process/` — ProcessRunner abstraction (spawn, timeouts, windows shims)
  - `src/events/` — utilities to emit NDJSON `OpdEvent` and final `OpdSummary`
- `packages/providers/github-pages/`
  - `src/index.ts` — exports `GithubPagesProvider` implementing `Provider`
  - `src/build.ts`, `src/deploy.ts`, `src/detect.ts`, `src/hints.ts`
- `packages/cli/`
  - `src/index.ts` — commands wired to `packages/core` contracts and provider registry
  - `src/commands/*.ts` — emit standardized events/summaries
- `apps/extension/`
  - unchanged structure; consumes normalized NDJSON and final summaries only

## Old → New mapping (high level)

- `packages/cli/src/core/provider-system/providers/github-pages.ts` → `packages/providers/github-pages/src/*`
- `packages/cli/src/core/provider-system/providers/{cloudflare-pages,vercel}.ts` → deferred (post-MVP)
- `packages/cli/src/utils/{process,logger,summarize,...}` → split between `packages/core/src/process` and `packages/core/src/events`
- `packages/cli/src/commands/{plan,doctor,generate,deploy,up,start}` → keep in `packages/cli`, refactor to use core contracts and emit normalized events
- Extension `apps/extension/src/run.ts` → no provider logic; trusts `logsUrl` + hints from summaries; scraping becomes fallback only

## Step-by-step refactor

1) Core scaffolding (no behavior change)
- Create `packages/core` with `contracts` (Provider, events, summaries, hints) and `process` (ProcessRunner interface only).
- Add TS project references if used; ensure `pnpm -C packages/core build` works.

2) ProcessRunner implementation
- Implement cross-platform spawn with arg arrays by default, `.cmd` shims on Windows, timeouts and idle timeouts, cancellation, and stdout/stderr streams.
- Replace direct `proc.run` usages in MVP provider during the move.

3) Provider: GitHub Pages
- Move logic into `packages/providers/github-pages` and adapt to `Provider` contract.
- Quote all paths; replace shell strings with arg arrays.
- Ensure `deploy()` returns `logsUrl` when determinable.
- Add unit tests for artifact detection and command building on Windows paths.

4) CLI rewire
- Create a provider registry that exposes `github-pages` only for MVP.
- Update `plan`, `doctor`, `generate`, and `deploy` to:
  - call provider via `packages/core` contracts
  - emit NDJSON `phase` events and a single final JSON summary per command
  - include `hints` consistently

5) Extension alignment
- No code move; switch to trusting `logsUrl` from summary, keep scraping as fallback for older CLIs.
- Update any provider-specific assumptions in the UI; mark non-MVP providers as disabled/not available.

6) Smoke tests (Windows-first)
- Author the static sample (untracked) and run Test A/B/C from `docs/runbooks/smoke-tests.md`.
- Ensure clean machine success for both CLI and VSIX.

## Acceptance criteria

- CLI MVP (GitHub Pages only) commands produce normalized events and exactly one final summary with `ok` and `provider: 'github-pages'`.
- Extension panel runs Plan/Doctor successfully using the new CLI and shows a single best logs URL.
- Smoke tests pass on a fresh Windows environment.

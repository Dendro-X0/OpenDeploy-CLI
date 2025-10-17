# Events Normalization Checklist (Phase 1 → vNext)

Goal: ensure every command emits consistent NDJSON (`OpdEvent`) and a single final JSON summary (`OpdSummary`) aligned to `core-contract.md`.

## Targets
- Use `phase` (not `stage`/`event`).
- `provider`: `'github-pages' | 'vercel' | 'cloudflare-pages'`.
- Final summary per command: `{ ok, action, provider?, framework?, publishDir?, url?, logsUrl?, hints?, final: true }`.
- Hints: array of `{ code, message, action? }` objects.

## Command-by-command

- plan
  - Today: `packages/cli/src/commands/plan.ts` prints JSON with `capabilities`, `framework`, `publishDir`, `cmdPlan`, `final: true`.
  - Changes:
    - Ensure `provider` uses canonical id (`github-pages` instead of `github`).
    - Add `hints: []` field even when empty (stability for consumers).

- doctor
  - Today: `packages/cli/src/commands/doctor.ts` prints an annotated JSON with schema flags.
  - Changes:
    - Normalize to final summary with compact `hints` derived from failing checks.
    - Add `phase` NDJSON events for each check group (toolchain, auth, monorepo, next, github-pages).

- up
  - Today: `packages/cli/src/commands/up.ts` emits NDJSON lines (sometimes `stage`) and a final JSON with `logsUrl` for vercel.
  - Changes:
    - Rename `stage`→`phase` in NDJSON.
    - Ensure `logsUrl` is included in the final summary when available for all providers (if applicable).

- start (wizard)
  - Today: `packages/cli/src/commands/start.ts` emits `{ action:'start', event:'done' }` for Cloudflare in some paths.
  - Changes:
    - Use `phase:'done'` (not `event`).
    - Ensure a final summary exists in all paths with `{ final: true }`.

## Provider ids mapping (transition)
- Current → vNext
  - `github` → `github-pages`
  - `cloudflare` → `cloudflare-pages`
  - `vercel` → `vercel`

## Code locations to update
- plan: `packages/cli/src/commands/plan.ts`
- doctor: `packages/cli/src/commands/doctor.ts`
- up: `packages/cli/src/commands/up.ts`
- start: `packages/cli/src/commands/start.ts`
- schemas: `packages/cli/src/schemas/*` (align enums and fields)
- providers: translate provider ids and ensure `DeployResult.logsUrl` presence when possible

## Extension expectations
- Consumes NDJSON `phase` and the final summary exclusively; no parsing of human logs required in vNext.
- Scraping remains as a backward-compatibility fallback only.

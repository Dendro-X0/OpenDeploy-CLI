# Provider: Vercel (Current State — Phase 1)

Sources:
- `packages/cli/src/core/provider-system/providers/vercel.ts`
- `packages/cli/src/commands/up.ts`, `packages/cli/src/commands/start.ts` (events and summaries)

## Capabilities (declared)
- Local build: false (prefers remote builds)
- Remote build: true
- Static deploy: true
- SSR: true
- Edge functions: true
- Logs follow: true (provider supports it; current CLI captures Inspect URL heuristically)
- Project linking: yes (via `vercel link --yes` with `--project`/`--org`)

## Detection
`detect(cwd)` → `{ framework?, publishDir? }` via auto detector.

## Auth/prereqs
`validateAuth(cwd)`
- Resolves `vercel` binary (`vercel`, `vercel.cmd`, absolute `where`), with `npx`/`pnpm dlx` fallbacks.
- Requires `vercel --version` and `vercel whoami` to succeed; errors instruct to install/login.

## Link
`link(cwd, project)`
- Runs `vercel link --yes [--project <id>] [--org <id>]` when ids provided.
- Reads `.vercel/project.json` to pick up `projectId` if available.

## Build
`build` returns `{ ok: true }` (remote build provider).

## Deploy
`deploy({ cwd, envTarget })`
- Runs `vercel deploy --prod --yes` (production) or `vercel deploy --yes` (preview).
- Parses preview URL(s) from stdout (e.g., `*.vercel.app`).
- Parses Inspect/Logs URL from stderr (e.g., `vercel.com/.../inspect/...`).
- If no Inspect URL seen during stream but a deploy URL exists, calls `vercel inspect <url>` to obtain one.
- Returns `{ ok, url, logsUrl }`.

## Generate config
`generateConfig({ detection, cwd })` writes a minimal `vercel.json` including `version: 2`, `buildCommand`, and optional `outputDirectory`.

## Risks / gaps (vNext work)
- Binary resolution and shell string construction must be centralized to reduce Windows fragility.
- Ensure every final summary includes the `logsUrl` when known; avoid relying on scraping stderr in the extension.
- Normalize provider id to `vercel` and event fields to use `phase` consistently.

# OpenDeploy Events and Summaries (Current Mapping)

Status: Phase 1 research draft. This captures fields emitted today to inform the vNext contract.

## Canonical summary fields (observed)

- `ok: boolean` — overall success/failure for a step or final summary
- `action: "plan" | "up" | "start" | "doctor" | string` — command context
- `provider: "github" | "vercel" | "cloudflare" | string`
- `phase` or `stage: string` — optional progress marker
- `url?: string` — deployed URL when present
- `logsUrl?: string` — link to provider/CI logs
- `message?: string` — human friendly message
- `error?: string` — error text if any
- `final?: boolean` — indicates the final JSON line for a command
- `hints?: Array<string | { code?: string; message: string; action?: string }>` — remediation items

## JSON/NDJSON sources

- `packages/cli/src/commands/up.ts`
  - Emits NDJSON during Vercel deploy (`stage: 'logsUrl'`, `stage: 'deployed'`)
  - Final JSON summary includes `ok`, `provider`, `target`, `url`, `logsUrl`, `final: true`
- `packages/cli/src/commands/start.ts`
  - Wizard-mode emits events; Cloudflare path emits `{ action: 'start', provider: 'cloudflare', event: 'done', ok, url, logsUrl }`
- `packages/cli/src/utils/summarize.ts`
  - Human summary includes `Inspect:` line if `logsUrl` exists
- Schemas (draft-07 aligned)
  - `src/schemas/up-summary.schema.ts` → `logsUrl: string`
  - `src/schemas/provider-*-result.schema.ts` → `logsUrl: string`

## Gaps and inconsistencies (to resolve in vNext)

- Some events use `phase` vs `stage` vs `event` — normalize to `phase`.
- Hints are strings or objects; normalize to `{ code, message, action? }`.
- Finality signaled by `final: true` inconsistently; ensure every command has exactly one final summary.
- Provider naming: normalize to enum (`github-pages`, `vercel`, `cloudflare-pages`).
- Ensure every final summary carries `logsUrl` when remotely available (with fallback heuristics only as a last resort).

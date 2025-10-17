---
title: vNext Output Contract
description: Canonical JSON/NDJSON contract for OpenDeploy CLI vNext
---

# vNext Output Contract

This page defines the canonical output format for OpenDeploy CLI vNext. It standardizes both streaming NDJSON events and the final JSON summary so the VSCode extension and CI can reliably consume results.

> Reference: a detailed, developer-facing spec also lives at `docs/architecture/output-contract.md` in the repo root.

## Canonical Provider IDs

- `vercel`
- `cloudflare-pages`
- `github-pages`
- `turbo` (for generator outputs)

All CLI JSON/NDJSON outputs use these canonical IDs, even if the user typed aliases (`cloudflare`, `github`).

## NDJSON Events (OpdEvent)

Events are newline-delimited JSON lines describing phases and progress. They are optional and intended for interactive UIs and CI logs.

```ts
export interface OpdEvent {
  readonly action: 'plan' | 'deploy' | 'generate' | 'doctor' | string
  readonly provider?: 'vercel' | 'cloudflare-pages' | 'github-pages' | 'turbo'
  readonly phase?: string
  readonly message?: string
  readonly path?: string
  readonly candidates?: readonly string[]
  readonly redacted?: boolean
}
```

Notes:
- Minimal fields are guaranteed; providers may add more per phase.
- Events are ephemeral; prefer the final JSON summary for automation.

## Final Summary (OpdSummary)

Every command emits exactly one final JSON object with `final: true`.

Common fields:

```ts
export interface OpdSummaryBase {
  readonly ok: boolean
  readonly action: 'plan' | 'deploy' | 'generate' | 'doctor'
  readonly hints: readonly string[]
  readonly final: true
}
```

### plan
```ts
interface PlanSummary extends OpdSummaryBase {
  readonly action: 'plan'
  readonly provider: 'vercel' | 'cloudflare-pages' | 'github-pages'
  readonly capabilities: Record<string, unknown>
  readonly target: 'preview' | 'production'
  readonly cwd: string
  readonly framework?: string
  readonly publishDir?: string
  readonly cmdPlan: readonly string[]
}
```

### deploy
```ts
interface DeploySummary extends OpdSummaryBase {
  readonly action: 'deploy'
  readonly provider: 'vercel' | 'cloudflare-pages' | 'github-pages'
  readonly target: 'prod' | 'preview'
  readonly url?: string
  readonly logsUrl?: string
  readonly projectId?: string
  readonly durationMs?: number
  readonly message?: string // when ok=false
}
```

### generate
```ts
interface GenerateSummary extends OpdSummaryBase {
  readonly action: 'generate'
  readonly provider: 'vercel' | 'cloudflare-pages' | 'github-pages' | 'turbo'
  readonly path: string
  readonly mode?: string // e.g., 'reusable', 'next-on-pages'
}
```

### doctor
```ts
interface DoctorSummary extends OpdSummaryBase {
  readonly action: 'doctor'
  readonly results: Array<{ readonly name: string; readonly ok: boolean; readonly message: string }>
  readonly suggestions: readonly string[]
  readonly schemaOk?: boolean
  readonly schemaErrors?: readonly string[]
}
```

## Emission Rules

- Always emit a single final JSON object with `final: true`.
- Always use canonical provider IDs.
- Always include `hints: []` (empty array when none).
- Respect modes:
  - `--json`: suppress human logs; print only the final summary.
  - `OPD_NDJSON=1`: stream NDJSON events; still end with the final summary.

## Stability

- These fields are stable for the MVP. Additive fields may appear later without breaking existing consumers.

## Examples

- See `packages/cli/src/commands/{plan,deploy,generate,doctor}.ts` for emitters following this contract.

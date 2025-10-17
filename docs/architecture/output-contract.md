# vNext Output Contract

This document defines the canonical output format for OpenDeploy CLI vNext. It standardizes both streaming NDJSON events and the final JSON summary, so the VSCode extension and CI tools can reliably consume results.

## Canonical Provider IDs

- `vercel`
- `cloudflare-pages`
- `github-pages`
- `turbo` (for generator outputs)

These identifiers are emitted in all JSON summaries and NDJSON events. Aliases provided on the CLI (e.g., `cloudflare`, `github`) are normalized to the canonical forms above.

## NDJSON Events (`OpdEvent`)

Events are newline-delimited JSON (NDJSON) lines that describe phases and progress. They are optional and mainly intended for interactive UIs and CI logs. Typical events include phase transitions, provider subprocess output, and app-path detection.

Shape (TypeScript):

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
- Only a minimal set is guaranteed; providers/commands may add fields relevant to a phase.
- Events are ephemeral; do not parse them for durable automation. Prefer the final summary.

## Final Summary (`OpdSummary`)

Every command emits a single final JSON object summarizing the outcome. This is the source of truth for automation.

Common fields:

```ts
export interface OpdSummaryBase {
  readonly ok: boolean
  readonly action: 'plan' | 'deploy' | 'generate' | 'doctor'
  readonly hints: readonly string[]
  readonly final: true
}
```

### plan summary

```ts
interface PlanSummary extends OpdSummaryBase {
  readonly action: 'plan'
  readonly provider: 'vercel' | 'cloudflare-pages' | 'github-pages'
  readonly capabilities: Record<string, unknown> // ProviderCapabilities
  readonly target: 'preview' | 'production'
  readonly cwd: string
  readonly framework?: string
  readonly publishDir?: string
  readonly cmdPlan: readonly string[]
}
```

Example:

```json
{
  "ok": true,
  "action": "plan",
  "provider": "github-pages",
  "capabilities": { "name": "GitHub Pages", "supportsStaticDeploy": true },
  "target": "preview",
  "cwd": "/workspace/repo",
  "cmdPlan": ["gh-pages -d dist"],
  "hints": [],
  "final": true
}
```

### deploy summary

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

Notes:
- For GitHub Pages, `url` is best-effort based on `git remote get-url origin`.
- For Cloudflare Pages and Vercel, `logsUrl` may be present.

### generate summary

```ts
interface GenerateSummary extends OpdSummaryBase {
  readonly action: 'generate'
  readonly provider: 'vercel' | 'cloudflare-pages' | 'github-pages' | 'turbo'
  readonly path: string
  readonly mode?: string // e.g., 'reusable', 'next-on-pages'
}
```

### doctor summary

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

- Always emit exactly one final JSON object with `final: true`.
- Always use canonical provider IDs.
- Always include `hints: []` (empty array when none).
- Respect `--json` and `OPD_NDJSON=1` modes:
  - `--json`: suppress human logs, print final summary as a single JSON object.
  - `OPD_NDJSON=1`: stream NDJSON events; still end with the final summary.
- In CI contexts, prefer non-interactive behavior (`OPD_FORCE_CI=1`).

## Stability

- Field names and types above are considered stable for the MVP release.
- Additive fields may appear over time, but existing fields will not change semantics without a major version bump.

## Examples

See `packages/cli/src/commands/plan.ts`, `deploy.ts`, `generate.ts`, and `doctor.ts` for concrete emitters that follow this contract.

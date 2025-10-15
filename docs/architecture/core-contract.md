# vNext Core Contract (Draft)

Status: Phase 1 draft. These are proposed stable interfaces for providers, events, summaries, and hints. The aim is to make CLI and VSCode extension integration reliable and predictable.

## Provider interface

```ts
/** Provider implementation boundary (vNext) */
export interface Provider {
  readonly id: ProviderId
  getCapabilities(): ProviderCapabilities
  detect(cwd: string): Promise<Detected>
  build(args: BuildInputs): Promise<BuildResult>
  deploy(args: DeployInputs): Promise<DeployResult>
  generateConfig?(args: GenerateArgs): Promise<string>
}

export type ProviderId = 'github-pages' | 'vercel' | 'cloudflare-pages'

export interface ProviderCapabilities {
  readonly name: string
  readonly supportsLocalBuild: boolean
  readonly supportsRemoteBuild: boolean
  readonly supportsStaticDeploy: boolean
  readonly supportsSsr: boolean
  readonly supportsLogsFollow: boolean
}

export interface Detected {
  readonly framework?: string
  readonly publishDir?: string
}

export interface BuildInputs {
  readonly cwd: string
  readonly framework?: string
  readonly publishDirHint?: string
  readonly noBuild?: boolean
}

export interface BuildResult {
  readonly ok: boolean
  readonly artifactDir?: string
  readonly message?: string
  readonly hints?: readonly Hint[]
}

export interface DeployInputs {
  readonly cwd: string
  readonly artifactDir?: string
  readonly env?: 'production' | 'preview'
  readonly timeoutSeconds?: number
}

export interface DeployResult {
  readonly ok: boolean
  readonly url?: string
  readonly logsUrl?: string
  readonly message?: string
  readonly hints?: readonly Hint[]
}

export interface GenerateArgs {
  readonly cwd: string
  readonly overwrite?: boolean
  readonly detection: Detected
}
```

## Events and summaries

```ts
/** NDJSON event (streaming). Consumed by the extension and CI. */
export interface OpdEvent {
  readonly action: 'plan' | 'doctor' | 'deploy' | 'start' | 'up' | 'error'
  readonly provider?: ProviderId
  readonly phase?: string // e.g., 'detect', 'build', 'deploy', 'logsUrl', 'done'
  readonly ok?: boolean
  readonly message?: string
  readonly url?: string
  readonly logsUrl?: string
  readonly hint?: Hint // optional single hint per event
  readonly timestamp?: string // ISO string when --timestamps
}

/** Final JSON summary (one per command when --summary-only). */
export interface OpdSummary {
  readonly ok: boolean
  readonly action: 'plan' | 'doctor' | 'deploy' | 'start' | 'up' | 'error'
  readonly provider?: ProviderId
  readonly framework?: string
  readonly publishDir?: string
  readonly url?: string
  readonly logsUrl?: string
  readonly hints?: readonly Hint[]
  readonly final: true
}

export interface Hint {
  readonly code: string // e.g., 'next.export.missing', 'github.nojekyll.absent'
  readonly message: string
  readonly action?: string // suggested command or fix
}
```

## Contract rules

- Exactly one `OpdSummary` with `final: true` is emitted per command when `--json`.
- All NDJSON events use `phase` (not `event` or `stage`).
- `provider` uses canonical ids: `'github-pages' | 'vercel' | 'cloudflare-pages'`.
- Hints are structured with `code`, `message`, optional `action`.
- When a remote logs URL is known, `logsUrl` must be set on the final summary.

## Extension expectations

- The extension consumes NDJSON to render progress and hints; it relies only on the types above.
- It does not parse human text. All UX (toasts, hint panels) binds to `OpdEvent`/`OpdSummary`.
- The extension should never include provider logic; all decisions come from events/summaries.

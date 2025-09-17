# Provider Adapter API

This document describes the provider adapter interface used by OpenDeploy CLI and how to implement a new provider.

## Interface

File: `src/types/provider-adapter.ts`

```ts
export interface ProviderAdapter {
  readonly name: ProviderName
  validateAuth(): Promise<void>
  generateConfig(args: { readonly detection: DetectionResult; readonly overwrite: boolean }): Promise<string>
  deploy(inputs: DeployInputs): Promise<DeployResult>
  open(projectId?: string): Promise<void>
  logs(args: { readonly projectId?: string; readonly env: 'prod' | 'preview'; readonly follow?: boolean; readonly since?: string; readonly cwd?: string; readonly orgId?: string }): Promise<void>
}
```

Key types:
- `DetectionResult`: result of stack detection (rootDir, buildCommand, etc.)
- `DeployInputs`: provider, detection, env, project/org IDs, dryRun, envVars
- `DeployResult`: URL, projectId, provider, target, optional logsUrl, durationMs

## Responsibilities

- `validateAuth()`
  - Ensure the provider CLI is installed and the user is authenticated.
  - Throw with a helpful message if not authenticated.

- `generateConfig()`
  - Create a minimal provider config file when missing (idempotent).
  - For Netlify, we write a safe `netlify.toml`. For Vercel, a minimal `vercel.json`.

- `deploy()`
  - Perform the provider-specific deployment.
  - Respect `inputs.env` (`prod`|`preview`) and IDs for non-interactive linking.
  - Return a structured `DeployResult`.

- `open()`
  - Open the provider dashboard for the linked/current project.
  - Providers may optionally attempt non-interactive linking if a `projectId` is passed.

- `logs()`
  - Print or stream provider logs. The CLI handles UX/NDJSON; adapters should execute the provider CLI/API.
  - Arguments include `env`, `projectId`, `orgId`, `cwd`, `follow`, `since`.

## CLI vs Adapter Responsibilities

- CLI (`src/commands/deploy.ts`)
  - UX, flags, NDJSON/human output, spinners, summaries.
  - Monorepo cwd selection and link hints.

- Adapter (`src/providers/*/adapter.ts`)
  - Low-level provider operations (spawn provider CLI, read/write config files).
  - Keep logic small, testable, and side-effect aware.

## Minimal Adapter Skeleton

```ts
export class ExampleAdapter implements ProviderAdapter {
  public readonly name = 'example'
  async validateAuth(): Promise<void> { /* ... */ }
  async generateConfig(args: { detection: DetectionResult; overwrite: boolean }): Promise<string> { /* ... */ return '' }
  async deploy(inputs: DeployInputs): Promise<DeployResult> { /* ... */ return { url: '', projectId: '', provider: 'example', target: inputs.env, durationMs: 0 } }
  async open(projectId?: string): Promise<void> { void projectId }
  async logs(args: { projectId?: string; env: 'prod'|'preview'; follow?: boolean; since?: string; cwd?: string; orgId?: string }): Promise<void> { void args }
}
```

## Testing Adapters

- Unit test adapter methods by mocking `proc.run`/`proc.spawnStream` from `src/utils/process`.
- Add integration tests in CLI level to ensure adapters are invoked (mock the adapter class and assert calls).

## Best Practices

- Avoid parsing large provider outputs when a JSON flag exists.
- Include helpful error messages. The CLI maps errors via `src/utils/errors.ts`.
- Keep deploy logs short and rely on NDJSON/human streaming at CLI layer.

## Contributor Guide: Building an Adapter

1) Create adapter file
- Path: `src/providers/<name>/adapter.ts`
- Implement `ProviderAdapter` methods: `validateAuth`, `generateConfig`, `deploy`, `open`, `logs`.
- Keep each method short and single-purpose; prefer small helpers.

2) Use `proc.run` and `proc.spawnStream`
- Import from `src/utils/process`.
- Always return actionable errors; do not assume the provider CLI is installed or linked.

3) Configuration helpers
- Write provider files with idempotency; do not overwrite user content without `overwrite: true`.
- For monorepos, prefer linked app directory and fall back to root.

4) Testing
- Use Vitest with `vi.mock` to replace provider adapters or process helpers.
- Example pattern:
```ts
vi.mock('../../utils/process', async (orig) => {
  const real = await orig<any>()
  return { ...real, proc: { ...real.proc, run: vi.fn(async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' })) } }
})
```
- Add one or two integration tests at CLI level (`src/__tests__`) to ensure the adapter is reached.

5) Logging and output
- Human mode: short, colorful, helpful messages. Use `logger.section`, `logger.success`, `logger.warn`.
- JSON/NDJSON mode: emit machine objects and include `final: true` for summaries.

6) CI and Exit Codes
- Respect `--ci` conventions: never prompt; return consistent exit codes.
- Use `mapProviderError()` to translate raw provider errors into stable codes/messages/remedies.

7) Example Adapters
- See `src/providers/vercel/adapter.ts` and `src/providers/netlify/adapter.ts` for patterns.

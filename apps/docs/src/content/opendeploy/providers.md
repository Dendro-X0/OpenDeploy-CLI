## Provider Docs Index

- Netlify: Not supported. Please use the official Netlify CLI (https://github.com/netlify/cli).

Supported providers (canonical IDs in summaries):

- Vercel (`vercel`)
- Cloudflare Pages (`cloudflare-pages`)
- GitHub Pages (`github-pages`)

### React Router v7 (Vercel)

- Static preview/prod deploys are supported by setting `outputDirectory` to `build/client` (the provider plugin writes this in `vercel.json`).
- The CLI detects these projects and writes `vercel.json` idempotently.
- SSR requires a framework/serverless adapter and is not provided by default by OpenDeploy.

### Strict plugin version mode

- Set `OPD_STRICT_PLUGIN_VERSION=1` to fail fast when a provider or stack plugin’s major API version does not match the CLI.
- In NDJSON mode, a `plugin.version-mismatch` event is emitted before exit; otherwise, a clear error is shown.

### Config generation (idempotent)

OpenDeploy writes a minimal `vercel.json` using the detection engine:

- Keeps your existing config unless `--overwrite` is passed.
- Ensures safe defaults for Next.js and other supported frameworks.

When editing manually, see Vercel docs for advanced options (headers, redirects, images, i18n).

## Nuxt

For static Nuxt sites on Vercel/Pages, publish `.output/public` after a local build.

## Turborepo config generation

OpenDeploy can generate a minimal `turbo.json` to cache build artifacts for Next.js and libraries by default.

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    }
  }
}
```

Notes:
- Use `TURBO_TOKEN` and `TURBO_TEAM` in CI to enable remote caching.
- You can extend per-app outputs (e.g., Vite `dist/**`).

## SSR Adapters: SvelteKit and Remix

> Warning: For server-side rendering (SSR), you must install the official framework adapters. OpenDeploy does not automatically modify your framework config to enable SSR.

- SvelteKit
  - Vercel: `@sveltejs/adapter-vercel`
    - Docs: https://github.com/sveltejs/kit/blob/main/documentation/docs/25-build-and-deploy/90-adapter-vercel.md

- Remix
  - Vercel: `@remix-run/vercel`
    - Docs: https://github.com/remix-run/remix/tree/main/packages/remix-vercel

If you are deploying static-only versions, a minimal `vercel.json` is sufficient; SSR may require framework-specific adapters within your application.

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
  - For Vercel, a minimal `vercel.json`.

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

## CLI vs Provider Plugin Responsibilities

- CLI (`src/commands/deploy.ts`)
  - UX, flags, NDJSON/human output, spinners, summaries.
  - Monorepo cwd selection and link hints.

- Provider Plugin (`src/core/provider-system/providers/*`)
  - Low-level provider operations (spawn provider CLI, read/write config files).
  - Keep logic small, testable, and side-effect aware.

## Minimal Provider Plugin Skeleton

```ts
import type { Provider } from '../../src/core/provider-system/provider-interface'
export class ExampleProvider implements Provider {
  public readonly id = 'example'
  getCapabilities() { return { /* ... */ } as any }
  async detect(cwd: string) { void cwd; return {} }
  async validateAuth(cwd: string) { void cwd }
  async link(cwd: string, project: { projectId?: string; orgId?: string }) { void cwd; return project }
  async build(args: any) { void args; return { ok: true } }
  async deploy(args: any) { void args; return { ok: true, url: 'https://ex.example.com', logsUrl: undefined, durationMs: 0 } }
  async open(project: { projectId?: string; orgId?: string }) { void project }
  async envList(project: any) { void project; return {} }
  async envSet(project: any, kv: Record<string, string>) { void project; void kv }
  async logs(project: any, options?: { follow?: boolean }) { void project; void options }
  async generateConfig(args: { detection: any; cwd: string; overwrite: boolean }) { void args; return 'config-path' }
}
```

## Testing Provider Plugins

- Unit test provider plugin methods by mocking `proc.run`/`proc.spawnStream` from `src/utils/process`.
- Add integration tests at CLI level to ensure providers are invoked (mock `loadProvider()` and assert calls).

## Best Practices

- Avoid parsing large provider outputs when a JSON flag exists.
- Include helpful error messages. The CLI maps errors via `src/utils/errors.ts`.
- Keep deploy logs short and rely on NDJSON/human streaming at CLI layer.

## Wizard (start)

- Vercel: the `start` wizard performs the deploy (preview/prod) and prints `url`/`logsUrl`. When `--alias` is provided, the wizard attempts to set an alias after deploy.
See `docs/commands.md#start` for details.

## Contributor Guide: Building a Provider Plugin

1) Create provider plugin file
- Path: `src/core/provider-system/providers/<name>.ts`
- Implement `Provider` interface methods: `validateAuth`, `generateConfig`, `deploy`, `open`, `logs`.
- Keep each method short and single-purpose; prefer small helpers.

2) Use `proc.run` and `proc.spawnStream`
- Import from `src/utils/process`.
- Always return actionable errors; do not assume the provider CLI is installed or linked.

3) Configuration helpers
- Write provider files with idempotency; do not overwrite user content without `overwrite: true`.
- For monorepos, prefer linked app directory and fall back to root.

4) Testing
- Use Vitest with `vi.mock` to replace provider plugins (mock `loadProvider`) or process helpers.
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

7) Provider Plugins
- See `src/core/provider-system/providers/` for provider plugin implementations and patterns.

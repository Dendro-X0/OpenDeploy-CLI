# Migration Notes: Adapters to Provider Plugins

This document summarizes the migration from legacy provider adapters/shims to the unified provider plugin architecture.

## Why we migrated
- Simplify the codebase with a single, consistent provider interface.
- Make testing deterministic by mocking a single loader (`loadProvider`) instead of multiple adapters.
- Eliminate duplication and legacy shims; align the CLI with the final 1.0 design.

## What changed
- Removed legacy adapters and shims:
  - Deleted `src/providers/*/adapter.ts` and `src/core/provider-system/shims/*`.
  - Deleted legacy type: `src/types/provider-adapter.ts`.
- Introduced a unified Provider interface and plugins:
  - Provider interface: `src/core/provider-system/provider-interface.ts`
  - Provider plugins: `src/core/provider-system/providers/` (e.g., `vercel.ts`, `netlify.ts`, `cloudflare-pages.ts`, `github-pages.ts`)
- Auth and config generation now go through the provider plugin only.
- Logs follow uses provider CLIs directly when appropriate (e.g., `vercel logs`).

## Implementing a provider plugin
- Create a file in `src/core/provider-system/providers/<name>.ts`.
- Implement the `Provider` interface from `src/core/provider-system/provider-interface.ts`:
  - `id`, `getCapabilities()`, `detect(cwd)`, `validateAuth(cwd)`, `link(cwd, project)`, `build(args)`,
    `deploy(args)`, `open(project)`, `envList(project)`, `envSet(project, kv)`,
    `logs(project, options?)`, and `generateConfig({ detection, cwd, overwrite })`.
- Keep methods short and single-purpose. Use helpers in `src/utils/` and `src/core/detectors/`.

## Testing guidance
- Prefer mocking `loadProvider` from `src/core/provider-system/provider` in tests:
  ```ts
  vi.mock('../core/provider-system/provider', () => ({
    loadProvider: async (name: string) => ({
      id: name,
      getCapabilities: () => ({ supportsLocalBuild: true, envContexts: ['preview','production'] /* ... */ }),
      async validateAuth() {},
      async generateConfig() { return 'noop' },
      async deploy() { return { ok: true, url: 'https://example.com' } },
      async open() {},
      async logs() {},
    }),
  }))
  ```
- Avoid mocking legacy adapters/shims; they were removed.
- For process behavior, mock `src/utils/process` (`proc.run`, `proc.spawnStream`) rather than invoking real CLIs.

## CLI behavior notes
- `start` wizard uses provider plugin auth/validate and ensures minimal config files are generated idempotently.
- `generate <provider>` calls `provider.generateConfig({ detection, cwd, overwrite })`.
- `up` and `deploy` use provider plugins for deploys; Netlify `--no-build` path is supported.

## Removed artifacts
- Files removed:
  - `src/providers/vercel/adapter.ts`, `src/providers/netlify/adapter.ts`
  - `src/core/provider-system/shims/vercel-shim.ts`, `src/core/provider-system/shims/netlify-shim.ts`
  - `src/types/provider-adapter.ts`
- Docs updated to reference provider plugins instead of adapters (see `docs/providers.md`).

## Contributor checklist
- Implement new providers under `src/core/provider-system/providers/`.
- Update docs under `docs/` and add examples to `docs/recipes.md` when adding capabilities.
- Write tests that mock `loadProvider` and/or `proc.*` helpers; avoid external network calls.
- Ensure `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass locally and on CI.

## FAQ
- Framework adapters (e.g., SvelteKit adapters) are still app-level concerns. The CLI uses provider plugins; it does not modify framework adapter settings for SSR automatically.
- If a provider lacks a native logs follow API, the CLI may call the provider CLI (`vercel logs`) directly for reliability.

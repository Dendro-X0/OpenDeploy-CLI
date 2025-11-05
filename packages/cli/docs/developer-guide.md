# OpenDeploy CLI – Developer Guide

This guide helps contributors set up the repo, understand the architecture, and develop provider plugins and commands productively.

## Repository Structure

- `src/core/provider-system/`
  - `provider-interface.ts`: Provider interface implemented by each plugin.
  - `providers/`: Built-in provider plugins (`vercel.ts`, `cloudflare-pages.ts`, `github-pages.ts`).
  - `provider.ts`: `loadProvider()` and utilities.
  - `provider-capabilities.ts`, `provider-types.ts`: shared types.
- `src/commands/`: CLI commands (`start`, `generate`, `up`, `deploy`, `promote`, `rollback`, `env`, `doctor`, etc.).
- `src/utils/`: process, logger, colors, errors, helpers.
- `src/core/detectors/`: framework detection.
- `src/__tests__/`: unit/integration tests (Vitest).
- `docs/`: usage docs, developer docs, recipes.

## Local Development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

Run the CLI locally (dev):

```bash
node dist/index.js --help
```

Preferred: use the `opd` binary from Releases for day-to-day usage. The `node dist/index.js` entrypoint is for development only.

## Coding Standards

- TypeScript, strict typing; avoid `any`.
- Short, single-purpose functions; prefer early returns.
- Create composite types over excessive primitives.
- One export per file; JSDoc for public classes and methods.
- No magic numbers: define constants.

## Provider Plugins

1) Implement the `Provider` interface in `src/core/provider-system/provider-interface.ts`.
2) Add the plugin under `src/core/provider-system/providers/<name>.ts`.
3) Keep methods small; rely on `src/utils/process` (`proc.run`, `proc.spawnStream`) to interact with provider CLIs.
4) Generate minimal config via `generateConfig({ detection, cwd, overwrite })`.
5) Use `getCapabilities()` to declare feature support; CLI adapts behavior accordingly.

See `docs/migration-notes.md` for details on the move from adapters/shims to provider plugins.

## Testing

- Unit tests: mock `loadProvider()` to return a fake provider with deterministic behavior.
- Process-level behavior: mock `src/utils/process` instead of invoking real CLIs.
- Prefer NDJSON assertions for streaming flows; keep tests stable and fast.

Example mock:

```ts
vi.mock('../core/provider-system/provider', () => ({
  loadProvider: async (name: string) => ({
    id: name,
    getCapabilities: () => ({ supportsLocalBuild: true, envContexts: ['preview','production'] }),
    async validateAuth() {},
    async generateConfig() { return 'noop' },
    async deploy() { return { ok: true, url: 'https://example.com' } },
    async open() {},
    async logs() {},
  })
}))
```

## Releasing

- Tag a version (semver) and publish signed binaries via GitHub Releases.
- Prefer the short command `opd` in docs and examples.
- Keep docs in sync with CLI features; update `docs/providers.md`, `docs/commands.md`, and `docs/recipes.md` when behavior changes.

## Contributing

- Open an issue for feature proposals or provider additions.
- Follow the coding standards above; ensure `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass.
- Include tests for new provider behavior and commands.
- Update docs where applicable.

# CLI Runbook (Phase 1)

Status: research draft. This documents how the CLI builds and runs today on a clean machine (Windows-first), and highlights gaps to fix in vNext.

## Toolchain

- Node: 20.x recommended (engines: ">=18")
- pnpm: pinned in root `package.json` (e.g., `pnpm@10.16.1`)
- OS: Windows tested first; Unix/Mac later

## Build

```powershell
# From repo root
pnpm -C packages/cli install
pnpm -C packages/cli build
```

Outputs:
- `packages/cli/dist/**` (built by tsup)

## Run (local, not published)

```powershell
# From repo root
node packages/cli/dist/index.js --version
node packages/cli/dist/index.js plan --json
node packages/cli/dist/index.js doctor --json
```

Notes:
- If provider commands need external CLIs (e.g., `wrangler`, `vercel`), ensure they are on PATH.
- For logging, `--json`, `--ndjson`, `--summary-only`, and `--timestamps` are available (see `src/index.ts`).

## Binary builds (experimental)

```powershell
pnpm -C packages/cli build:bin:win
# artifacts in packages/cli/artifacts/bin
```

Known gaps:
- `pkg` + ESM/CJS issues on Windows may require shims or removal for vNext.
- Prefer Node-only for vNext MVP; re-introduce binaries later.

## Smoke test (to author in vNext)

- Minimal: run `plan` and `doctor` against a tiny static sample (e.g., `examples/static/dist`).
- Success criteria: exit code 0; final JSON summary printed; no unhandled errors.

## Release (future)

- npm publish path or GitHub Releases with prebuilt binaries (after Windows issues are resolved).
- For now, local execution via `node dist/index.js` is the primary test path.

# Monorepo Ergonomics (Phase 1)

This document captures how the current monorepo runs and where it causes friction, with vNext recommendations.

## Current setup

- Workspaces: `pnpm-workspace.yaml` → `apps/*`, `packages/*`
- Root `package.json` scripts: orchestrate CI watchers and `turbo run` groups.
- Turborepo: `turbo.json` defines `build`, `test`, `typecheck`, `lint`, `format` tasks with standard `dependsOn`.
- Extension: lives in `apps/extension/` and builds with `tsc`; packaged via a staging script to VSIX.
- CLI: lives in `packages/cli/`, built with `tsup`, optional `pkg` binary builds.

## Observed friction

- **Repo-wide scans** (vsce, git) are slow and brittle in a large workspace.
- **Name/path collisions** across `apps` and `packages` when detection logic wants a single `cwd`.
- **Windows path spaces** can break plain string shell commands.
- **Toolchain drift**: different Node/pnpm versions across machines.

## vNext guidance

- Keep `turbo.json` minimal until v1.0 (build, typecheck, lint, test only).
- Use **staging/packing** patterns to isolate packaging (extension VSIX, CLI npm/binaries) from monorepo root.
- Centralize child-process execution in a `ProcessRunner` util handling Windows `.cmd` shims, quoting, and timeouts.
- Add a top-level Tools Check script to hard-fail on version drift before builds.
- For provider detection in monorepos, always accept an explicit `--path` and fall back to a deterministic selection policy.

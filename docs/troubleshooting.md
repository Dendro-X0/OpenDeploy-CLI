# Troubleshooting

This page lists common issues and how to fix them.

## CI shows pnpm not found
- Cause: pnpm not on PATH on GitHub runners.
- Fix: Ensure workflows use `pnpm/action-setup@v4` and avoid pinning a conflicting version with `packageManager`.

## Version mismatch: ERR_PNPM_BAD_PM_VERSION
- Cause: Different pnpm version in workflow vs. `package.json#packageManager`.
- Fix: Remove version pin from the action and do not run `corepack prepare pnpm@...` in workflows.

## Providers fail during synth/generate
- Cause: Workspace dependencies not built, missing `dist/` files.
- Fix: Build the workspace before the CLI in CI: `pnpm -r --workspace-concurrency=1 build`.

## Windows file locks
- Symptom: Cannot delete `.next/`, `.turbo/`, or build outputs.
- Fix: Close file holders (browser/dev server). Plan: provide `opd locks` helper.

## Secrets in output
- Fix: Use `--json`/NDJSON in CI. Redaction is enabled by default. Use `scan --strict` locally before pushing.

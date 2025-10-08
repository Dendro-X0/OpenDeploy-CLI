# CI Guide

This repo enables strict JSON schema validation and runs a multi-platform matrix on PRs and manual dispatch.

## Schema Guardrail

All commands print a final JSON summary which is validated at runtime and annotated with `schemaOk` and `schemaErrors`.

- In CI, `OPD_SCHEMA_STRICT=1` is set to ensure drift is caught early.
- When violations occur, the command sets a non-zero exit code while still printing the final JSON, so logs and payloads are preserved.
- Local reproduction:
  ```bash
  OPD_SCHEMA_STRICT=1 pnpm test -- --reporter=dot
  ```

## CI Workflows

- `.github/workflows/ci.yml`
  - Single Ubuntu job for typecheck, build, and tests.
  - Environment:
    - `CI=1`, `FORCE_COLOR=0`, `OPD_TEST_NO_SPAWN=1`, `OPD_SCHEMA_STRICT=1`.

- `.github/workflows/ci-matrix.yml`
  - Matrix across OS and runtime:
    - OS: `ubuntu-latest`, `windows-2022`
    - Node: `18.x`, `20.x`, `22.x`
  - Steps: checkout, setup-node, corepack+pnpm, install, build, tests.
  - Uploads artifacts in `.artifacts/` if present.

## Tips

- Prefer `--json --summary-only` in automation, or `--ndjson` for streaming.
- Use `OPD_PROVIDER_MODE=virtual` in local/CI tests to avoid CLI/network variability.
- Capture outputs into `.artifacts/` for reproducible and comparable runs.

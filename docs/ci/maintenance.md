# CI Maintenance Guide

This guide shows how to keep CI stable and predictable using the OpenDeploy CLI.

## Daily workflow (before pushing)

- __Run the one‑shot simulator__
  - `node packages/cli/dist/index.js ci-run pr --json`
  - Opens `./.artifacts/` and writes `ci-run.last.json`.

- __Check workflow drift__
  - `node packages/cli/dist/index.js ci-generate --profile pr --out ./.artifacts/ci-pr.generated.yml`
  - `node packages/cli/dist/index.js ci-diff --profile pr --json --open-artifacts`
  - Fix `.github/workflows/*.yml` if drift is reported.

- __Capture logs without pipes (Windows-friendly)__
  - `node packages/cli/dist/index.js start --ndjson-out ./.artifacts/start.ndjson --json --summary-only --dry-run`
  - Validate: `node packages/cli/dist/index.js ndjson-validate --file ./.artifacts/start.ndjson --json`

## CI environment flags

- __Required__
  - `OPD_FORCE_CI=1`
  - `CI=1`, `FORCE_COLOR=0`, `TERM=dumb`
- __PR (virtual providers)__
  - `OPD_PROVIDER_MODE=virtual`
  - `OPD_TEST_NO_SPAWN=1`
- __Nightly/Tag (real providers)__
  - Provider CLIs available (`vercel`, `wrangler`, `gh`)
  - `VERCEL_TOKEN`, `CLOUDFLARE_API_TOKEN`, `GITHUB_TOKEN` set

## Artifacts to expect

- `./.artifacts/ci-run.last.json`
- `./.artifacts/vitest.json`
- `./.artifacts/doctor.strict.json`, `./.artifacts/scan.strict.json`
- `./.artifacts/detect-*.json`, `./.artifacts/doctor-*.json`
- Optional: `./.artifacts/start.ndjson`

## When something fails

- __Open artifacts__ first; compare local vs CI artifacts.
- __If workflows differ__, run `ci-diff` and update YAML.
- __If doctor strict fails in app repos__, follow doctor hints; for the CLI repo itself, strict checks may not apply.
- __Avoid pipes on Windows__; use `--ndjson-out`.

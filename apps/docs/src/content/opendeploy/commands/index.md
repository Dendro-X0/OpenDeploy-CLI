# Commands

Use these flags with any command to tailor output for CI or local use:

## Global Output Flags

- `--quiet` — error-only output (suppresses info/warn/success).
- `--no-emoji` — replace emoji prefixes with ASCII (e.g. `[info]`).
- `--json` — JSON-only output (suppresses non-JSON logs).
- `--compact-json` — one-line JSON (good for log pipelines).
- `--ndjson` — newline-delimited JSON streaming (implies `--json`).
- `--timestamps` — add ISO timestamps to human logs and JSON objects.
- `--summary-only` — suppress intermediate JSON and print only final summary objects (`{ final: true }`).

For CI consumers, see also: [Response Shapes (CI)](../response-shapes.md)

## Result Codes & CI behavior

- Detect
  - Exit 0 on success; non‑zero on detection errors.
- Doctor
  - In `--ci`, exits non‑zero if any check fails (auth, CLIs, versions, monorepo sanity).
- Env Diff / Sync
  - In `--ci`, env diff exits non‑zero when differences exist. Strict flags `--fail-on-add` / `--fail-on-remove` cause non‑zero when those conditions occur. Env sync exits non‑zero on provider errors.
- Deploy / Up
  - Exit 0 on successful deploy; non‑zero on provider errors. In `--dry-run`, exit 0.
- Promote / Rollback
  - Exit 0 on success; non‑zero on provider errors. In `--dry-run`, exit 0.

## Categories

- Environment
  - [env sync, env pull, env diff, env validate](./environment.md)
- Deploy
  - [deploy, up, logs/inspect, promote, rollback](./deploy.md)
- System
  - [start, detect, doctor, completion](./system.md)

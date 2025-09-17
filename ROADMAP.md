# OpenDeploy CLI Roadmap

This roadmap outlines the planned scope for 1.0.0 Alpha and 1.0.0 Beta, followed by a post‑1.0 direction. Items reflect current implementation status and upcoming priorities.

## 1.0.0 Alpha

Focus: stable core, CI‑safe behavior, documented JSON outputs.

Status: Completed

- Core UX and Output
  - Consistent exit codes in `--ci` mode across commands.
  - Global `--json` with stable, documented response shapes.
  - Secret redaction in non‑JSON logs.
- Environment Management (Vercel)
  - env pull/sync/diff with `--ignore/--only` and strict `--fail-on-add/--fail-on-remove`.
  - CI‑friendly linking: `--project-id` and `--org-id` via `providers/vercel/link.ts`.
  - env validate: required keys schema and validation report. [Done]
- Deploy (Vercel)
  - Deploy with `--project`/`--org`, `--dry-run`.
  - Structured JSON output: `url`, `projectId`, `logsUrl?`, `target` (doc + stability).
- Run Orchestration
  - `--sync-env` and `--diff-env` integration.
  - Per‑project defaults: `envOnly`, `envIgnore`, `failOnAdd`, `failOnRemove`.
- Doctor
  - Node, pnpm, bun, vercel, netlify CLI detection and auth checks.
  - Monorepo sanity checks (`.vercel/project.json`, root `vercel.json` optional).
- Config and Detection
  - `opendeploy.config.json` with schema and validation.
- Docs & DX
  - Commands reference, recipes (CI diff, sync‑then‑seed, monorepo strategy).
- Testing & CI
  - Unit tests for env diff, ensureLinked, patterns.
  - Basic integration tests (stubbed provider CLI) and Windows/Linux matrix.

Alpha Acceptance Criteria
- Stable JSON outputs for core commands documented in `docs/`.
- CI builds pass (Windows/Linux), consistent exit codes in `--ci`.
- No plaintext secret leakage in non‑JSON logs.

## 1.0.0 Beta

Focus: provider parity, CI ergonomics, extensibility.

- Status (current)
  - Netlify env and deploy parity (JSON/NDJSON, exit codes) — Done
  - CI templates and docs (recipes, sinks, annotations) — Done
  - Provider adapter API documented (docs/providers.md) — Done
  - Logs/open routed through provider adapters — Done
  - Env validate: rules schema (regex/allowed/oneOf/requireIf) and profile builtins (blogkit, ecommercekit) — Done
  - Interactive config init and richer TTY output — Done
  - Shell completions command — Done
  - Pending: promote/rollback surfaces; backoff/rate‑limit strategies; opt‑in telemetry/allowlist

- Additional Providers
  - Netlify parity for env pull/diff/sync and deploy, with JSON outputs. [Done]
- Advanced Env
  - Partial sync of changed keys only (optimized writes). [Done]
  - Optional key mapping / value transforms (opt‑in). [Done]
  - Validation rules schema and profile builtins (blogkit, ecommercekit). [Done]
- Deploy Enhancements
  - Alias and `logs` command. [Done]
  - Promote/Rollback surfaces (where supported). [Pending]
- Run Enhancements
  - Project graph with `dependsOn`, concurrency control (`--concurrency`). [Done]
  - Tag‑based selection (`--tags`). [Done]
- CI/Automation
  - First‑class GitHub Actions templates (diff‑only, sync‑and‑deploy, promote). [Done]
  - Command summaries and annotations. [Done]
- Plugins/Extensibility
  - Provider adapter API documented; experimental external providers. [API documented; adapters used for logs/open — Done]
- Performance & Caching
  - Cache remote env snapshots. [Done]
  - Backoff/rate‑limit strategies. [Pending]
- Security & Telemetry
  - Opt‑in minimal telemetry with anonymized error codes; environment variable allowlist.
- DX polish
  - Interactive config init; shell completions; richer TTY output when not in `--json`. [Done]

Beta Acceptance Criteria
 - Netlify env and deploy parity with consistent JSON & exit codes. [Achieved]
 - CI templates published and referenced in docs. [Achieved]
 - Provider adapter API documented. [Achieved]

## Post‑1.0 Direction

- Additional providers: Cloudflare Pages, Fly.io, Render, etc.
- Secret manager integrations: GitHub Environments, 1Password Connect, AWS SSM.
- Encrypted env at rest (e.g., SOPS/age) support for `.env.*`.
- Deeper framework detection (Astro, Remix, SvelteKit) and multi‑app monorepos.
- Rich audit logs; SARIF or similar reports.

---

This roadmap will be reflected in the docs site and kept in sync with releases. Contributions and feedback are welcome via issues and discussions.

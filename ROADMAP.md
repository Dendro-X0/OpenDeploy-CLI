# OpenDeploy CLI Roadmap

This roadmap outlines the planned scope for 1.0.0 Alpha and 1.0.0 Beta, followed by a post‑1.0 direction. Items reflect current implementation status and upcoming priorities.

## 1.0.0 Alpha (Completed)

Focus: stable core, CI‑safe behavior, documented JSON outputs.

Status: Completed

- Core UX and Output
  - Consistent exit codes in `--ci` mode across commands.
  - Global `--json` with stable, documented response shapes.
  - Secret redaction in non‑JSON logs.
- Environment Management (Vercel)
  - env pull/sync/diff with `--ignore/--only` and strict `--fail-on-add/--fail-on-remove`.
  - CI‑friendly linking: `--project-id` and `--org-id` via `providers/vercel/link.ts`.
  - env validate: required keys schema and validation report.
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

- Status: Completed
  
- Achievements
  - Netlify env and deploy parity (JSON/NDJSON, exit codes) — [Done]
  - CI templates and docs (recipes, sinks, annotations) — [Done]
  - Provider adapter API documented (docs/providers.md) — [Done]
  - Logs/open routed through provider adapters — Done
  - Env validate: rules schema (regex/allowed/oneOf/requireIf) and profile builtins (blogkit, ecommercekit) — [Done]
  - Interactive config init and richer TTY output — [Done]
  - Shell completions command — [Done]
  - Done: promote/rollback surfaces; CI ergonomics (--gha flag, sinks, annotations); NDJSON streaming for up; retries/timeouts knobs
 - Moved post‑Beta: backoff/rate‑limit strategies beyond basic retries + timeout + jitter
 - Moved post‑Beta: opt‑in telemetry/allowlist

- Additional Providers
  - Netlify parity for env pull/diff/sync and deploy, with JSON outputs. [Done]
- Advanced Env
  - Partial sync of changed keys only (optimized writes). [Done]
  - Optional key mapping / value transforms (opt‑in). [Done]
  - Validation rules schema and profile builtins (blogkit, ecommercekit). [Done]
- Deploy Enhancements
  - Alias and `logs` command. [Done]
  - Promote/Rollback surfaces (where supported). [Done]
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
  - Backoff/rate‑limit strategies. [Partial]
- Security & Telemetry
  - Opt‑in minimal telemetry with anonymized error codes; environment variable allowlist.
- DX polish
  - Interactive config init; shell completions; richer TTY output when not in `--json`. [Done]

Beta Acceptance Criteria
  - Netlify env and deploy parity with consistent JSON & exit codes. [Achieved]
  - CI templates published and referenced in docs. [Achieved]
  - Provider adapter API documented. [Achieved]

## 1.0.0 GA (Release)

Status: Ready

What’s done (highlights)

- Wizard: Vercel deploy end‑to‑end; Netlify prepare‑only by default with optional `--deploy` and `--no-build`; both emit `ciChecklist` and stable summaries.
- Logs: NDJSON progress with cross‑provider `event:"logs"` and provider‑specific `logsUrl`.
- Config generation: idempotent `vercel.json` / `netlify.toml` based on detection.
- Env: pull/diff/sync/validate with strict flags and profile builtins.
- CI ergonomics: `--gha`, sinks, timestamps, annotations, and deterministic `{ final: true }` summaries.
- Docs: repo docs updated; Docs Site content aligned (Overview, Commands → start, Recipes → Wizard Quick Examples, Response Shapes → start).
- Tests: unit + integration coverage for wizard outputs and NDJSON; Windows/Linux matrix.

Release checklist

1) Schemas: add optional wizard fields (`logsUrl`, `cwd`, `alias`, `siteId`, `siteName`) to `schemas/start.schema.json`.
2) Docs Site: deploy to GitHub Pages (or Vercel) and link from README.
3) Version: bump to `1.0.0` and tag release with concise notes (features, known limits, next plan).
4) Changelog: include NDJSON parity, start flags (`--deploy`, `--no-build`, `--alias`).
5) Smoke pass on real projects (Next, one Remix static, one Nuxt static) using `start` and `up`.

Known limitations (kept short in release notes)

- Remix/React Router v7 SSR requires adapters; static deploys are first‑class.
- Expo deploys are out‑of‑scope for 1.0; env workflows are supported.

## 1.1.0 Plan (Next)

Scope: 2–3 week cycle, small and focused.

- Detection & UX
  - React Router v7 detector + static fallback heuristics; clarify SPA redirects.
  - Monorepo chosen‑cwd advisories (doctor + wizard hints).
- Schemas & CI
  - Publish `start.schema.json` with the optional fields above; add schema validation test.
  - Minimal matrix smoke workflow (`up --dry-run --json`) on templates.
- Docs & DX
  - “When to use start vs up” callouts; more compact Quick Start on the site.
  - One short video tutorial (2–3 min) showcasing wizard + up.

## Backlog (Not committed to a release)

- Recipes scaffolding (`opendeploy recipe apply ...`) for Astro/SvelteKit/Remix/Expo.
- Additional providers (Cloudflare Pages, Render, Fly.io) behind feature flags.
- Secret manager integrations (GitHub Environments, 1Password Connect, AWS SSM).
- Opt‑in telemetry/allowlist and richer audit logs.

### Next.js Deployment Experience (Foundation)

Focus: make Next.js the simplest “plug-and-play” experience and reuse these patterns across other frameworks.

- Short-path commands
  - [ ] `opendeploy up vercel --env preview` — safe defaults: detect/link, env sync (optimized writes), deploy, logs, open URL
  - [ ] `opendeploy promote vercel` — promote latest preview to production with env guard + confirm
  - [ ] `opendeploy rollback vercel` — revert to last successful production build (where supported)
- Safety & clarity
  - [ ] `opendeploy explain <cmd>` — show what will happen and why it’s safe (diff of env, deploy target, plan summary)
  - [ ] `opendeploy doctor --fix` — auto-fix linking, auth, missing envs, and workspace sanity when possible
  - [ ] GitHub summary output for `up/promote/rollback` (status, URL, time, env deltas)
- Provider parity polish
  - [ ] Backoff/jitter and polling strategies for Netlify deploy/status APIs
  - [ ] Improved detection and hints for Next.js app dir vs pages dir, edge/runtime, and monorepo chosen deploy cwd
  - [ ] Better `vercel link`/`netlify link` ergonomics; auto-suggest project/org
- Monorepo ergonomics
  - [ ] Workspace-aware `doctor` advisories and `--path` hints
  - [ ] Per-project defaults respected across `run` orchestration

Deliverables: UX spec for `explain`, `promote`, `rollback`, `doctor --fix` coverage; Netlify backoff; enhanced Next.js detector.

### Framework Templates (Astro, SvelteKit, Remix Monorepo, Expo)

Goal: reuse the Next.js experience across frameworks via detection + recipe scaffolding.

- Detection & metadata
  - [ ] `framework detect` with confidence and required features (SSR/SSG, adapter)
  - [ ] Profile env keys (common .env keys per template)
- Recipes (scaffolding)
  - [ ] `opendeploy recipe apply astro-basic`
  - [ ] `opendeploy recipe apply sveltekit-vercel|netlify`
  - [ ] `opendeploy recipe apply remix-monorepo`
  - [ ] `opendeploy recipe apply expo-env-only` (focus on env management; deploy may be out-of-scope)
- What a recipe generates
  - Provider config (e.g., `vercel.json`, `netlify.toml`), minimal and opinionated
  - GitHub Action for preview/prod with `up`/`promote`
  - `opendeploy.config.json` with defaults (envIgnore/Only, strict flags)
  - `docs` snippet for README Quick Start (2 commands)

Template spec (draft)

```json
{
  "id": "sveltekit-vercel",
  "framework": "sveltekit",
  "build": {
    "command": "pnpm build",
    "outDir": ".vercel/output",
    "adapter": "@sveltejs/adapter-vercel"
  },
  "env": {
    "required": ["PUBLIC_*", "DATABASE_URL"],
    "suggested": ["SENTRY_DSN"]
  },
  "providers": {
    "vercel": { "link": true, "projectHints": ["apps/web", "."] }
  },
  "ci": { "template": "preview-and-promote" }
}
```

Initial targets

- Astro
  - Vercel + Netlify adapters; `dist/` output; SSR/SSG flags
- SvelteKit
  - Adapters (Vercel, Netlify); `adapter-*` dependency checks
- Remix (Monorepo)
  - Workspace-aware path selection; Verce/Netlify functions dir hints; Vite/Remix build commands
- Expo (Env Management first)
  - Managed envs across CI and EAS; deployment integration later (out-of-scope for 1.0)

## Post‑1.0 Direction

- Additional providers: Cloudflare Pages, Fly.io, Render, etc.
- Secret manager integrations: GitHub Environments, 1Password Connect, AWS SSM.
- Encrypted env at rest (e.g., SOPS/age) support for `.env.*`.
- Deeper framework detection (Astro, Remix, SvelteKit) and multi‑app monorepos.
- Rich audit logs; SARIF or similar reports.

---

This roadmap will be reflected in the docs site and kept in sync with releases. Contributions and feedback are welcome via issues and discussions.

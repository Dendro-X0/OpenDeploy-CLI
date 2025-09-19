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

### Post‑Beta 1.0.x Plan (Execution)

Goals: validate real‑world flows on Remix, Expo, and Nuxt; polish wizard and docs based on findings; ensure stable JSON outputs and CI ergonomics.

1) Test Matrix (Real Projects)

- [ ] Remix on Vercel
  - Sample: create with `npx create-remix@latest` (Vite), or use `remix-run/remix` templates.
  - Validate: `detect`, `start`, `up --dry-run/--json`, `up --env preview`, `up --env prod`.
  - Ensure: logsUrl emits; inline `vercel link` works with `--project/--org`; env sync keys trimmed; final JSON has `final: true`.
- [ ] Remix on Netlify
  - Validate same as above; ensure dashboard logsUrl; check Netlify build output config.
- [ ] Expo (Env management focus)
  - Sample: `npx create-expo-app`.
  - Validate: `detect` → `expo`; `start` env plan preview; `env sync netlify|vercel` for preview/prod; document deploy limitations/out of scope for 1.0.
- [ ] Nuxt on Vercel
  - Sample: `npx nuxi init nuxt-app`.
  - Validate: detection (nuxt) — add detector if needed; generate minimal `vercel.json`; `up --dry-run` and preview deploy.
- [ ] Nuxt on Netlify
  - Validate: generate minimal `netlify.toml`; confirm logsUrl; env sync path.

Artifacts to capture per project:

- [ ] Human logs (redacted)
- [ ] NDJSON logs (with timestamps)
- [ ] Final JSON summaries (up/deploy)
- [ ] Any provider dashboard links and production URLs
- [ ] Notes on required config files (vercel.json/netlify.toml) and linking steps

2) Wizard & UX Polish

- [ ] Defaults loaded banner (done) — confirm copy and frequency
- [ ] Copy logs URL prompt (done) — confirm in both providers
- [ ] Copy command prompt (done)
- [ ] Inline `vercel link` / `netlify link` with stderr/stdout surfaced (done)
- [ ] Env plan preview (keys only) before sync (done)
- [ ] `--no-save-defaults` flag (done) — ensure docs show usage

3) Detection & Config

- [ ] Add Nuxt detector and wire into wizard, docs
- [ ] Remix: confirm build/outputDir heuristics; ensure adapter config minimalism
- [ ] Netlify Remix: confirm plugin/runtime expectations and document

4) CI & Automation

- [ ] Add sample GitHub Actions for Remix/Nuxt (preview + promote or deploy)
- [ ] Add a matrix smoke test workflow running `up --dry-run --json` against template repos
- [ ] Validate JSON schemas against captured outputs (CI step)

5) Docs

- [ ] Framework notes pages (Remix, Expo beta, Nuxt) under docs with quick start snippets
- [ ] Update overview with support grid and beta labels
- [ ] Add troubleshooting entries for common Remix/Nuxt pitfalls

6) Acceptance Criteria for Beta 1.0.0

- [ ] All test matrix items complete with captured artifacts
- [ ] No P0/critical issues for `start`, `up`, `deploy`, and `env` flows
- [ ] Deterministic JSON outputs validated by schemas (CI)
- [ ] Docs updated (commands, overview, recipes, troubleshooting)
- [ ] Release notes drafted (features, known limitations, next steps)

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

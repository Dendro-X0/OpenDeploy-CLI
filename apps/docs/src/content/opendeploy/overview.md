# Overview

OpenDeploy CLI is a Next.js‑first, cross‑provider deployment assistant for Vercel and Netlify. It focuses on reliable, repeatable workflows with great local/CI ergonomics. In addition to Next.js, the CLI supports Astro and SvelteKit, with early (beta) support for Remix and Expo.

## Status

The 1.0.0 Beta milestone is complete (provider parity, CI ergonomics, extensibility). For post‑Beta 1.0.x plans (advanced backoff strategies, opt‑in telemetry/allowlist), see the project roadmap at `../ROADMAP.md`.

## Release Notes (1.0.0‑beta)

- Provider parity for Netlify and Vercel (env pull/diff/sync, deploy) with consistent JSON/NDJSON outputs and exit codes
- Upgrades for CI ergonomics: `--gha` preset, default JSON/NDJSON sinks, GitHub annotations, deterministic final summaries (`final: true`)
- `up` command with NDJSON progress streaming and retries/timeouts knobs
- Env validation with rules schema (regex/allowed/oneOf/requireIf) and profile builtins (blogkit, ecommercekit)
- Promote and rollback commands; logs/open routed through provider plugins
- Secure redaction across human logs, JSON/NDJSON, and file sinks

## Key Features

- Stack detection (framework, router, package manager, monorepo)
- Environment management: `env sync`, `env pull`, `env diff`, `env validate`
- Database seeding: SQL, Prisma, Script
- Deploy streaming and logs (Vercel, Netlify) with readable summaries
- Single‑command deploy: `opd up <provider>` (auto env sync + deploy)
- Colorful human output + NDJSON/JSON for CI and log pipelines
- Guided setup: `opd init` (generate configs, set env policy)
- Monorepo support (workspace‑aware flows, chosen deploy cwd advisories)

## Config Generation (Quick Table)

| Command                              | Writes         | Summary |
|--------------------------------------|----------------|---------|
| `opd generate vercel`         | `vercel.json`  | Minimal config with `version`, optional `buildCommand`, and `outputDirectory` when a `publishDir` is detected. |
| `opd generate netlify`        | `netlify.toml` | Next.js: uses Netlify Next Runtime if present, else falls back to `@netlify/plugin-nextjs` and `publish = ".next"`. Nuxt: `command = "npx nuxi build"`, `publish = ".output/public"`. Others (Astro, SvelteKit static, Remix static): detection-driven `buildCommand` + `publishDir`. |
| `opd generate turbo`          | `turbo.json`   | Minimal cache config: `tasks.build.dependsOn = ['^build']`, `outputs = ['.next/**', '!.next/cache/**', 'dist/**']`. |

## Quick Start

```bash
# 1) Guided start (detect framework/provider, optional env sync)
# Note: start deploys on Vercel. Netlify is prepare-only (wizard prints recommended commands).
opd start

# (Alternative) Initialize in your repo
opd init

# 2) Preview: one‑command deploy (sync env then deploy)
# Tip: running `opd up` without a provider opens the wizard.
opd up vercel --env preview
# or (Netlify)
# For Netlify, use `up` or run the recommended commands printed by `start`.
opd up netlify --env preview --project <SITE_ID>

# 3) Promote to production
# Vercel: point your prod domain to the preview
opd promote vercel --alias your-domain.com
# Netlify: best‑effort promote by deploying to prod
opd promote netlify --project <SITE_ID>

# (Optional) Explain plan before executing
opd explain vercel --env preview --json
# (Optional) Auto‑fix common linking issues
opd doctor --fix --project <VERCEL_PROJECT_ID> --org <ORG_ID>
```

See `docs/commands.md` for all flags and examples.

## Common Tasks

```bash
# Sync env to Vercel preview (public + DB only)
opd env sync vercel --file .env.local --env preview \
  --only NEXT_PUBLIC_*,DATABASE_URL --yes

# Diff prod env (CI guard on add/remove)
opd env diff vercel --file .env.production.local --env prod \
  --ignore NEXT_PUBLIC_* --fail-on-add --fail-on-remove --json --ci

# Validate with rules (regex/allowed/oneOf/requireIf)
opd env validate --file .env \
  --schema ./schemas/production.rules.json --schema-type rules --json --ci
```

## Monorepo Tips

- Use `--path apps/web` for app‑dir commands.
- `doctor` prints which cwd will be used for deploy/logs and suggests exact commands.
- `run` orchestrates env + seed across multiple projects with `--concurrency`.

```bash
opd run --all --env preview --sync-env --concurrency 3 --json
```

## CI at a Glance

- Use `--gha` for GitHub Actions‑friendly defaults (implies `--json --summary-only --timestamps`, sets artifact sinks and annotation defaults).
- `--json-file`/`--ndjson-file` persist outputs for artifacts.
- GitHub annotations: doctor and env diff emit `::warning`/`::error` appropriately in CI.
- Recipes: see `docs/recipes.md` for Up (Netlify), Env Diff, Matrix CI, and more.

## Output Modes

- `--quiet`, `--no-emoji`, `--compact-json`
- `--json`, `--ndjson`, `--timestamps`, `--summary-only`
 - CI sink flags: `--json-file`, `--ndjson-file`; CI preset: `--gha`

## Promote & Rollback

- Vercel promote: `opd promote vercel --alias <prod-domain> [--from <preview-url-or-sha>]`
- Netlify promote: `opd promote netlify --project <SITE_ID> [--from <deployId>]`
- Vercel rollback: `opd rollback vercel --alias <prod-domain> [--to <url|sha>]`
- Netlify rollback: `opd rollback netlify --project <SITE_ID>`

Notes:

- With `--from`, Vercel promotion targets a specific preview (URL/SHA). On Netlify, `--from` requests a direct `restoreDeploy` (no rebuild).
- Outputs are standardized JSON with `final: true`; `up` emits NDJSON progress events when `--ndjson` is used.

## Reliability Knobs

Fine‑tune provider subprocess calls:

- `--retries <n>` (env: `OPD_RETRIES`, default 2)
- `--timeout-ms <ms>` (env: `OPD_TIMEOUT_MS`, default 120000)
- `--base-delay-ms <ms>` (env: `OPD_BASE_DELAY_MS`, default 300)

## Where to Next

- Commands reference: `docs/commands.md`
- Troubleshooting (error codes and remedies): `docs/troubleshooting.md`
- CI and usage recipes: `docs/recipes.md`
 - Schemas & Validation: `docs/schemas.md`
 - CI Guide (strict schema + matrix): `docs/ci.md`
 - Local Test Matrix: `docs/test-matrix.md`

## For Contributors

- Migration from adapters/shims to provider plugins: `docs/migration-notes.md`

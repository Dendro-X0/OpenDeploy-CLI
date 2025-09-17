# Overview

OpenDeploy CLI is a Next.js‑first, cross‑provider deployment assistant for Vercel and Netlify. It focuses on reliable, repeatable workflows with great local/CI ergonomics.

## Key Features

- Stack detection (framework, router, package manager, monorepo)
- Environment management: `env sync`, `env pull`, `env diff`, `env validate`
- Database seeding: SQL, Prisma, Script
- Deploy streaming and logs (Vercel, Netlify) with readable summaries
- Single‑command deploy: `opendeploy up <provider>` (auto env sync + deploy)
- Colorful human output + NDJSON/JSON for CI and log pipelines
- Guided setup: `opendeploy init` (generate configs, set env policy)
- Monorepo support (workspace‑aware flows, chosen deploy cwd advisories)

## Quick Start

```bash
# 1) Initialize in your repo
opendeploy init

# 2) One‑command deploy (sync env then deploy)
opendeploy up vercel --env preview
# or
opendeploy up netlify --env prod --project <SITE_ID>
```

See `docs/commands.md` for all flags and examples.

## Common Tasks

```bash
# Sync env to Vercel preview (public + DB only)
opendeploy env sync vercel --file .env.local --env preview \
  --only NEXT_PUBLIC_*,DATABASE_URL --yes

# Diff prod env (CI guard on add/remove)
opendeploy env diff vercel --file .env.production.local --env prod \
  --ignore NEXT_PUBLIC_* --fail-on-add --fail-on-remove --json --ci

# Validate with rules (regex/allowed/oneOf/requireIf)
opendeploy env validate --file .env \
  --schema ./schemas/production.rules.json --schema-type rules --json --ci
```

## Monorepo Tips

- Use `--path apps/web` for app‑dir commands.
- `doctor` prints which cwd will be used for deploy/logs and suggests exact commands.
- `run` orchestrates env + seed across multiple projects with `--concurrency`.

```bash
opendeploy run --all --env preview --sync-env --concurrency 3 --json
```

## CI at a Glance

- `--json-file`/`--ndjson-file` persist outputs for artifacts.
- GitHub annotations: doctor and env diff emit `::warning`/`::error` appropriately in CI.
- Recipes: see `docs/recipes.md` for Up (Netlify), Env Diff, Matrix CI, and more.

## Output Modes

- `--quiet`, `--no-emoji`, `--compact-json`
- `--json`, `--ndjson`, `--timestamps`, `--summary-only`

## Where to Next

- Commands reference: `docs/commands.md`
- Troubleshooting (error codes and remedies): `docs/troubleshooting.md`
- CI and usage recipes: `docs/recipes.md`

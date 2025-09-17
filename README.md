# OpenDeploy CLI

OpenDeploy CLI is a Next.js‑first, cross‑provider deployment assistant. It detects your stack, validates your environment, manages secrets, seeds databases, and deploys to Vercel and Netlify with live logs and CI‑friendly output.

## Features

- Stack detection (Next.js, router, package manager, monorepo)
- Environment management: sync, pull, diff, validate (`--dry-run`, `--json`, `--ci`)
- Database seeding: SQL, Prisma, Script (Windows‑friendly; no Bash required)
- Providers: Vercel and Netlify (deploy streaming, logs, summaries)
- Single‑command deploy: `opendeploy up <provider>` (auto env sync + deploy)
- Colorful, iconized CLI output with sections; NDJSON/file sinks for CI
- Guided setup: `opendeploy init` (choose providers, generate configs, set env policy)

## Quick Start

```bash
# Install dependencies
pnpm install

# Build the CLI
pnpm build

# Guided setup (choose provider(s), generate config, set env policy)
node dist/index.js init

# Single‑command deploy (env sync + deploy)
node dist/index.js up vercel --env preview
node dist/index.js up netlify --env prod --project <SITE_ID>
```

Alpha docs (recommended next reads):

- Init: see `docs/commands.md#init`
- Env sync: see `docs/commands.md#env-sync`
- Deploy: see `docs/commands.md#deploy`
- Completion: see `docs/commands.md#completion`
- CI env diff guard: see `docs/recipes.md#ci-environment-diff-guard`

## Documentation

- Overview: `docs/overview.md`
- Commands: `docs/commands.md`
- Recipes (CI, single‑command deploy, annotations, monorepo): `docs/recipes.md`
 - Troubleshooting: `docs/troubleshooting.md`

## License

MIT © OpenDeploy Contributors

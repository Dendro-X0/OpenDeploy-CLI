# Getting Started

OpenDeploy CLI helps you detect your stack, manage environment variables, and deploy to Vercel and Netlify with CI-friendly output. The CLI uses provider plugins (Vercel, Netlify, Cloudflare Pages, GitHub Pages) for provider-specific behavior.

## Prerequisites

- Node 18+ (20 recommended)
- pnpm (recommended) or npm/yarn
- Provider CLIs when needed:
  - Vercel: `vercel` (login once with `vercel login` or use `VERCEL_TOKEN` in CI)
  - Netlify: `netlify-cli` (`netlify`), plus `NETLIFY_AUTH_TOKEN` in CI

## Install and Build

```bash
pnpm install
pnpm build
```

Prefer the `opd` command when available (installed from Releases). For local development, the CLI entrypoint is `dist/index.js`.

## First Run

```bash
# Guided setup: choose provider(s), generate minimal configs, and set env policy
opd init

# Or jump straight into the wizard
opd start
```

Notes:

- The wizard deploys on Vercel; for Netlify it prepares config and prints recommended `netlify deploy` commands.
- Minimal config files are generated idempotently (`vercel.json`, `netlify.toml`).

## Single-command Deploy (Up)

Preview deploy with environment sync and structured output:

```bash
# Vercel preview
opd up vercel --env preview

# Netlify production (requires linked site or --project <SITE_ID>)
opd up netlify --env prod --project <SITE_ID>
```

Stream progress as NDJSON (great for CI/log pipelines):

```bash
opd up vercel --env preview --ndjson --timestamps \
  --ndjson-file ./.artifacts/up.ndjson
```

## Promote and Rollback

```bash
# Vercel: promote a specific preview to your production alias
opd promote vercel --alias your-domain.com \
  --from https://your-preview.vercel.app

# Netlify: restore a specific production deploy (skips rebuild)
opd promote netlify --project <SITE_ID> --from <DEPLOY_ID>

# Vercel: rollback production alias to a previous successful prod URL (or SHA)
opd rollback vercel --alias your-domain.com --to <url|sha>

# Netlify: suggest or request a restore to a previous prod deploy
opd rollback netlify --project <SITE_ID>
```

## CI Quick Start

Use the `--gha` preset for GitHub Actions:

```bash
opd --gha up vercel --env preview
```

`--gha` implies `--json --summary-only --timestamps`, sets default file sinks under `./.artifacts/`, and enables GitHub annotations where applicable.

For more detailed CI recipes (artifacts, annotations, matrices), see `docs/recipes.md`.

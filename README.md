# OpenDeploy CLI

[![CI](https://github.com/Dendro-X0/OpenDeploy-CLI/actions/workflows/ci.yml/badge.svg)](https://github.com/Dendro-X0/OpenDeploy-CLI/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/Dendro-X0/OpenDeploy-CLI?label=version)](https://github.com/Dendro-X0/OpenDeploy-CLI/releases)

## Introduction

OpenDeploy is a Next.js‑first, cross‑provider deployment CLI for Vercel and Netlify. It detects your stack, validates env, manages secrets, seeds databases, and deploys with readable logs and CI‑friendly JSON/NDJSON output. Supports Astro and SvelteKit; Remix is in beta; Nuxt config generation is included.

## Features

- Stack detection (Next.js, router, package manager, monorepo)
- Environment management: sync, pull, diff, validate (`--dry-run`, `--json`, `--ci`)
- Secure secret handling with redaction across human logs, JSON/NDJSON, and file sinks
- Providers: Vercel and Netlify (deploy streaming, Inspect/logsUrl capture)
- Single‑command deploy: `opendeploy up <provider>` (auto env sync + deploy)
- Guided setup: `opendeploy init` (choose providers, generate configs, set env policy)

## Quick Start

```bash
# Install dependencies
pnpm install

# Build the CLI
pnpm build

# Guided start (detect framework/provider, optional env sync)
node dist/index.js start --provider vercel --env preview --json

# Netlify prepare-only (prints recommended commands; add --deploy to execute)
node dist/index.js start --provider netlify --env preview --project <SITE_ID> --json

# Single‑command deploy (env sync + deploy)
node dist/index.js up vercel --env preview
# Netlify: use `up`, the commands printed by `start`, or run inside the wizard with --deploy:
node dist/index.js up netlify --env prod --project <SITE_ID>
```

## Documentation

Primary Docs (site):
- OpenDeploy CLI Docs: https://dendro-x0.github.io/opendeploy-cli-docs-site/

Repo Docs (reference):
- Overview: [docs/overview.md](docs/overview.md)
- Commands: [docs/commands.md](docs/commands.md)
- Response Shapes (CI): [docs/response-shapes.md](docs/response-shapes.md)
- Recipes: [docs/recipes.md](docs/recipes.md)
- Troubleshooting: [docs/troubleshooting.md](docs/troubleshooting.md)

## License

MIT © OpenDeploy Contributors

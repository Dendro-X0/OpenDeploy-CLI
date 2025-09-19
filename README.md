# OpenDeploy CLI

[![CI](https://github.com/Dendro-X0/OpenDeploy-CLI/actions/workflows/ci.yml/badge.svg)](https://github.com/Dendro-X0/OpenDeploy-CLI/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/Dendro-X0/OpenDeploy-CLI?label=version)](https://github.com/Dendro-X0/OpenDeploy-CLI/releases)

## Introduction

OpenDeploy is a Next.js‑first, cross‑provider deployment assistant. It detects your stack, validates your environment, manages secrets, seeds databases, and deploys to Vercel and Netlify with live logs and CI‑friendly output.

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

# Guided setup (choose providers, generate config, set env policy)
node dist/index.js init

# Single‑command deploy (env sync + deploy)
node dist/index.js up vercel --env preview
# For Netlify, use `up` or the commands printed by `start` (prepare‑only):
node dist/index.js up netlify --env prod --project <SITE_ID>
```

## Documentation

- Overview: [docs/overview.md](docs/overview.md)
- Getting Started: [docs/getting-started.md](docs/getting-started.md)
- Commands: [docs/commands.md](docs/commands.md)
- Configuration (redaction, JSON/NDJSON): [docs/configuration.md](docs/configuration.md)
- Response Shapes (CI): [docs/response-shapes.md](docs/response-shapes.md)
- Recipes (CI, single‑command deploy, annotations, monorepo): [docs/recipes.md](docs/recipes.md)
- Troubleshooting: [docs/troubleshooting.md](docs/troubleshooting.md)

## License

MIT © OpenDeploy Contributors

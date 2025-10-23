# OpenDeploy CLI (opd)

> Status: Project On Hold — Major Refactor Planned
>
> This project is temporarily unavailable while we redesign core architecture for reliability, integration, and scalability. The CLI and VSCode extension are not supported during this pause. If you need to reference prior work, treat the documentation below as historical only.
>
> Last updated: 2025‑10‑14

[![CI](https://github.com/Dendro-X0/OpenDeploy-CLI/actions/workflows/ci.yml/badge.svg)](https://github.com/Dendro-X0/OpenDeploy-CLI/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/Dendro-X0/OpenDeploy-CLI?label=version)](https://github.com/Dendro-X0/OpenDeploy-CLI/releases)


## Introduction

OpenDeploy is a cross‑provider deployment CLI for modern web apps. It detects your stack, validates environment, and deploys with human‑readable logs and CI‑friendly JSON/NDJSON. The short command is `opd`.

## Features

- Framework detection (Next.js, Astro, SvelteKit, more)
- Guided start wizard and one‑command deploys
- Environment management: sync, pull, diff, validate
- CI ergonomics: deterministic JSON/NDJSON summaries and timestamps
- Providers: Vercel, Cloudflare Pages, GitHub Pages

## Quick Start

```bash
# Linux/macOS — install from GitHub Releases (recommended)
curl -fsSL "https://raw.githubusercontent.com/Dendro-X0/OpenDeploy-CLI/main/packages/cli/install/install.sh" | bash
opd start

# Windows PowerShell — install from GitHub Releases
iwr "https://raw.githubusercontent.com/Dendro-X0/OpenDeploy-CLI/main/packages/cli/install/install.ps1" -UseBasicParsing | iex
opd start

# Package manager alternatives
# npm:  npx opendeploy-cli start
# pnpm: pnpm dlx opendeploy-cli start
# yarn: yarn dlx opendeploy-cli start
# bun:  bunx opendeploy-cli start
```

## Documentation

Docs site: https://dendro-x0.github.io/opendeploy-cli-docs-site/

Three steps to deploy, per provider:

- Vercel: https://dendro-x0.github.io/opendeploy-cli-docs-site/docs/opendeploy/quickstart-vercel
- GitHub Pages: https://dendro-x0.github.io/opendeploy-cli-docs-site/docs/opendeploy/quickstart-github-pages
- Cloudflare Pages: https://dendro-x0.github.io/opendeploy-cli-docs-site/docs/opendeploy/quickstart-cloudflare

Local docs (repository):

- [Overview](docs/overview.md)
- [Getting Started](docs/getting-started.md)
- [Configuration](docs/configuration.md)
- [Deployment](docs/deployment.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Acknowledgments](docs/acknowledgments.md)

## License

MIT © OpenDeploy Contributors

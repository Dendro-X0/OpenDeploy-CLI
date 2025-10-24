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
# Linux/macOS — install via script (no sudo, installs to ~/.local/bin)
curl -fsSL "https://raw.githubusercontent.com/Dendro-X0/OpenDeploy-CLI/main/scripts/install/install.sh" | bash
opd start

# Windows PowerShell — install via script (installs to %USERPROFILE%\bin)
iwr "https://raw.githubusercontent.com/Dendro-X0/OpenDeploy-CLI/main/scripts/install/install.ps1" -UseBasicParsing | iex
opd start
```

More install options (GitHub Releases binaries, Docker, source build):

- See the Install guide: https://dendro-x0.github.io/OpenDeploy-CLI/docs/opendeploy/install

## Documentation

Docs site: https://dendro-x0.github.io/OpenDeploy-CLI/

Three steps to deploy, per provider:

- Vercel: https://dendro-x0.github.io/OpenDeploy-CLI/docs/opendeploy/quickstart-vercel
- GitHub Pages: https://dendro-x0.github.io/OpenDeploy-CLI/docs/opendeploy/quickstart-github-pages
- Cloudflare Pages: https://dendro-x0.github.io/OpenDeploy-CLI/docs/opendeploy/quickstart-cloudflare

## License

MIT © OpenDeploy Contributors

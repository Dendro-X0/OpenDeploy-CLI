# OpenDeploy CLI (opd)

[![CI](https://github.com/Dendro-X0/OpenDeploy-CLI/actions/workflows/ci.yml/badge.svg)](https://github.com/Dendro-X0/OpenDeploy-CLI/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/Dendro-X0/OpenDeploy-CLI?label=version)](https://github.com/Dendro-X0/OpenDeploy-CLI/releases)

## Introduction

> Important: This project is undergoing a major architecture refactor and is currently reference‑only. The legacy design is no longer supported. A new, extensible provider system will land in the next version, enabling first‑class multi‑provider support.

OpenDeploy is a web‑focused, cross‑provider deployment CLI. It detects your stack, validates env, and deploys with readable logs and CI‑friendly JSON/NDJSON. The short command is `opd` (preferred via GitHub Releases). Compatibility aliases `opendeploy` and `opendeploy-cli` are available.

## Features

- Stack detection (framework, router, package manager, monorepo)
- Environment management: sync, pull, diff, validate (strict flags, dry‑run, JSON/NDJSON)
- Deploy streaming with Inspect/logsUrl capture (Vercel, Netlify)
- Monorepo‑aware flows and doctor checks
- CI ergonomics: deterministic summaries, sinks, timestamps, annotations

## Quick Start

```bash
# Linux/macOS — install from GitHub Releases (recommended)
curl -fsSL https://raw.githubusercontent.com/Dendro-X0/OpenDeploy-CLI/main/OpenDeploy%20CLI/scripts/install/install.sh | bash
opd start

# Windows PowerShell — install from GitHub Releases
iwr https://raw.githubusercontent.com/Dendro-X0/OpenDeploy-CLI/main/OpenDeploy%20CLI/scripts/install/install.ps1 -UseBasicParsing | iex
opd start

# Package manager alternatives (no registry account required)
# npm:    npx opendeploy-cli start
# pnpm:   pnpm dlx opendeploy-cli start
# yarn:   yarn dlx opendeploy-cli start
# bun:    bunx opendeploy-cli start
```

## Documentation

- Docs site: https://dendro-x0.github.io/opendeploy-cli-docs-site/
- Provider architecture (WIP): `docs/architecture/provider-system.md`

## License

MIT © OpenDeploy Contributors

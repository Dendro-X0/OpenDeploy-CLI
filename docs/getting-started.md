# Getting Started

OpenDeploy (opd) is a cross‑provider deployment CLI. This guide helps you install, run the wizard, and validate a basic deployment flow.

## Prerequisites
- Node.js 18+ (Node 20 recommended)
- Git installed
- Internet access (for provider APIs)

## Install
```bash
# macOS/Linux
curl -fsSL "https://raw.githubusercontent.com/Dendro-X0/OpenDeploy-CLI/main/packages/cli/install/install.sh" | bash

# Windows (PowerShell)
iwr "https://raw.githubusercontent.com/Dendro-X0/OpenDeploy-CLI/main/packages/cli/install/install.ps1" -UseBasicParsing | iex
```

## First Run
```bash
opd start
```
The start wizard detects your framework (Next.js, Astro, SvelteKit, and more), validates your environment, and guides you to a deployable state.

## CI Parity (Optional)
For pull requests and local parity, use the built‑in simulator:
```bash
# one‑shot local PR simulator
node packages/cli/dist/index.js ci-run pr --json
# or use the local wrapper
node packages/cli/dist/index.js ci-local pr --json
```
Artifacts are written to `./.artifacts/` for concise debugging.

# OpenDeploy VSCode Extension (MVP)

> Status: Project On Hold — Major Refactor Planned
>
> This extension is temporarily unavailable while we redesign core architecture for reliability, integration, and scalability. Treat the content below as historical during the pause. The marketplace release is deferred.
>
> Last updated: 2025‑10‑14

A lightweight VSCode extension to run OpenDeploy from the Command Palette.

## Commands
- OpenDeploy: Plan — run a dry-run plan (JSON/human output)
- OpenDeploy: Deploy — perform a deploy
- OpenDeploy: Detect App — detect framework/provider

## Settings
- `opendeploy.runner`: `npm` (default) or `docker`
- `opendeploy.npmBinary`: defaults to `npx opendeploy@latest`
- `opendeploy.dockerImage`: defaults to `ghcr.io/dendro-x0/opd:latest`
- `opendeploy.defaultPath`: default app path for monorepos
- `opendeploy.preferJson`: render JSON summary if available

## Develop
```bash
pnpm -C apps/extension install
pnpm -C apps/extension build
# In VSCode press F5 (Run Extension)
```

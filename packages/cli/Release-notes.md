# OpenDeploy CLI v1.2.0 — Release Notes

Release date: 2025-10-04

## Highlights

- Plugin architecture & providers (vNext)
  - Provider adapters: GitHub Pages, Cloudflare Pages, Vercel
  - Canonical provider IDs in JSON/NDJSON summaries: `github-pages`, `cloudflare-pages`, `vercel`
  - `start`/`up`/`deploy` prefer provider plugins; legacy paths minimized
- Output and CI
  - NDJSON-only: when `OPD_NDJSON=1`, human UI is suppressed; only events and final summaries are emitted
  - Final JSON always includes `final: true`; `logsUrl` surfaced consistently when available
  - New build flags wired through `start` and `up`: `--build-timeout-ms`, `--build-dry-run`
  - Strict plugin version gating: `OPD_STRICT_PLUGIN_VERSION=1` hard-fails on major API mismatches and emits a `version-mismatch` event before exit
- Security & doctor/scan
  - Built-in `scan` command with strict mode (`--strict`) and repo config (`opendeploy.scan.json`)
  - CI guards: security guard (doctor+scan strict), content guard, gitleaks
  - Redaction improvements across human logs, JSON, and NDJSON; enforced in CI
- Start wizard
  - Framework-aware provider defaults and preflight checks; optional env sync
  - NDJSON-only clean output for CI and `--json` usage
  - Monorepo improvements with `detect --scan` to list candidate apps and frameworks
- Go sidecar hardening
  - Protocol handshake (`hello`) for safer upgrades
  - Typed termination reasons on final events (`timeout`, `idle-timeout`, `start-failed`)
  - Cross-platform process-tree cleanup (Windows JobObject via taskkill; Unix process groups)
- Performance helpers
  - Sidecar actions: `zip-dir`, `tar-dir` (gzip), `checksum-file`
  - TS wrappers: `goZipDir`, `goTarDir`, `goChecksumFile`

## Breaking changes

- Netlify support removed from CLI; please use the official Netlify CLI for Netlify deployments
- Provider IDs in JSON/NDJSON are canonicalized: `github-pages`, `cloudflare-pages`, `vercel`

## Install

- npm (package: `opendeploy`)
```bash
npm i -g opendeploy
opd -h
```

- GitHub Releases (binaries)
  - Windows: `opd-win-x64.exe`
  - macOS (arm64): `opd-macos-arm64`
  - Linux (x64): `opd-linux-x64`
  - Linux (arm64): `opd-linux-arm64`

## Quickstarts

- Docs: `/docs/opendeploy/quickstart-vercel`, `/docs/opendeploy/quickstart-cloudflare`, `/docs/opendeploy/quickstart-github-pages`
- Ready-to-run workflows in your repo:
  - `.github/workflows/quickstart-vercel.yml`
  - `.github/workflows/quickstart-cloudflare.yml`
  - `.github/workflows/quickstart-github-pages.yml`

## CI guidance

- Prefer `OPD_NDJSON=1` with `--json --summary-only --timestamps` for clean logs
- Enforce plugin compatibility: `OPD_STRICT_PLUGIN_VERSION=1`
- Enforce schema guardrails: `OPD_SCHEMA_STRICT=1`

## Security notes

- Scan with strict mode to block leaks:
```bash
node packages/cli/dist/index.js scan --json --strict
```
- Redaction is enforced in CI and applies to human logs, JSON, NDJSON, and file sinks

## Verification & checksums

- Publish SHA256 checksums alongside binaries
- Smoke test across OSes:
```bash
opd start --dry-run --json
opd up vercel --dry-run --json
opd up cloudflare --dry-run --json
opd up github --dry-run --json
```

## Known considerations

- For Next on Pages (Cloudflare), prefer Linux-based CI runners or WSL for reproducibility
- For GitHub Pages (Next static export), ensure `output: 'export'`, `images.unoptimized: true`, and recommended `trailingSlash: true`; the start wizard offers safe fixes

## Links

- Changelog: `packages/cli/CHANGELOG.md`
- Docs site: `/docs/opendeploy/overview`
- Output contract: `/docs/opendeploy/architecture/output-contract`
- NDJSON guide: `/docs/opendeploy/architecture/ndjson-consumption`

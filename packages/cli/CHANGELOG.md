# Changelog

## 1.2.1 - 2025-10-10

- Docs and onboarding
  - Added 3-step quickstarts for Vercel, GitHub Pages, and Cloudflare Pages
  - Linked quickstarts from sidebar, landing page tiles, and Quick Start Guide
  - Published docs via GitHub Pages workflow
- Provider scope
  - Netlify support fully removed from CLI and docs; provider route deleted
  - Please use the official Netlify CLI for Netlify deployments
- Start wizard safe-fixes and Next.js config patchers
  - GitHub Pages: ensure `public/.nojekyll`; patch Next.js config (`output: 'export'`, `images.unoptimized: true`, `trailingSlash: true`)
  - Cloudflare Pages: generate `wrangler.toml` (Next on Pages defaults); patch Next.js config (remove `output: 'export'`, clear `basePath`, remove `assetPrefix`, set `trailingSlash: false`)
- README simplified to five sections and points to the quickstarts

## 1.2.0 - 2025-10-04

Highlights

- Plugin architecture & providers (vNext)
  - Provider adapters: GitHub Pages, Cloudflare Pages, Vercel
  - Canonical provider IDs in all JSON/NDJSON summaries: `github-pages`, `cloudflare-pages`, `vercel`
  - Start/Up/Deploy commands prefer provider plugins; legacy paths are minimized

- Output and CI
  - NDJSON-only mode: when `OPD_NDJSON=1`, human UI is fully suppressed; only events and final summaries are emitted
  - Final JSON always includes `final: true`; logs/inspect URLs surfaced consistently when available
  - New build flags wired through `start` and `up`: `--build-timeout-ms`, `--build-dry-run`
  - Strict plugin version gating: `OPD_STRICT_PLUGIN_VERSION=1` hard-fails on major API mismatches and emits a `version-mismatch` event before exit

- Security & doctor/scan
  - Built-in `scan` command with strict mode (`--strict`) and repo config (`opendeploy.scan.json`) for excludes
  - CI guards: security guard (doctor+scan strict), content guard, and gitleaks workflows enabled by default
  - Redaction improvements across human logs, JSON, and NDJSON; enforced in CI

- Start wizard improvements
  - Framework-aware provider defaults and preflight checks; environment sync option
  - NDJSON-only clean output in CI and `--json` modes; final summaries include `url` and `logsUrl` when provided by providers
  - Monorepo improvements with `detect --scan` to list candidate apps and frameworks

- Go sidecar hardening
  - Protocol handshake (`hello`) for safer upgrades
  - Typed termination reasons on final events (`timeout`, `idle-timeout`, `start-failed`)
  - Cross-platform process-tree cleanup (Windows JobObject via taskkill; Unix process groups)

- Performance helpers
  - `zip-dir`, `tar-dir` (optional gzip), and `checksum-file` actions in sidecar
  - TypeScript wrappers: `goZipDir`, `goTarDir`, `goChecksumFile`

Breaking changes

- Netlify support removed from CLI; use the official Netlify CLI for Netlify deployments
- Provider naming is now canonicalized in JSON/NDJSON summaries (`github-pages`, `cloudflare-pages`, `vercel`)

Docs & tooling

- Docs site updated with provider pages, output contract, NDJSON guide, quickstarts, and CI helpers
- Quickstart GitHub Actions workflows added for Vercel, Cloudflare Pages, and GitHub Pages
- PTY-ready request path with a safe stub fallback (no dependency required to build)
- Docs updates
  - `docs/development/opd-go-protocol.md` (handshake, reasons, actions)
  - `docs/development/go-sidecar.md` references flags and protocol

## 1.1.1 (Remastered) - 2025-09-28

- Provider parity and Start wizard UX improvements
- GitHub Pages: workflow-only Actions path with Actions deep link; branch publish optional
- Cloudflare, Netlify, Vercel: consistent url/logsUrl in start and up summaries (JSON/NDJSON)
- Unified GitHub Pages workflow generator and docs updates
- JSON schema validation with strict CI guardrail (OPD_SCHEMA_STRICT)
- Test matrix stability fixes; new logsUrl unit tests


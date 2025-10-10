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

- Go sidecar hardening
  - Protocol handshake (`hello`) for safer upgrades
  - Typed termination reasons on final events (`timeout`, `idle-timeout`, `start-failed`)
  - Cross-platform process-tree cleanup (Windows JobObject via taskkill; Unix process groups)
- Performance helpers
  - `zip-dir`, `tar-dir` (optional gzip), and `checksum-file` actions in sidecar
  - TypeScript wrappers: `goZipDir`, `goTarDir`, `goChecksumFile`
- Netlify direct deploy (experimental)
  - Go sidecar action `netlify-deploy-dir` (no CLI), requires `NETLIFY_AUTH_TOKEN`
  - Start wizard support via `OPD_NETLIFY_DIRECT=1` when `publishDir` and `--project` are provided
  - Emits final `url` and `logsUrl`, with incremental status events
- PTY-ready request path with a safe stub fallback (no dependency required to build)
- Docs updates
  - `docs/development/opd-go-protocol.md` (handshake, reasons, actions)
  - `docs/providers/netlify.md` (CLI vs Direct path, flags)
  - `docs/development/go-sidecar.md` references flags and protocol

## 1.1.1 (Remastered) - 2025-09-28

- Provider parity and Start wizard UX improvements
- GitHub Pages: workflow-only Actions path with Actions deep link; branch publish optional
- Cloudflare, Netlify, Vercel: consistent url/logsUrl in start and up summaries (JSON/NDJSON)
- Unified GitHub Pages workflow generator and docs updates
- JSON schema validation with strict CI guardrail (OPD_SCHEMA_STRICT)
- Test matrix stability fixes; new logsUrl unit tests


---
title: Release Checklist
description: Acceptance criteria and verification steps before publishing OpenDeploy CLI.
---

# Release Checklist

This checklist ensures OpenDeploy CLI is ready for GA and demo/promotion.

## Acceptance Criteria

- Deterministic JSON/NDJSON
  - All core flows emit a final JSON summary with `{"final": true}`.
  - NDJSON can be enabled via `--ndjson` or `OPD_NDJSON=1`.
  - In JSON/NDJSON/CI modes, prompts are suppressed (`OPD_FORCE_CI=1`).
- Logs URL and Error Surfacing
  - On success and failure, include `url?` and `logsUrl?` when available.
  - Human mode prints `Logs: <url>` before throwing errors.
- Provider Flows
  - Vercel: link/build/deploy/alias with Inspect URL fallback.
  - GitHub Pages: preflight hints; `.nojekyll` fix via `--fix-preflight`.
  - Cloudflare Pages: Next-on-Pages guidance; wrangler defaults; artifact sanity.
- Windows & CI Parity
  - Paths, timeouts, file operations stable in Windows CI.
  - Matrix tests pass (Windows + Linux).
- Test Suite
  - Flaky tests are skipped with TODO/issues to re-enable post-GA.
  - Unit/integration coverage runnable locally and in CI.
- Docs & README
  - README has: Introduction, Features, Quick Start, Documentation, License.
  - Quick Start and provider pages reflect current flags and outputs.
- Versioning & Distribution
  - CLI version matches package.json; `opd -v` correct.
  - GitHub Releases artifacts built with checksums.

## Verification Steps

1) Vercel
```bash
opd up vercel --json
```
Verify `{ "final": true }`, `url`, `logsUrl`. Re-run with `--ndjson`.

2) GitHub Pages (Next.js)
```bash
opd up github --preflight-only --json
opd up github --fix-preflight --preflight-only --json
opd up github --json
```

3) Cloudflare Pages
```bash
opd up cloudflare --ndjson
```
Confirm hints and final JSON line.

4) Monorepo
```bash
opd up vercel --path apps/web --json
```

5) CI Helpers
```bash
opd ci logs --json
opd ci open --json
```

6) Smoke Projects
- astro-mini
- sveltekit-mini
- next-authjs-starterkit

## Notes
- Defer new providers and IDE extensions until after GA.
- Track skipped tests with issues and re-enable post-GA.

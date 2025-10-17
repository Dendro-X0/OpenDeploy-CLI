---
title: Doctor & Preflight
description: What the Doctor command checks across Vercel, Cloudflare Pages, and GitHub Pages, how to use --fix, and how to act on remediation hints in the CLI and VSCode extension.
---

# Doctor & Preflight

`opd doctor` validates your local environment, provider CLIs, monorepo setup, and framework-specific configuration for deployment targets. It prints actionable guidance and can attempt safe fixes.

## Usage

```bash
opd doctor [--json] [--verbose] [--fix] [--path <dir>] [--project <id>] [--org <id>] [--strict]
```

- `--json` or `--ndjson`: machine-readable output with a final summary object.
- `--fix`: attempts best‑effort remediations (e.g., write `.nojekyll`, run `vercel link`/`netlify link` when IDs provided).
- `--path`: app directory (monorepos). Auto‑detected when omitted.
- `--strict`: exit non‑zero if any checks fail.

## Core checks (all setups)

- Node version (>= 18.17)
- Package managers (pnpm), optional toolchains (Bun, Prisma, Drizzle, psql)
- Monorepo & chosen working directory (app path detection)

## Vercel checks

- CLI installed (`vercel --version`) and authenticated (`vercel whoami`)
- `.vercel/project.json` link present in app or root
- Chosen deploy cwd for common monorepo layouts
- Suggestions to link (`vercel link --yes --project <id> [--org <id>]`) when applicable

## Cloudflare Pages (Next on Pages) checks

- Wrangler installed and authenticated (`wrangler --version` / `wrangler whoami`)
- `.vercel/output/static` artifact directory present (local build)
- `wrangler.toml` presence and fields:
  - `name = "<project>"`
  - `pages_build_output_dir = ".vercel/output/static"`
  - `pages_functions_directory = ".vercel/output/functions"` (optional)
- Next.js config advisories for Next on Pages:
  - Omit `output: 'export'`
  - Avoid `assetPrefix`/non‑empty `basePath`
  - Prefer `trailingSlash: false`

## GitHub Pages (static export) checks

- Git remote origin configured; `gh-pages` remote branch presence (best‑effort)
- `.nojekyll` present in `public/` or `out/`
- Next.js static export configuration:
  - `output: 'export'`
  - `trailingSlash: true`
  - `images.unoptimized: true`
  - `basePath`/`assetPrefix` aligned with repo name for project pages
- Optional CNAME custom domain hints

## JSON output and integration

With `--json` or `--ndjson`, the final object includes:

```json
{
  "ok": true,
  "action": "doctor",
  "results": [ { "name": "vercel auth", "ok": true, "message": "user@domain.com" } ],
  "suggestions": ["vercel link --yes --project <id> --org <id>"],
  "final": true
}
```

The VSCode extension surfaces a compact Doctor card in the Summary panel, listing failed checks (up to 5) and quick actions:

- Run "Doctor & Preflight"
- Run "Doctor (Fix)"

## VSCode Onboarding Wizard

- Use "OpenDeploy: Onboarding" to:
  - Select app path (monorepo aware)
  - Select provider and check auth
  - Run Plan, Deploy, or Follow Logs
  - Use Summary & Shortcuts to open dashboards, follow logs, run Doctor, or open the Summary panel.

## Remediation tips

- Vercel: ensure CLI is installed and linked; use the extension alias/rollback commands for production management.
- Cloudflare Pages: generate config and build locally via `@cloudflare/next-on-pages` when applicable; ensure wrangler authentication.
- GitHub Pages: ensure static export settings and `.nojekyll`; use the generator to scaffold workflows.

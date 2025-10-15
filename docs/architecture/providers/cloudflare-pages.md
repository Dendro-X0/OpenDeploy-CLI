# Provider: Cloudflare Pages (Current State — Phase 1)

Sources:
- `packages/cli/src/core/provider-system/providers/cloudflare-pages.ts`
- `packages/cli/src/commands/start.ts` (wizard may emit Cloudflare events)

## Capabilities (declared)
- Local build: true (especially when using Next on Pages builder)
- Remote build: false
- Static deploy: true
- SSR: true (via Pages Functions / Next on Pages)
- Edge functions: true
- Logs follow: false (no streaming follow as implemented)
- Project linking: name-based

## Detection
`detect(cwd)` → `{ framework?, publishDir? }`
- Uses auto detector; publishDir defaults to `dist`.

## Auth/prereqs
`validateAuth(cwd)`
- Resolves wrangler binary (`wrangler`, `wrangler.cmd`, absolute via `where`, or `npx`/`pnpm dlx` fallback).
- Ensures `wrangler --version` and `wrangler whoami` succeed; otherwise throws.

## Link
`link(cwd, project)`
- Derives a sanitized name from cwd or provided `project`.
- Attempts to create Pages project via `wrangler pages project create <name> [--production-branch main]`.
- Returns `{ projectId: name, slug: name }`.

## Build
`build({ cwd, framework?, noBuild? })`
- For Next.js (`framework.toLowerCase()==='next'`) and when `noBuild !== true`:
  - Cleans `.vercel/output` and `.next`.
  - Forces env `.env.production` additions (`DEPLOY_TARGET=cloudflare`, etc.).
  - Attempts `next-on-pages` via local bin, `pnpm exec`, or `npx` fallbacks.
  - Verifies `.vercel/output/static` exists; returns `{ ok: true, artifactDir }` or `{ ok: false, message }`.
  - Optionally writes `_redirects` based on env flag or auto-detected stale subpath references.
- For non-Next: resolves artifactDir among `publishDirHint`, `dist`, `build`, `out`, `public` (first existing) or returns a hint path.

## Deploy
`deploy({ cwd, artifactDir?, project })`
- Resolves wrangler binary.
- Verifies `artifactDir` exists.
- Runs `wrangler pages deploy <dir> [--project-name <name>]`.
- Extracts URLs from stdout; chooses preview URL (`*.pages.dev`) and best-effort dashboard logs URL.
- If project name known, queries `wrangler pages deployments list` and prefers an Inspect URL found there.
- Returns `{ ok, url, logsUrl }`.

## Generate config
`generateConfig({ cwd })` writes minimal `wrangler.toml` with a sanitized `name`.

## Risks / gaps (vNext work)
- Shell string construction with unquoted `dir` may break on spaces.
- Multiple fallbacks for wrangler/next-on-pages introduce variability; errors may be non-obvious.
- `.env.production` mutation during build is surprising; should be explicit and reversible. Current code restores, but vNext should avoid temp mutations where possible.
- Events: ensure final summary always includes `logsUrl` when known; normalize `phase` across NDJSON.

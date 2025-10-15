# Provider: GitHub Pages (Current State — Phase 1)

This document maps the current GitHub Pages provider behavior to guide vNext stabilization.

Sources:
- `packages/cli/src/core/provider-system/providers/github-pages.ts`
- `packages/cli/src/commands/doctor.ts`
- `packages/cli/src/commands/plan.ts`
- `packages/cli/src/commands/generate.ts`

## Capabilities
- Static deploys only.
- Local build supported (Next.js static export, Astro, SvelteKit best-effort).
- No remote build, SSR, rollback, alias, logs follow.

## Detection
`detect(cwd)`
- Uses `autoDetect({ cwd })` to infer `framework` and `publishDir`.
- If framework is Next.js, prefers `out` (requires `output: 'export'`).
- Fallbacks: `publishDir` from detection or `'dist'`.

## Prerequisites / Auth
`validateAuth(cwd)`
- Requires `git` on PATH.
- Requires `git remote get-url origin` to exist and point to GitHub. (Used later to build the public URL.)

## Build (artifact resolution)
`build({ cwd, framework?, publishDirHint?, noBuild? })`
- If `noBuild !== true`, best-effort framework build:
  - Next.js: `npx -y next build` (expects `output: 'export'` → `out/`). Adds Next-specific hints via `checkNextHints()`; warns if `out/` or `_next/` missing.
  - Astro: `npx -y astro build` (expects `dist/`).
  - SvelteKit: `npx -y vite build` (expects `build/`).
- Artifact selection order:
  - If `publishDirHint` exists → use it.
  - Else first existing in [`dist`, `build`, `out`, `public`].
  - Else return a hint path (`publishDirHint || 'dist'`) even if not present.

## Deploy
`deploy({ cwd, artifactDir? })`
- Resolves a `gh-pages` binary:
  - `OPD_GHPAGES_BIN` → local `gh-pages` → Windows `where gh-pages(.cmd)` → `npx -y gh-pages` → `pnpm dlx gh-pages` → fallback `'gh-pages'`.
- Ensures `.nojekyll` is present in `artifactDir` to allow `_next` assets.
- Runs: `gh-pages -d <artifactDir> --dotfiles`.
- Infers public URL from Git origin remote (e.g., `https://<owner>.github.io/<repo>/`).

## Generate config
`generateConfig({ cwd })`
- Writes `.nojekyll` in project root if not present.

## Next.js hints (static export)
`checkNextHints(cwd)`
- Reads `next.config.(ts|js|mjs)`; warns if:
  - Missing `output: 'export'`.
  - `trailingSlash: true` not set (recommended).
  - `images.unoptimized: true` missing (recommended).
  - `basePath` and `assetPrefix` missing or mismatched vs repo (derived from `git remote origin`).

## Doctor integration
`doctor` command combines:
- Toolchain checks (node, pnpm, bun, vercel/netlify/wrangler, optional prisma/drizzle/psql).
- App path resolution and monorepo hints.
- GitHub Pages readiness:
  - `git origin remote` present.
  - `gh-pages` remote branch existence (non-blocking; created on first publish).
  - Next.js checks similar to provider hints.
  - `--fix` writes `.nojekyll` to `public/` or `out/`.

## Plan output (heuristics)
`plan github`
- For Astro → `gh-pages -d dist`.
- For SvelteKit → `gh-pages -d build`.
- For Next → comment about static export + `next build && gh-pages -d out`.
- Else → `gh-pages -d <publishDir|dist>`.

## Workflow generation
`generate github`
- Reusable caller workflow (`deploy-app-gh-pages.yml`) with `uses: ./.github/workflows/_reusable-gh-pages.yml` and `with: app_path`.
- Standalone `deploy-pages.yml` with build (pnpm + Node 20) and `actions/deploy-pages@v4`.

## Known risks / gaps (to address in vNext)
- The deploy command builds `gh-pages -d ${dir}` without quoting; paths with spaces may fail on Windows.
- Resolver may fall back to `'gh-pages'` even if not installed; better error messaging needed.
- Next.js build uses `next build` assuming `output: 'export'`; some projects require `next export` in older versions; clarify support matrix.
- Artifact selection returns a hint path even if nonexistent; vNext should validate the path or fail early with actionable hints.
- Provider id is `'github'`; standardize to `'github-pages'` in vNext for clarity.
- Events: `phase/event/stage` inconsistent across commands; normalize to `phase` with a final JSON summary for every command.

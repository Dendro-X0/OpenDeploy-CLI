# Deployment Commands

Supported providers: Vercel, Cloudflare Pages, GitHub Pages.

## deploy (Vercel)
Deploy the detected app to Vercel.

Usage:
```bash
opd deploy vercel \
  [--env <prod|preview>] [--project <id>] [--org <id>] [--path <dir>] \
  [--dry-run] [--json] [--ci] [--sync-env] [--alias <domain>]
```

Notes:
- In monorepos, the CLI prefers the linked app directory (e.g., `apps/web/.vercel/project.json`). If only the root is linked, it deploys from the root. Otherwise it deploys from the target path.
- `--dry-run` emits a deterministic JSON summary and performs no provider actions.

Dry‑run example (Vercel):
```json
{
  "provider": "vercel",
  "target": "preview",
  "mode": "dry-run",
  "final": true
}
```

## up (Vercel)
Single‑command deploy: sync env, then deploy.

```bash
opd up vercel \
  [--env <prod|preview>] [--project <id>] [--org <id>] [--path <dir>] \
  [--dry-run] [--json] [--ci] [--build-timeout-ms <ms>] [--build-dry-run]
```

Behavior:
- Runs env diff/sync from a local file before deploy (prod → `.env.production.local` or `.env`; preview → `.env` or `.env.local`).
- Respects filters and CI flags configured for `env` commands.
- Emits the same deploy JSON/NDJSON summaries as `deploy`.

Notes:
- `up` runs in‑process and delegates to `deploy` with `--sync-env` implied.
- Respects `--path`, `--project/--org`, `--env` (`prod` | `preview`).
- Use `--ndjson --timestamps` to stream logs and emit final summary with `{ final: true }`.
- When the provider is omitted, the CLI opens the interactive wizard (`opd start`) automatically.

## deploy (Cloudflare Pages)
Deploy the detected app to Cloudflare Pages.

Usage:
```bash
opd deploy cloudflare \
  [--env <prod|preview>] [--path <dir>] [--dry-run] [--json] [--ci]
```

Notes:
- The CLI generates/uses `wrangler.toml` as needed. For Next on Pages SSR/hybrid, the wizard can patch `next.config.*` automatically in CI/JSON modes.
- `--dry-run` emits a deterministic JSON summary and performs no provider actions.

## up (Cloudflare Pages)
Single‑command deploy: optional env sync and deploy.

```bash
opd up cloudflare \
  [--env <prod|preview>] [--path <dir>] \
  [--dry-run] [--json] [--ci] [--build-timeout-ms <ms>] [--build-dry-run]
```

Notes:
- Use `--ndjson` in CI to stream compact events and a final summary.
- `--build-dry-run` skips local build while continuing the flow (treated as no‑build when falling back to provider build).

## deploy (GitHub Pages)
Deploy a static site to GitHub Pages.

Usage:
```bash
opd deploy github \
  [--env <prod|preview>] [--path <dir>] [--dry-run] [--json] [--ci]
```

Notes:
- The CLI writes `.nojekyll` and can patch static Next.js configs (output: 'export', images.unoptimized) when applicable.
- For monorepos or project pages, ensure `basePath`/`assetPrefix` are configured; the start wizard provides hints and auto‑fixes in CI modes.

## up (GitHub Pages)
Single‑command prepare/deploy for GitHub Pages.

```bash
opd up github \
  [--env <prod|preview>] [--path <dir>] \
  [--dry-run] [--json] [--ci] [--build-timeout-ms <ms>] [--build-dry-run]
```

Notes:
- `--preflight-only` and `--strict-preflight` are supported (see `opd up --help`). These run checks and artifact sanity without publishing.

## open (dashboards)
Open the project dashboard or site.

```bash
opd open vercel      # open Vercel dashboard (linked project)
opd open github      # open GitHub Pages site URL
opd open cloudflare  # open Cloudflare Pages dashboard
```

## logs (Vercel | Cloudflare)
Open or tail logs for the latest deployment.

```bash
opd logs <vercel|cloudflare> \
  [--env <prod|preview>] [--follow] [--since <duration>] [--open] [--json]
```

Notes:
- Vercel: prints or tails the Inspect URL and runtime logs.
- Cloudflare Pages: resolves the latest deployment URL and dashboard Inspect link; `--open` opens the dashboard.

## alias (Vercel)
Assign a custom domain (alias) to a Vercel deployment.

```
opd alias vercel --set <domain> --deployment <idOrUrl> [--project <id>] [--org <id>] [--path <dir>] [--json]
```

Examples:

```bash
# Alias a specific deployment URL
opd alias vercel --set mysite.com --deployment https://my-app-abc123.vercel.app --json

# Alias using a deployment id/slug
opd alias vercel --set mysite.com --deployment my-app-abc123
```

Notes:
- Monorepos: the CLI prefers a linked app directory (`apps/*/.vercel/project.json`), then falls back to repo root if linked there.
- If `--project` or `--org` are provided, the CLI attempts a non-interactive `vercel link` before aliasing.
- Emits a final JSON summary when `--json` or `--ndjson` is used.

## promote / rollback (Vercel)
Promote a preview to production, or rollback production to a previous successful deployment.

Promote:
```bash
opd promote vercel --alias <prod-domain> [--path <dir>] [--project <id>] [--org <id>] [--dry-run] [--json]
```

Rollback:
```bash
opd rollback vercel --alias <prod-domain> [--to <url|sha>] [--path <dir>] [--project <id>] [--org <id>] [--dry-run] [--json]
```

Notes:
- `--dry-run` emits a deterministic JSON summary (no changes), suitable for CI validation.

---

Tips for CI:
- Prefer `--json --summary-only --timestamps` (or `OPD_NDJSON=1`) to ensure clean machine consumption.
- Set `OPD_STRICT_PLUGIN_VERSION=1` to hard‑fail on stack/provider plugin API version mismatches. A `version-mismatch` NDJSON event is emitted before exit.

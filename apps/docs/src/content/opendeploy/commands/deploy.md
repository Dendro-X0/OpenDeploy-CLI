# Deployment Commands

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
opd up vercel [--env <prod|preview>] [--project <id>] [--org <id>] [--path <dir>] [--dry-run] [--json] [--ci]
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

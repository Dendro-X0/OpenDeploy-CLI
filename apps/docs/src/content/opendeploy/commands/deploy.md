# Deployment Commands

## deploy
Deploy the detected app to a provider.

Usage:
```bash
opd deploy <vercel|netlify> \
  [--env <prod|preview>] [--project <id>] [--org <id>] [--path <dir>] \
  [--dry-run] [--json] [--ci] [--sync-env] [--alias <domain>]
```

Notes:
- In monorepos, the CLI prefers the linked app directory (e.g., `apps/web/.vercel/project.json`). If only the root is linked, it deploys from the root. Otherwise it deploys from the target path.
- For Netlify, the CLI generates a minimal `netlify.toml` using `@netlify/plugin-nextjs` if missing.

Dry‑run:
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

Dry‑run example (Netlify):
```json
{
  "provider": "netlify",
  "target": "prod",
  "mode": "dry-run",
  "final": true
}
```

## up
Single‑command deploy: sync env, then deploy.

```bash
opd up [vercel|netlify] [--env <prod|preview>] [--project <id>] [--org <id>] [--path <dir>] [--dry-run] [--json] [--ci]
```

Behavior:
- Runs env diff/sync from a local file before deploy (prod → `.env.production.local` or `.env`; preview → `.env` or `.env.local`).
- Respects filters and CI flags configured for `env` commands.
- Emits the same deploy JSON/NDJSON summaries as `deploy`.

Notes:
- `up` runs in‑process and delegates to `deploy` with `--sync-env` implied.
- Respects `--path` (monorepo), `--project/--org`, `--env` (`prod` | `preview`).
- Use `--ndjson --timestamps` to stream logs and emit final summary with `{ final: true }`.
- When the provider is omitted, the CLI opens the interactive wizard (`opd start`) automatically.

Dry‑run:
- `--dry-run` emits a deterministic JSON summary and performs no env sync or deploy side effects.

Dry‑run example (Vercel):
```json
{
  "provider": "vercel",
  "target": "prod",
  "mode": "dry-run",
  "final": true
}
```

Dry‑run example (Netlify):
```json
{
  "provider": "netlify",
  "target": "preview",
  "mode": "dry-run",
  "final": true
}
```

## Logs and Inspect URLs
`up` and `deploy` emit `url` (deployment/production URL) and `logsUrl` when available:

- Vercel: `logsUrl` is the Inspect URL. If the deploy stream doesn’t print it, the CLI falls back to `vercel inspect <url>` to resolve it.
- Netlify: `logsUrl` points to the deployment dashboard, resolved from the site ID and latest deploy id.

Example (Vercel, up --json):
```json
{
  "provider": "vercel",
  "target": "preview",
  "url": "https://my-app-abc.vercel.app",
  "logsUrl": "https://vercel.com/acme/my-app/inspect/dep_123",
  "final": true
}
```

Example (Netlify, up --json):
```json
{
  "provider": "netlify",
  "target": "prod",
  "url": "https://my-site.netlify.app",
  "logsUrl": "https://app.netlify.com/sites/my-site/deploys/dep_abc123",
  "final": true
}
```

## promote
Promote a preview to production.

Usage (Vercel):
```bash
opd promote vercel --alias <prod-domain> [--path <dir>] [--project <id>] [--org <id>] [--dry-run] [--json]
```
Behavior (Vercel):
- Resolves the most recent ready preview deploy and assigns the provided `--alias` domain to it.
- In monorepos, prefers the linked app directory when present.

Usage (Netlify):
```bash
opd promote netlify [--path <dir>] [--project <siteId>] [--dry-run] [--json]
```
Behavior (Netlify):
- Best‑effort promote by deploying current code to production: `netlify deploy --build --prod`.

Dry‑run:
- `--dry-run` emits a deterministic JSON summary (no promotion), suitable for CI validation.

Dry‑run example (Vercel):
```json
{
  "provider": "vercel",
  "action": "promote",
  "target": "prod",
  "alias": "https://example.com",
  "final": true
}
```

Dry‑run example (Netlify):
```json
{
  "provider": "netlify",
  "action": "promote",
  "target": "prod",
  "final": true
}
```

### JSON examples
Vercel:
```json
{
  "ok": true,
  "provider": "vercel",
  "action": "promote",
  "target": "prod",
  "from": "https://my-preview.vercel.app",
  "url": "https://my-app.com",
  "alias": "https://my-app.com",
  "final": true
}
```

Netlify:
```json
{
  "ok": true,
  "provider": "netlify",
  "action": "promote",
  "target": "prod",
  "url": "https://my-site.netlify.app",
  "logsUrl": "https://app.netlify.com/sites/my-site/deploys/dep_abc123",
  "siteId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "final": true
}
```

## rollback
Rollback production to a previous successful deployment.

Usage (Vercel):
```bash
opd rollback vercel --alias <prod-domain> [--to <url|sha>] [--path <dir>] [--project <id>] [--org <id>] [--dry-run] [--json]
```
Behavior (Vercel):
- Resolves the previous production deploy (or a specific one via `--to`) and points the alias back to it.

Usage (Netlify):
```bash
opd rollback netlify [--project <siteId>] [--path <dir>] [--dry-run] [--json]
```
Behavior (Netlify):
- Attempts restore via Netlify API; falls back to dashboard guidance if not permitted.

Dry‑run:
- `--dry-run` emits a deterministic JSON summary (no restore), suitable for CI validation.

Dry‑run example (Vercel/Netlify):
```json
{
  "provider": "vercel",
  "action": "rollback",
  "target": "prod",
  "final": true
}
```

### JSON examples
Vercel (success):
```json
{
  "ok": true,
  "provider": "vercel",
  "action": "rollback",
  "target": "prod",
  "to": "https://prev-prod.vercel.app",
  "url": "https://my-app.com",
  "alias": "https://my-app.com",
  "final": true
}
```

Vercel (candidate only):
```json
{
  "ok": true,
  "provider": "vercel",
  "action": "rollback",
  "target": "prod",
  "candidate": "https://prev-prod.vercel.app",
  "needsAlias": true,
  "final": true
}
```

Netlify (failure path):
```json
{
  "ok": false,
  "provider": "netlify",
  "action": "rollback",
  "target": "prod",
  "message": "Restore failed. Use dashboard to restore.",
  "dashboard": "https://app.netlify.com/sites/my-site/deploys/dep_abc123",
  "final": true
}
```

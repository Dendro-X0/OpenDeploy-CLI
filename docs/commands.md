## generate

Generate configuration files for the detected app (Vercel, Netlify) or a Turborepo pipeline.

Usage:
```bash
opd generate <vercel|netlify|turbo> [--overwrite] [--json]
```

Behavior:
- Idempotent: existing files are kept unless `--overwrite` is passed.
- `vercel`: writes a minimal `vercel.json` with `version`, optional `buildCommand`, and `outputDirectory` when `publishDir` is detected.
- `netlify`: writes `netlify.toml` with a safe build:
  - Next.js: uses Netlify Next Runtime when installed, otherwise falls back to `@netlify/plugin-nextjs` (legacy plugin) and sets `publish = ".next"`.
  - Nuxt: sets `command = "npx nuxi build"` and `publish = ".output/public"`.
  - Other frameworks (Astro, SvelteKit static, Remix static): uses detected `buildCommand` and `publishDir`.
- `turbo`: writes a minimal `turbo.json` with cached outputs for `.next/**` (excluding `.next/cache/**`) and `dist/**`.

JSON summary:
```json
{ "ok": true, "action": "generate", "provider": "vercel|netlify|turbo", "path": "STRING", "final": true }
```

## Global Output & CI Flags
For CI consumers, see also: [Response Shapes (CI)](./response-shapes.md)
## init
Interactive setup to choose provider(s), generate provider config files, and set default env policy.

Usage:
```bash
opd init [--json]
```

Behavior:
- Prompts to select Vercel and/or Netlify.
- Generates `vercel.json`/`netlify.toml` (idempotent) via adapters.
- Writes `opd.config.json` with your env policy (auto‑sync on/off, filters).

Use these flags with any command to tailor output for CI or local use:

- `--quiet` — error-only output (suppresses info/warn/success).
- `--no-emoji` — replace emoji prefixes with ASCII (e.g. `[info]`).
- `--json` — JSON-only output (suppresses non-JSON logs).
- `--compact-json` — one-line JSON (good for log pipelines).
- `--ndjson` — newline-delimited JSON streaming (implies `--json`).
- `--timestamps` — add ISO timestamps to human logs and JSON objects.
- `--summary-only` — suppress intermediate JSON and print only final summary objects (`{ final: true }`).
- `--json-file [path]` and `--ndjson-file [path]` — append outputs to file sinks (defaults to `./.artifacts/*` when path omitted).
- `--gha-annotations <error|warning|off>` — control GitHub annotation severity.
- `--gha` — GitHub Actions-friendly defaults (implies `--json --summary-only --timestamps` and sets default file sinks and `--gha-annotations` when unset).

# Result Codes & CI behavior

- Detect
  - Exit 0 on success; non‑zero on detection errors.
- Doctor
  - In `--ci`, exits non‑zero if any check fails (auth, CLIs, versions, monorepo sanity).
- Env Diff / Sync
  - In `--ci`, env diff exits non‑zero when differences exist. Strict flags `--fail-on-add` / `--fail-on-remove` cause non‑zero when those conditions occur. Env sync exits non‑zero on provider errors.
- Deploy / Up
  - Exit 0 on successful deploy; non‑zero on provider errors. In `--dry-run`, exit 0.
- Promote / Rollback
  - Exit 0 on success; non‑zero on provider errors. In `--dry-run`, exit 0.

# Commands

## completion
Generate shell completion scripts for bash, zsh, or PowerShell.

Usage:
```bash
opd completion --shell <bash|zsh|pwsh>
```

Install (user-local examples):

- Bash (Linux/macOS):
```bash
# macOS (Homebrew bash-completion):
opd completion --shell bash > $(brew --prefix)/etc/bash_completion.d/opd
# Generic (user):
opd completion --shell bash > ~/.opd-completion.bash
echo 'source ~/.opd-completion.bash' >> ~/.bashrc
```

- Zsh:
```bash
opd completion --shell zsh > ~/.opd-completion.zsh
echo 'fpath=(~/.zfunc $fpath)' >> ~/.zshrc
mkdir -p ~/.zfunc
mv ~/.opd-completion.zsh ~/.zfunc/_opd
echo 'autoload -U compinit && compinit' >> ~/.zshrc
```

- PowerShell (Windows/macOS/Linux):
```powershell
opd completion --shell pwsh | Out-File -FilePath $PROFILE -Append -Encoding utf8
# Restart PowerShell
```

## start
Guided wizard for selecting framework, provider, environment, optional env sync, and deploying.

Usage:
```bash
opd start [--framework <next|astro|sveltekit|remix|expo>] \
  [--provider <vercel|netlify>] [--env <prod|preview>] \
  [--path <dir>] [--project <id>] [--org <id>] \
  [--sync-env] [--dry-run] [--json] [--ci] [--no-save-defaults] \
  [--deploy] [--no-build] [--alias <domain>] [--print-cmd]
```

Behavior:
- Auto-detects frameworks when possible; otherwise prompts for a choice.
- Shows provider login status and offers one‑click login if required.
- If `--project/--org` (Vercel) or `--project` (Netlify) is provided and the directory is not linked yet, the wizard offers to run `vercel link` / `netlify link` inline.
- Env sync is optional; when enabled, the wizard chooses a sensible `.env` file per target.
- Config generation: ensures minimal `vercel.json` (Vercel) and a safe `netlify.toml` when applicable. For Next.js on Netlify, the adapter applies the official Next runtime/plugin.
- Preflight: optionally runs a local build (skipped in `--ci`) and validates that Netlify publishDir contains output for non‑Next frameworks.
- Vercel: performs the deploy (preview/prod) and prints `url`/`logsUrl`. When `--alias` is provided, the wizard attempts to alias the deployment to the given domain.
- Netlify: prepare‑only by default. The wizard generates config and prints recommended `netlify deploy` commands (preview/prod) with an inferred `--dir`. Optionally, pass `--deploy` to execute a real deploy inside the wizard. With `--no-build`, the wizard deploys prebuilt artifacts from `--dir`.
- After Vercel deploy (only), the wizard prints a copyable non‑interactive command and offers to copy the logs URL.
- With `--json`, prints a final summary. For Netlify, `{ ok, provider, target, mode: 'prepare-only'|'deploy', projectId?, siteId?, siteName?, publishDir?, logsUrl?, recommend?, final: true }`.
- With `--dry-run`, prints `{ ok: true, mode: 'dry-run', cmd, final: true }` and exits before syncing/deploying.

### Troubleshooting and Logs

Use these options to ensure reliable logs and summaries in both success and failure cases:

- `--capture`
  - Writes JSON and NDJSON outputs to `./.artifacts/` by default.
  - In `--ci`, capture is enabled automatically if sinks are not already configured.
- `--ndjson`
  - Streams provider output and events as one-line JSON objects. Events include:
  - `stdout` and `stderr`: provider output (truncated per-line to keep logs compact)
  - `logs`: dashboard/inspect URL (`logsUrl`) as soon as it’s detected
  - `done`: emitted at the end with `{ ok: true|false }`
- `--summary-only`
  - Suppresses intermediate JSON and prints only final summary objects (`{ final: true }`).
- `--show-logs`
  - Also echoes provider stdout/stderr lines during the run in human mode (non‑JSON).
- `--timeout <seconds>`
  - Aborts the provider subprocess after N seconds and emits a final summary (with a reason).
  - Defaults to no timeout locally; in `--ci` the default is 900 seconds unless you override it.
- Soft‑fail behavior in automation
  - In `--ci` or `--json`, failures exit with code 0 by default so orchestrators don’t drop logs.
  - A final JSON summary is still emitted with `ok: false` and `final: true`.
  - Use `--soft-fail` locally to adopt the same behavior outside CI.
- Failure summaries include helpful context
  - `errorLogTail`: last lines of provider output to quickly surface root cause
  - `logsUrl`: dashboard/inspect URL for the failing deploy
  - `ciChecklist`: minimal checklist (e.g., `buildCommand`) to validate before re‑running

Artifacts

When `--capture` (or `--ci` with no sinks) is used, the wizard writes:

- `.artifacts/opd-start-<timestamp>.json` — final JSON summaries
- `.artifacts/opd-start-<timestamp>.ndjson` — streaming events (`stdout`, `stderr`, `logs`, `done`)

NDJSON events:

When `--ndjson` is active (or `OPD_NDJSON=1`), the wizard emits compact one-line JSON events before the final summary. A cross-provider logs event is emitted when a dashboard/inspect URL is available:

```json
{"action":"start","provider":"vercel","target":"preview","event":"logs","logsUrl":"https://vercel.com/acme/app/inspections/dep_123"}
```

```json
{"action":"start","provider":"netlify","target":"preview","event":"logs","logsUrl":"https://app.netlify.com/sites/mysite/deploys"}
```

Examples:

```bash
# Vercel preview deploy with alias
opd start --provider vercel --env preview --alias preview.example.com --json

# Netlify prepare-only (print recommended commands)
opd start --provider netlify --env preview --project <SITE_ID> --json

# Netlify deploy without building (use prebuilt artifacts in publishDir)
opd start --provider netlify --env preview --project <SITE_ID> --deploy --no-build --json --print-cmd

# Monorepo: deploy from apps/web
opd start --provider vercel --path apps/web --env preview --json
```

Notes:
- Use `--no-save-defaults` to suppress the prompt to persist your selections to `opd.config.json` under `startDefaults`.
 - To clear saved defaults, delete `opd.config.json` at the project root or remove the `startDefaults` property from it.
- Netlify support in `start` is intentionally limited to preparation for now. To deploy on Netlify, either:
  - Run the recommended commands the wizard prints (e.g., `netlify deploy --dir <publish_dir> --site <SITE_ID>`), or
  - Use `opd up netlify --env <preview|prod> --project <SITE_ID>`

## detect
Detect your app and its configuration (supports Next.js, Astro, SvelteKit, Remix, Nuxt; Expo when `OPD_EXPERIMENTAL=1`).

Usage:
```bash
opd detect [--json]
```
Output fields:
- framework, rootDir, appDir, hasAppRouter
- packageManager (pnpm | yarn | npm | bun)
- monorepo (turborepo | nx | workspaces | none)
- buildCommand, outputDir, publishDir?, renderMode (static|ssr|hybrid), confidence (0..1)
- environmentFiles

Notes:
- With `--json`, only JSON is printed.

### JSON output (schema)

```json
{
  "framework": "next|astro|sveltekit|remix|nuxt|expo",
  "rootDir": "STRING",
  "appDir": "STRING",
  "hasAppRouter": true,
  "packageManager": "pnpm|yarn|npm|bun",
  "monorepo": "turborepo|nx|workspaces|none",
  "buildCommand": "STRING",
  "outputDir": "STRING",
  "publishDir": "STRING?",
  "renderMode": "static|ssr|hybrid",
  "confidence": 0.92,
  "environmentFiles": ["STRING"]
}

## promote

Promote a preview to production.

Usage (Vercel):

```bash
opd promote vercel --alias <prod-domain> [--from <preview-url-or-sha>] [--print-cmd] [--json] [--dry-run]
```

Notes:

- With `--from`, you can point the production alias at a specific preview URL (or SHA that corresponds to a preview). Without `--from`, the CLI resolves the most recent ready preview.
- Final JSON contains `{ ok, provider: 'vercel', action: 'promote', target: 'prod', from, url, alias, final: true }`.

Usage (Netlify):

```bash
opd promote netlify --project <SITE_ID> [--from <deployId>] [--print-cmd] [--json] [--dry-run]
```

Notes:

- With `--from <deployId>`, the CLI requests a direct restore of that deploy (no rebuild). Without `--from`, it runs a production deploy (build) and prints the resulting URL.
- Final JSON contains either `{ ok, provider: 'netlify', action: 'promote', target: 'prod', deployId, siteId, final: true }` for restore, or `{ ok, url, logsUrl, siteId, final: true }` for build-based promote.

Reliability knobs:

- All provider subprocess calls honor `--retries`, `--timeout-ms`, and `--base-delay-ms`.

## rollback

Rollback to a previous production deployment (provider-specific strategies).

Usage (Vercel):

```bash
opd rollback vercel --alias <prod-domain> [--to <url|sha>] [--print-cmd] [--json] [--dry-run]
```

Notes:

- When `--to` is omitted, the CLI lists production history and suggests a candidate. With `--to`, it will attempt to repoint the alias directly.
- Final JSON includes `{ ok, provider: 'vercel', action: 'rollback', target: 'prod', to|candidate, alias, final: true }`.

Usage (Netlify):

```bash
opd rollback netlify --project <SITE_ID> [--print-cmd] [--json] [--dry-run]
```

Notes:

- Rollback restores are performed via the Netlify dashboard or API. The CLI provides a suggested `restoreDeploy` command and summarizes results in JSON.
- Final JSON contains `{ ok, provider: 'netlify', action: 'rollback', target: 'prod', deployId?, dashboard?, final: true }`.
 - Reliability knobs: `--retries`, `--timeout-ms`, and `--base-delay-ms` apply here as well.
```

Example:
```json
{
  "framework": "next",
  "rootDir": "/home/me/app",
  "appDir": "/home/me/app",
  "hasAppRouter": true,
  "packageManager": "pnpm",
  "monorepo": "workspaces",
  "buildCommand": "next build",
  "outputDir": ".next",
  "publishDir": null,
  "renderMode": "hybrid",
  "confidence": 0.95,
  "environmentFiles": [".env", ".env.local", ".env.production.local"]
}
```

## explain

Show what will happen for a deploy without executing anything. Useful for PR comments or human review.

Usage:

```bash
opd explain <vercel|netlify> [--env <prod|preview>] [--path <dir>] [--project <id>] [--org <id>] [--sync-env] [--json]
```

Behavior:

- Detects the app directory, linked cwd (Vercel target vs root), potential env file, and lists planned steps (detect, link, env, deploy) with titles.
- With `--json`, prints `{ ok, plan, final: true }` where `plan` includes provider, target, cwd, steps, and env summary.

## run

Orchestrate env operations and seeding across multiple projects with concurrency and tags.

Usage:

```bash
opd run --projects <csv> | --all \
  --env <prod|preview> \
  [--diff-env] [--sync-env] \
  [--concurrency <n>] [--json]
```

Notes:

- Uses `opd.config.json` to resolve project defaults and policies.
- Respects strict diff flags in `--ci`.

## seed

Run database seed or migration steps in a provider-agnostic way.

Usage:

```bash
opd seed --schema <sql|prisma|script> [--script <npm-script>] [--json]
```

Behavior:

- `sql`: executes SQL files or a configured command.
- `prisma`: runs `prisma db seed` or `prisma db push` as configured.
- `script`: runs your npm script (e.g., `db:seed` or `db:push`).

## doctor
Validate local environment and provider CLIs.

Usage:
```bash
opd doctor [--ci] [--json] [--verbose] [--fix] [--path <dir>] [--project <vercelProjectId>] [--org <orgId>] [--site <netlifySiteId>]
```
Checks:
- Node version
- pnpm, bun, vercel, netlify CLIs
- Auth for Vercel/Netlify
- Monorepo sanity (workspace lockfile, `.vercel/project.json`, optional root `vercel.json`)
- Monorepo linked apps scan (`apps/*`) and chosen deploy cwd advisories for common paths (e.g., `apps/web`).

Notes:
- With `--json`, only JSON is printed. `--ci` exits non‑zero if any check fails.
- With `--fix`, the CLI attempts best‑effort linking fixes:
  - Vercel: `vercel link --yes --project <id> [--org <id>]` when `--project` is provided
  - Netlify: `netlify link --id <siteId>` when `--site` is provided

Examples:

```bash
# Fix Vercel linking in a monorepo app directory
opd doctor --fix --path apps/web --project <VERCEL_PROJECT_ID> --org <ORG_ID>

# Fix Netlify linking for a site
opd doctor --fix --path apps/web --site <NETLIFY_SITE_ID>
```

### JSON output (schema)

```json
{
  "ok": true,
  "results": [
    { "name": "STRING", "ok": true, "message": "STRING", "category": "cli|auth|monorepo|version|other" }
  ]
}
```

## logs

Open or tail provider logs for the last deployment.

Usage:

```bash
opd logs <vercel|netlify> \
  [--env <prod|preview>] \
  [--follow] [--since <duration>] \
  [--path <dir>] \
  [--project <id>] [--org <id>] \
  [--limit <n>] [--sha <commit>] \
  [--open] [--json]
```

Notes:

- Vercel: supports project/org hints and sha filtering.
- Netlify: resolves siteId from `--project` or `.netlify/state.json`, builds a dashboard `logsUrl`.
- `--follow` tails logs (best‑effort) and emits NDJSON events in `--ndjson` mode.
- `--since` accepts durations like `1h`, `15m`.
- With `--json` or `--ndjson`, output is machine‑readable.

## env sync
Sync variables from a .env file to provider environments.

Usage (Vercel):
```bash
opd env sync vercel --file <path> --env <prod|preview|development|all> \
  [--yes] [--dry-run] [--json] [--ci] \
  [--project-id <id>] [--org-id <id>] \
  [--ignore <glob,glob>] [--only <glob,glob>] \
  [--fail-on-add] [--fail-on-remove] \
  [--optimize-writes] \
  [--map <file>] \
  [--retries <n>] [--timeout-ms <ms>] [--base-delay-ms <ms>]
```
Usage (Netlify):
```bash
opd env sync netlify --file <path> \
  [--yes] [--dry-run] [--json] [--ci] \
  [--project-id <siteId>] \
  [--ignore <glob,glob>] [--only <glob,glob>] \
  [--retries <n>] [--timeout-ms <ms>] [--base-delay-ms <ms>]
```
Behavior:
- Loads and trims keys from the given file; expands `$VAR`/`${VAR}` from file or process env.
- In `--dry-run`, prints the operations without mutating provider state.
- With `--json`, prints a summary object per key.
- Skips `vercel link` when `--dry-run`. In CI, pass `--project-id` and `--org-id` to link non-interactively.
- Filtering: use `--only` to include patterns and `--ignore` to skip patterns (simple `*` wildcard, e.g. `NEXT_PUBLIC_*`).
- Strict mode: when not in `--dry-run`, the CLI first compares local against remote. If `--fail-on-add` and/or `--fail-on-remove` are set, it sets a non‑zero exit code when local adds new keys or remote has keys missing locally, respectively.
 - Optimize writes: `--optimize-writes` pulls remote values once and skips updates when the value is unchanged (reduces API calls).
 - Mapping: `--map` applies local-only rename and value transforms before syncing.

Mapping file format (JSON):

```json
{
  "rename": { "OLD_KEY": "NEW_KEY" },
  "transform": { "SECRET": "base64", "EMAIL_FROM": "trim" }
}
```

Supported transforms: `base64`, `trim`, `upper`, `lower`.

Examples:

```bash
# Rename and base64 a secret before syncing to Vercel
opd env sync vercel --file .env --env preview \
  --map ./env.map.json --optimize-writes --yes

# Apply same mapping on Netlify
opd env sync netlify --file .env \
  --map ./env.map.json --yes
```

## env pull
Pull provider environment variables into a local .env file.

Usage (Vercel):
```bash
opd env pull vercel --env <prod|preview|development> \
  [--out <path>] [--json] [--ci] [--project-id <id>] [--org-id <id>] \
  [--retries <n>] [--timeout-ms <ms>] [--base-delay-ms <ms>]
```
Usage (Netlify):
```bash
opd env pull netlify \
  [--out <path>] [--json] [--project-id <siteId>] [--context <ctx>] \
  [--retries <n>] [--timeout-ms <ms>] [--base-delay-ms <ms>]
```
Behavior:
- Defaults output file based on env: `.env.production.local`, `.env.preview.local`, or `.env.local`.
- Requires a linked project (`vercel link`). In CI, provide `--project-id` and `--org-id` for non‑interactive linking.

### Examples

- Include only public keys and the DB URL when syncing to preview:

```bash
opd env sync vercel --file .env.local --env preview \
  --only NEXT_PUBLIC_*,DATABASE_URL --yes
```

- Ignore public keys and fail if remote is missing any required secrets (CI guard):

```bash
opd env diff vercel --file .env.production.local --env prod \
  --ignore NEXT_PUBLIC_* --fail-on-remove --json --ci
```

- Fail if local introduces unexpected new keys (e.g., drift):

```bash
opd env diff vercel --file .env.production.local --env prod \
  --fail-on-add --json --ci
```

## env diff
Compare local `.env` values to remote provider environment (no changes made).

Usage (Vercel):
```bash
opd env diff vercel --file <path> --env <prod|preview|development> \
  [--json] [--ci] [--project-id <id>] [--org-id <id>] \
  [--ignore <glob,glob>] [--only <glob,glob>] \
  [--fail-on-add] [--fail-on-remove] \
  [--retries <n>] [--timeout-ms <ms>] [--base-delay-ms <ms>]
```
Usage (Netlify):
```bash
opd env diff netlify --file <path> \
  [--json] [--ci] [--project-id <siteId>] [--context <ctx>] \
  [--ignore <glob,glob>] [--only <glob,glob>] \
  [--fail-on-add] [--fail-on-remove] \
  [--retries <n>] [--timeout-ms <ms>] [--base-delay-ms <ms>]
```

### NDJSON progress events for `up`

When `--ndjson` is active, `up` emits structured progress events in addition to the final summary. Each line is a compact JSON object. Use `--timestamps` to add ISO timestamps.

Stages:

- `envSyncStart` — starting local env sync (fields: `file`)
- `envSyncDone` — finished env sync
- `linking` — linking project to provider (fields: `cwd`, `flags`)
- `deployStart` — provider build/deploy started (fields: `cmd?`)
- `url` — deployment URL discovered (fields: `url`)
- `logsUrl` — logs/inspect URL discovered (fields: `logsUrl`)
- `deployed` — deploy complete (fields: `url`, `logsUrl`)
- `aliasSet` — alias/production domain set (fields: `aliasUrl`)

Example stream (truncated):

```json
{"ok":true,"action":"up","stage":"deployStart","provider":"vercel","target":"preview"}
{"ok":true,"action":"up","stage":"url","provider":"vercel","url":"https://my-app-123.vercel.app"}
{"ok":true,"action":"up","stage":"logsUrl","provider":"vercel","logsUrl":"https://vercel.com/acme/app/inspect/dep_abc"}
{"ok":true,"action":"up","stage":"deployed","provider":"vercel","target":"preview","url":"https://my-app-123.vercel.app","logsUrl":"https://vercel.com/acme/app/inspect/dep_abc"}
```

Retries/Timeouts:

- All provider subprocess calls honor:
  - `--retries <n>` (env: `OPD_RETRIES`, default 2)
  - `--timeout-ms <ms>` (env: `OPD_TIMEOUT_MS`, default 120000)
  - `--base-delay-ms <ms>` (env: `OPD_BASE_DELAY_MS`, default 300)

## generate
Generate provider configuration files based on the detected framework.

Usage:
```bash
opd generate <vercel|netlify> [--overwrite] [--json]
```

Behavior:
- Detects framework using the Detection Engine v2.
- Vercel: writes a minimal `vercel.json` (idempotent). Keeps your customizations when present unless `--overwrite`.
- Netlify: writes a minimal `netlify.toml` (idempotent). For Next.js, uses the official Next Runtime when available, otherwise falls back to `@netlify/plugin-nextjs`. For other frameworks, uses `build` and `publishDir` from detection.

JSON:
```json
{ "provider": "vercel|netlify", "path": "STRING", "final": true }
```

Notes:
- Use `--overwrite` to replace an existing file.

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
- For Netlify, the CLI generates a minimal `netlify.toml` using detection. For Next.js it selects the official Next Runtime when installed or falls back to `@netlify/plugin-nextjs`.

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

### Single‑command deploy (alias: up)

```bash
opd up [vercel|netlify] \
  [--env <prod|preview>] [--project <id>] [--org <id>] [--path <dir>] \
  [--dry-run] [--json] [--ci] [--print-cmd] \
  [--retries <n>] [--timeout-ms <ms>] [--base-delay-ms <ms>] [--ndjson]
```

Behavior:
- Runs env diff/sync from a local file before deploy (prod → `.env.production.local` or `.env`; preview → `.env` or `.env.local`).
- Respects filters and CI flags configured for `env` commands.
- Emits the same deploy JSON/NDJSON summaries as `deploy`.

### up

Single‑command deploy: sync env, then deploy.

```bash
opd up [provider] \
  --env prod \
  --project <ID> \
  --path <dir> \
  --json
```

Notes:
- `up` runs in‑process and delegates to `deploy` with `--sync-env` implied.
- Respects `--path` (monorepo), `--project/--org`, `--env` (`prod` | `preview`).
- Use `--ndjson --timestamps` to stream structured progress events and a final summary with `{ final: true }`.
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

### Logs and Inspect URLs

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

## explain

Show what will happen for a deployment without executing anything.

Usage:
```bash
opd explain <vercel|netlify> \
  [--env <prod|preview>] [--path <dir>] [--project <id>] [--org <id>] \
  [--sync-env] [--ci] [--json]
```
Behavior:
- Prints a provider‑agnostic plan: detection, ensure link, optional env sync, deploy step.
- In `--json`, emits a typed `plan` object suitable for CI previews and approvals.

## open
Open the project dashboard on the provider.

Usage:
```bash
opd open <vercel|netlify> [--project <id>] [--org <id>] [--path <dir>]
```

Notes:
- Vercel: respects monorepo link state just like `deploy`; if `--project/--org` are passed, the CLI will auto-link the chosen cwd before opening.
- Netlify: passes `--site <id>` when `--project` is provided.

## logs
Open or tail provider logs for the last deployment.

Usage:
```bash
opd logs <vercel|netlify> \
  [--env <prod|preview>] \
  [--follow] \
  [--path <dir>] \
  [--project <id>] [--org <id>] \
  [--limit <n>] [--sha <commit>] \
  [--since <duration>] \
  [--json] [--open]
```

Notes:
- Vercel:
  - Auto-discovers the latest deployment via `vercel list` (respects `--env`, `--limit`, `--sha`, `--project`, `--org`).
  - `--follow` tails runtime logs; `--since 15m` or `--since 1h` supported.
  - Human mode shows a spinner while following; NDJSON emits `logs:start`, `vc:log`, `logs:end` events.
- Netlify:
  - Resolves site ID from `--project <siteId>` or `.netlify/state.json` in `--path`/cwd.
  - `--follow` polls deployment status and emits `nl:deploy:status` events until ready; non-follow prints dashboard URL.
  - NDJSON mirrors Vercel with `logs:start`/`logs:end` and provider-specific events; exponential backoff events are emitted as `nl:backoff` with the next sleep duration.

### JSON output (schema)

```json
{
  "provider": "vercel",
  "env": "production|preview|development",
  "ok": true,
  "added": ["STRING"],
  "removed": ["STRING"],
  "changed": [
    { "key": "STRING", "local": "STRING", "remote": "STRING" }
  ]
}
```

Notes:
- In `--ci`, non-zero exit when differences exist. With `--fail-on-add` and/or `--fail-on-remove`, exit is also non-zero specifically when those conditions hold.

## seed
Seed a database using SQL, Prisma, or a package.json script.

Usage:
```bash
opd seed \
  [--db-url <url>] \
  [--file <sql>] \
  [--env <prod|preview|development>] \
  [--schema <sql|prisma|script>] \
  [--script <name>] \
  [--env-file <path>] \
  [--dry-run] [--yes] [--json] [--ci]
```
Behavior:
- `--schema sql`: executes a SQL file (defaults to `prisma/seed.sql` or `seed.sql`).
- `--schema prisma`: runs `prisma db seed` via the detected package manager (supports Bun via `bunx`).
- `--schema script`: runs a package script (e.g., `db:push`) via the detected package manager (supports `bun run`).
- `--env-file` is parsed and passed to the subprocess environment. `DATABASE_URL` is merged when provided.
- `--env prod` requires confirmation unless `--yes` or `--ci`.

## deploy
Deploy via the chosen provider.

Usage:
```bash
opd deploy <vercel|netlify> \
  [--env <prod|preview>] [--project <id>] [--org <id>] [--path <dir>] [--dry-run] [--json] [--ci]
```
Behavior (Vercel):
- Validates auth, detects the app, and deploys.
- If a root `vercel.json` exists and `--path` targets a subdirectory, the CLI deploys from the repository root (for monorepos) to expose workspace lockfiles.
- For monorepos, Vercel Git with Root Directory is recommended; CLI is ideal for env + DB tasks.

### JSON output (schema)

```json
{
  "url": "STRING",
  "projectId": "STRING",
  "logsUrl": "STRING|null",
  "aliasUrl": "STRING|null",
  "provider": "vercel",
  "target": "prod|preview",
  "durationMs": 1234
}
```

## run
Orchestrate env + seed tasks across multiple projects using `opd.config.json`.

Usage:
```bash
opd run \
  [--env <prod|preview>] [--projects <a,b>] [--all] \
  [--concurrency <n>] \
  [--sync-env] [--diff-env] \
  [--project-id <id>] [--org-id <id>] \
  [--ignore <glob,glob>] [--only <glob,glob>] \
  [--fail-on-add] [--fail-on-remove] \
  [--dry-run] [--json] [--ci] [--config <path>]
```
Behavior:
- Selects projects by name or uses all.
- Loads additional env from each project’s configured env file for the chosen environment.
- Optional env management before seeding: `--diff-env` compares local vs remote; `--sync-env` applies updates (respects filters and strict flags).
- Runs seed based on project configuration: `sql`, `prisma`, or `script`.
- Executes projects with a concurrency limit (`--concurrency`, default: 2). Each project still runs env then seed in order.

### Policy and Defaults

You can set organization‑wide defaults for env filtering and strictness in `opd.config.json`:

```json
{
  "policy": {
    "envOnly": ["NEXT_PUBLIC_*", "DATABASE_URL"],
    "envIgnore": ["NEXT_PUBLIC_*"],
    "failOnAdd": true,
    "failOnRemove": true
  },
  "projects": [
    { "name": "web", "path": "apps/web", "provider": "vercel", "envFilePreview": ".env.local" }
  ]
}
```

Minimal config to start fast:

```json
{
  "policy": { "envOnly": ["DATABASE_URL"], "failOnRemove": true },
  "projects": [
    { "name": "app", "path": ".", "provider": "vercel", "envFileProd": ".env.production.local", "envFilePreview": ".env.local" }
  ]
}
```

Precedence (highest → lowest):

- CLI flags (`--only`, `--ignore`, `--fail-on-add`, `--fail-on-remove`)
- Per‑project config (`envOnly`, `envIgnore`, `failOnAdd`, `failOnRemove`)
- Global `policy` defaults
- Empty

Per‑project defaults in `opd.config.json`:

- `envOnly`: array of glob patterns to include (e.g., `["NEXT_PUBLIC_*","DATABASE_URL"]`).
- `envIgnore`: array of glob patterns to exclude (e.g., `["NEXT_PUBLIC_*"]`).
- `failOnAdd`, `failOnRemove`: default strict flags for env checks.
These are used by `run` when CLI flags are not provided.

Config validation:
- On load, the CLI validates `opd.config.json` and throws helpful errors when fields are missing or wrong types (e.g., `projects[0].name must be a non-empty string`).

Global options:
- `--verbose` enables debug logging.
- With `--json`, non-JSON logs are suppressed.

### JSON output (schema)

```json
{
  "ok": true,
  "results": [
    {
      "name": "STRING",
      "env": { "ok": true, "mode": "sync|diff", "error": "STRING|null" },
      "seed": { "ok": true, "mode": "sql|prisma|script", "error": "STRING|null" }
    }
  ]
}
```

## env validate [experimental]

Validate a local `.env` against a schema of required keys. Supports three schema types and composition of multiple schemas via a comma‑separated list.

Usage:
```bash
# keys schema (required keys only)
opd env validate \
  --file .env \
  --schema builtin:better-auth,builtin:email-basic \
  --schema-type keys \
  --json --ci

# rules schema (regex/allowed/oneOf/requireIf)
opd env validate \
  --file .env \
  --schema ./schemas/production.rules.json \
  --schema-type rules \
  --json --ci

# jsonschema (required: ["KEY"]) 
opd env validate \
  --file .env \
  --schema ./schemas/required.json \
  --schema-type jsonschema \
  --json --ci
```

Profiles (composed builtins):
```bash
# Blogkit preset
opd env validate --file .env --schema builtin:blogkit --schema-type keys --json --ci

# Ecommercekit preset
opd env validate --file .env --schema builtin:ecommercekit --schema-type keys --json --ci
```

Example `production.rules.json`:
```json
{
  "required": ["DATABASE_URL", "MAIL_PROVIDER"],
  "regex": { "DATABASE_URL": "^postgres(ql)?:\\/\\/" },
  "allowed": { "MAIL_PROVIDER": ["RESEND", "SMTP"] },
  "oneOf": [["RESEND_API_KEY", "SMTP_PASS"]],
  "requireIf": [
    { "if": "MAIL_PROVIDER=RESEND", "then": ["RESEND_API_KEY", "EMAIL_FROM"] },
    { "if": "MAIL_PROVIDER=SMTP", "then": ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"] }
  ]
}
```

Notes:
- With `--json`, output includes `missing`, `unknown`, and for rules, `violations` and `violationCount`.
- Multiple schemas can be combined: `--schema builtin:better-auth,./schemas/extra.rules.json --schema-type rules`.

Validate a local env file against a minimal required‑keys schema.

Usage:
```bash
opd env validate --file <path> --schema <path> [--json] [--ci]
```

Behavior:
- Reads a JSON schema file with shape: `{ "required": ["KEY1","KEY2",...] }`.
- Reports `missing` keys (required but not present) and `unknown` keys (present but not listed in `required`).
- With `--json`, prints a machine‑readable validation report. With `--ci`, exits non‑zero when required keys are missing.
 - Builtins: you can pass `--schema builtin:<name>`. Available builtins:
   - `next-basic` → `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`
   - `next-prisma` → `DATABASE_URL`, `DIRECT_URL`
   - `next-auth` → `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
   - `drizzle` → `DATABASE_URL`
   - `supabase` → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `stripe` → `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `s3` → `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`
   - `r2` → `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
   - `resend` → `RESEND_API_KEY`
   - `posthog` → `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_HOST`
   - `clerk` → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
   - `upstash-redis` → `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
   - `uploadthing` → `UPLOADTHING_SECRET`, `NEXT_PUBLIC_UPLOADTHING_APP_ID`
   - `google-oauth` → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `github-oauth` → `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
   - `smtp-basic` → `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`
   - `email-basic` → `EMAIL_FROM`
   - `cloudinary` → `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_PUBLIC_BASE_URL`
   - `cloudinary-next` → `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
   - `s3-compat` → `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_PUBLIC_BASE_URL`, `S3_FORCE_PATH_STYLE`
   - `media-worker` → `FFMPEG_PATH`, `MEDIA_PREVIEW_SECONDS`, `MEDIA_WORKER_POLL_MS`, `MEDIA_WORKER_LOOKBACK_MS`
   - `upload-limits` → `MAX_UPLOAD_MB`, `MEDIA_DAILY_LIMIT`
   - `resend-plus` → `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`
   - `better-auth` → `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
   - `paypal` → `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`, `PAYPAL_WEBHOOK_ID`

Example:
```bash
opd env validate --file .env.local --schema builtin:google-oauth --json
```

Composition:
- You can provide multiple schemas separated by commas. Builtins and file paths can be mixed; required keys are merged.

Examples:
```bash
# Combine Google + GitHub OAuth and Resend audience check
opd env validate --file .env.local \
  --schema builtin:google-oauth,builtin:github-oauth,builtin:resend-plus \
  --json --ci

# Mix builtins with a custom JSON file schema
opd env validate --file .env.local \
  --schema builtin:s3-compat,./schemas/required-keys.json \
  --schema-type keys \
  --json
```

### JSON output (schema)

```json
{
  "ok": true,
  "file": "STRING",
  "schemaPath": "STRING",
  "required": ["STRING"],
  "missing": ["STRING"],
  "unknown": ["STRING"],
  "requiredCount": 5,
  "presentCount": 20,
  "missingCount": 1,
  "unknownCount": 2
}
```

## Global Output Flags
## init
Interactive setup to choose provider(s), generate provider config files, and set default env policy.

Usage:
```bash
opendeploy init [--json]
```

Behavior:
- Prompts to select Vercel and/or Netlify.
- Generates `vercel.json`/`netlify.toml` (idempotent) via adapters.
- Writes `opendeploy.config.json` with your env policy (auto‑sync on/off, filters).

Use these flags with any command to tailor output for CI or local use:

- `--quiet` — error-only output (suppresses info/warn/success).
- `--no-emoji` — replace emoji prefixes with ASCII (e.g. `[info]`).
- `--json` — JSON-only output (suppresses non-JSON logs).
- `--compact-json` — one-line JSON (good for log pipelines).
- `--ndjson` — newline-delimited JSON streaming (implies `--json`).
- `--timestamps` — add ISO timestamps to human logs and JSON objects.
- `--summary-only` — suppress intermediate JSON and print only final summary objects (`{ final: true }`).

# Commands

## completion
Generate shell completion scripts for bash, zsh, or PowerShell.

Usage:
```bash
opendeploy completion --shell <bash|zsh|pwsh>
```

Install (user-local examples):

- Bash (Linux/macOS):
```bash
# macOS (Homebrew bash-completion):
opendeploy completion --shell bash > $(brew --prefix)/etc/bash_completion.d/opendeploy
# Generic (user):
opendeploy completion --shell bash > ~/.opendeploy-completion.bash
echo 'source ~/.opendeploy-completion.bash' >> ~/.bashrc
```

- Zsh:
```bash
opendeploy completion --shell zsh > ~/.opendeploy-completion.zsh
echo 'fpath=(~/.zfunc $fpath)' >> ~/.zshrc
mkdir -p ~/.zfunc
mv ~/.opendeploy-completion.zsh ~/.zfunc/_opendeploy
echo 'autoload -U compinit && compinit' >> ~/.zshrc
```

- PowerShell (Windows/macOS/Linux):
```powershell
opendeploy completion --shell pwsh | Out-File -FilePath $PROFILE -Append -Encoding utf8
# Restart PowerShell
```

## detect
Detect a Next.js app and its configuration.

Usage:
```bash
opendeploy detect [--json]
```
Output fields:
- framework, rootDir, appDir, hasAppRouter
- packageManager (pnpm | yarn | npm | bun)
- monorepo (turborepo | nx | workspaces | none)
- buildCommand, outputDir, environmentFiles

Notes:
- With `--json`, only JSON is printed.

### JSON output (schema)

```json
{
  "framework": "nextjs",
  "rootDir": "STRING",
  "appDir": "STRING|null",
  "hasAppRouter": true,
  "packageManager": "pnpm|yarn|npm|bun",
  "monorepo": "turborepo|nx|workspaces|none",
  "buildCommand": "STRING|null",
  "outputDir": "STRING|null",
  "environmentFiles": ["STRING"]
}
```

Example:
```json
{
  "ok": false,
  "results": [
    { "name": "node-version", "ok": true, "message": "Node 20.12.2", "category": "version" },
    { "name": "vercel-cli", "ok": true, "message": "vercel 39.1.0", "category": "cli" },
    { "name": "auth", "ok": false, "message": "Not logged in to Vercel", "category": "auth" }
  ]
}
```

## doctor
Validate local environment and provider CLIs.

Usage:
```bash
opendeploy doctor [--ci] [--json] [--verbose]
```
Checks:
- Node version
- pnpm, bun, vercel, netlify CLIs
- Auth for Vercel/Netlify
- Monorepo sanity (workspace lockfile, `.vercel/project.json`, optional root `vercel.json`)
- Monorepo linked apps scan (`apps/*`) and chosen deploy cwd advisories for common paths (e.g., `apps/web`).

Notes:
- With `--json`, only JSON is printed. `--ci` exits non‑zero if any check fails.

### JSON output (schema)

```json
{
  "ok": true,
  "results": [
    { "name": "STRING", "ok": true, "message": "STRING", "category": "cli|auth|monorepo|version|other" }
  ]
}
```

## env sync
Sync variables from a .env file to provider environments.

Usage (Vercel):
```bash
opendeploy env sync vercel --file <path> --env <prod|preview|development|all> \
  [--yes] [--dry-run] [--json] [--ci] \
  [--project-id <id>] [--org-id <id>] \
  [--ignore <glob,glob>] [--only <glob,glob>] \
  [--fail-on-add] [--fail-on-remove] \
  [--optimize-writes]
  [--map <file>]
```
Usage (Netlify):
```bash
opendeploy env sync netlify --file <path> \
  [--yes] [--dry-run] [--json] [--ci] \
  [--project-id <siteId>] \
  [--ignore <glob,glob>] [--only <glob,glob>]
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
opendeploy env sync vercel --file .env --env preview \
  --map ./env.map.json --optimize-writes --yes

# Apply same mapping on Netlify
opendeploy env sync netlify --file .env \
  --map ./env.map.json --yes
```

## env pull
Pull provider environment variables into a local .env file.

Usage (Vercel):
```bash
opendeploy env pull vercel --env <prod|preview|development> [--out <path>] [--json] [--ci] [--project-id <id>] [--org-id <id>]
```
Usage (Netlify):
```bash
opendeploy env pull netlify [--out <path>] [--json] [--project-id <siteId>] [--context <ctx>]
```
Behavior:
- Defaults output file based on env: `.env.production.local`, `.env.preview.local`, or `.env.local`.
- Requires a linked project (`vercel link`). In CI, provide `--project-id` and `--org-id` for non‑interactive linking.

### Examples

- Include only public keys and the DB URL when syncing to preview:

```bash
opendeploy env sync vercel --file .env.local --env preview \
  --only NEXT_PUBLIC_*,DATABASE_URL --yes
```

- Ignore public keys and fail if remote is missing any required secrets (CI guard):

```bash
opendeploy env diff vercel --file .env.production.local --env prod \
  --ignore NEXT_PUBLIC_* --fail-on-remove --json --ci
```

- Fail if local introduces unexpected new keys (e.g., drift):

```bash
opendeploy env diff vercel --file .env.production.local --env prod \
  --fail-on-add --json --ci
```

## env diff
Compare local `.env` values to remote provider environment (no changes made).

Usage (Vercel):
```bash
opendeploy env diff vercel --file <path> --env <prod|preview|development> \
  [--json] [--ci] [--project-id <id>] [--org-id <id>] \
  [--ignore <glob,glob>] [--only <glob,glob>] \
  [--fail-on-add] [--fail-on-remove]
```
Usage (Netlify):
```bash
opendeploy env diff netlify --file <path> \
  [--json] [--ci] [--project-id <siteId>] [--context <ctx>] \
  [--ignore <glob,glob>] [--only <glob,glob>] \
  [--fail-on-add] [--fail-on-remove]
```

## deploy
Deploy the detected app to a provider.

Usage:
```bash
opendeploy deploy <vercel|netlify> \
  [--env <prod|preview>] [--project <id>] [--org <id>] [--path <dir>] \
  [--dry-run] [--json] [--ci] [--sync-env] [--alias <domain>]
```

Notes:
- In monorepos, the CLI prefers the linked app directory (e.g., `apps/web/.vercel/project.json`). If only the root is linked, it deploys from the root. Otherwise it deploys from the target path.
- For Netlify, the CLI generates a minimal `netlify.toml` using `@netlify/plugin-nextjs` if missing.

### Single‑command deploy (alias: up)

```bash
opendeploy up <vercel|netlify> [--env <prod|preview>] [--project <id>] [--org <id>] [--path <dir>] [--json] [--ci]
```

Behavior:
- Runs env diff/sync from a local file before deploy (prod → `.env.production.local` or `.env`; preview → `.env` or `.env.local`).
- Respects filters and CI flags configured for `env` commands.
- Emits the same deploy JSON/NDJSON summaries as `deploy`.

### up

Single‑command deploy: sync env, then deploy.

```bash
opendeploy up <provider> \
  --env prod \
  --project <ID> \
  --path <dir> \
  --json
```

Notes:
- `up` runs in‑process and delegates to `deploy` with `--sync-env` implied.
- Respects `--path` (monorepo), `--project/--org`, `--env` (`prod` | `preview`).
- Use `--ndjson --timestamps` to stream logs and emit final summary with `{ final: true }`.

## open
Open the project dashboard on the provider.

Usage:
```bash
opendeploy open <vercel|netlify> [--project <id>] [--org <id>] [--path <dir>]
```

Notes:
- Vercel: respects monorepo link state just like `deploy`; if `--project/--org` are passed, the CLI will auto-link the chosen cwd before opening.
- Netlify: passes `--site <id>` when `--project` is provided.

## logs
Open or tail provider logs for the last deployment.

Usage:
```bash
opendeploy logs <vercel|netlify> \
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
  - NDJSON mirrors Vercel with `logs:start`/`logs:end` and provider-specific events.

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
opendeploy seed \
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
opendeploy deploy <vercel|netlify> \
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
Orchestrate env + seed tasks across multiple projects using `opendeploy.config.json`.

Usage:
```bash
opendeploy run \
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

You can set organization‑wide defaults for env filtering and strictness in `opendeploy.config.json`:

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

Per‑project defaults in `opendeploy.config.json`:

- `envOnly`: array of glob patterns to include (e.g., `["NEXT_PUBLIC_*","DATABASE_URL"]`).
- `envIgnore`: array of glob patterns to exclude (e.g., `["NEXT_PUBLIC_*"]`).
- `failOnAdd`, `failOnRemove`: default strict flags for env checks.
These are used by `run` when CLI flags are not provided.

Config validation:
- On load, the CLI validates `opendeploy.config.json` and throws helpful errors when fields are missing or wrong types (e.g., `projects[0].name must be a non-empty string`).

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
opendeploy env validate \
  --file .env \
  --schema builtin:better-auth,builtin:email-basic \
  --schema-type keys \
  --json --ci

# rules schema (regex/allowed/oneOf/requireIf)
opendeploy env validate \
  --file .env \
  --schema ./schemas/production.rules.json \
  --schema-type rules \
  --json --ci

# jsonschema (required: ["KEY"]) 
opendeploy env validate \
  --file .env \
  --schema ./schemas/required.json \
  --schema-type jsonschema \
  --json --ci
```

Profiles (composed builtins):
```bash
# Blogkit preset
opendeploy env validate --file .env --schema builtin:blogkit --schema-type keys --json --ci

# Ecommercekit preset
opendeploy env validate --file .env --schema builtin:ecommercekit --schema-type keys --json --ci
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
opendeploy env validate --file <path> --schema <path> [--json] [--ci]
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
opendeploy env validate --file .env.local --schema builtin:google-oauth --json
```

Composition:
- You can provide multiple schemas separated by commas. Builtins and file paths can be mixed; required keys are merged.

Examples:
```bash
# Combine Google + GitHub OAuth and Resend audience check
opendeploy env validate --file .env.local \
  --schema builtin:google-oauth,builtin:github-oauth,builtin:resend-plus \
  --json --ci

# Mix builtins with a custom JSON file schema
opendeploy env validate --file .env.local \
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

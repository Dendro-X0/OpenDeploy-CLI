# Environment Commands

## env sync
Sync variables from a .env file to provider environments.

Usage (Vercel):
```bash
opd env sync vercel --file <path> --env <prod|preview|development|all> \
  [--yes] [--dry-run] [--json] [--ci] \
  [--project-id <id>] [--org-id <id>] \
  [--ignore <glob,glob>] [--only <glob,glob>] \
  [--fail-on-add] [--fail-on-remove] \
  [--optimize-writes]
  [--map <file>]
```
Usage (Netlify):
```bash
opd env sync netlify --file <path> \
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
opd env pull vercel --env <prod|preview|development> [--out <path>] [--json] [--ci] [--project-id <id>] [--org-id <id>]
```
Usage (Netlify):
```bash
opd env pull netlify [--out <path>] [--json] [--project-id <siteId>] [--context <ctx>]
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
  [--fail-on-add] [--fail-on-remove]
```
Usage (Netlify):
```bash
opd env diff netlify --file <path> \
  [--json] [--ci] [--project-id <siteId>] [--context <ctx>] \
  [--ignore <glob,glob>] [--only <glob,glob>] \
  [--fail-on-add] [--fail-on-remove]
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

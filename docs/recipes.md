# Recipes

## Wizard (start) — Quick Examples

Use the guided wizard to prepare or deploy with consistent JSON/NDJSON outputs.

```bash
# Vercel: preview deploy and alias
opd start --provider vercel --env preview \
  --alias preview.example.com --json

# Vercel: NDJSON progress (human suppressed)
OPD_NDJSON=1 opd start --provider vercel --env preview --ci

# Monorepo: choose app directory for deploy
opd start --provider vercel --path apps/web --env preview --json
```

## Remix family deploys (React Router v7)

This recipe shows how to deploy a React Router v7 app (Remix family) to Vercel using OpenDeploy.

Prerequisites:
- Scripts include `react-router build`.
- Output is `build/client` (static) and `build/server` (server build) after building.

Steps:
1. Detect and generate config (idempotent):
   - `opd detect`
   - `opd generate vercel` (writes `vercel.json` with `outputDirectory: build/client`)
   - (Optional) Cloudflare Pages/GitHub Pages: use their respective workflows.

2. Vercel prepare or deploy via wizard.

3. Vercel deploy:
   - Preview: `opd up vercel --env preview`
   - Production: `opd up vercel --env prod`

Notes:
- For SPA routing on Netlify add:
  ```toml
  [[redirects]]
    from = "/*"
    to = "/index.html"
    status = 200
  ```
- SSR requires a provider-specific adapter; static is supported out of the box.


## Single-command Deploy (Up)

Use `opd up` to sync env from a local file and deploy in one step.

### Vercel (Preview)

```bash
opd up vercel \
  --env preview \
  --ndjson --timestamps --ndjson-file
```

<!-- Netlify removed -->

Notes:

- Env file selection: prod → `.env.production.local` or `.env`; preview → `.env` or `.env.local`.
- Respects filtering/strict flags configured for `env` commands when invoked underneath `up`.
- Use `--json-file`/`--ndjson-file` without a path to write to default `./.artifacts/*` files.

<!-- Netlify removed -->

### GitHub Actions Preset (`--gha`)

Use the `--gha` preset to simplify CI configuration: it implies `--json --summary-only --timestamps`, sets default sinks under `./.artifacts/`, and enables annotations.

```yaml
name: Preview (Vercel)

on:
  push:
    branches: [main]

jobs:
  up:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: corepack enable && corepack prepare pnpm@10.13.1 --activate
      - run: pnpm install --frozen-lockfile
      - name: Build OpenDeploy
        run: pnpm --filter "OpenDeploy CLI" -C "OpenDeploy CLI" build
      - name: Up (preview)
        run: |
          opd --gha up vercel --env preview
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: opd-artifacts
          path: ./.artifacts
          if-no-files-found: ignore
```

## Env Diff on CI

Use this job to fail the pipeline when production env differs from the committed file. It links non‑interactively with project/org IDs.

```yaml
name: Env Diff (CI)

on:
  push:
    branches: [main]

jobs:
  env-diff:
    runs-on: ubuntu-latest
    env:
      VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
      VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: corepack enable && corepack prepare pnpm@10.13.1 --activate
      - run: pnpm install --frozen-lockfile
      - name: Env Diff
        run: |
          opd env diff vercel \
            --file ./apps/web/.env.production.local \
            --env prod \
            --project-id "$VERCEL_PROJECT_ID" --org-id "$VERCEL_ORG_ID" \
            --ignore NEXT_PUBLIC_* --fail-on-add --fail-on-remove --json --ci
```

            --json
```

<!-- Netlify publishDir troubleshooting removed -->

- Next.js
  - Publish: `.next`

- Astro (static)
  - Build: `astro build`
  - Publish: `dist`

- SvelteKit
  - Static: use `@sveltejs/adapter-static` → Publish: `build`
  - Netlify adapter (`@sveltejs/adapter-netlify`) produces server functions (not static). For prepare-only flow, stick to static output; for SSR, deploy via Netlify CI.

- Remix (React Router v7 family)
  - Build: `react-router build`
  - Publish: `build/client`
  - SPA routing (static): add a SPA fallback per provider (e.g., Vercel rewrites, Cloudflare Pages routing config).

- Nuxt
  - Build: `npx nuxi build`
  - Publish: `.output/public`

General tips
- Inspect wizard JSON: `publishDirExists` and `publishDirFileCount` fields indicate directory status.
<!-- Netlify removed -->

## CI Output & Annotations

Use sinks to persist structured output and enable GitHub annotations for quick feedback in PRs.

```yaml
name: OpenDeploy (CI)

on: [push]

jobs:
  opd:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: corepack enable && corepack prepare pnpm@10.13.1 --activate
      - run: pnpm install --frozen-lockfile
      - run: mkdir -p ./.artifacts

      # Doctor emits ::warning annotations for failed checks
      - name: Doctor (annotate)
        run: |
          opd doctor --ci

      # Also persist JSON summary to artifact
      - name: Doctor (JSON sink)
        run: |
          opd doctor \
            --json --summary-only \
            --json-file ./.artifacts/doctor.json

      # Env Diff emits ::error for policy violations when --ci or strict flags are set
      - name: Env Diff (annotate)
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
        run: |
          opd env diff vercel \
            --file ./apps/web/.env.production.local \
            --env prod \
            --project-id "$VERCEL_PROJECT_ID" --org-id "$VERCEL_ORG_ID" \
            --ignore NEXT_PUBLIC_* --fail-on-add --fail-on-remove --ci

      # Persist a compact JSON summary for logs/indexing
      - name: Env Diff (JSON sink)
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
        run: |
          opd env diff vercel \
            --file ./apps/web/.env.production.local \
            --env prod \
            --project-id "$VERCEL_PROJECT_ID" --org-id "$VERCEL_ORG_ID" \
            --ignore NEXT_PUBLIC_* --fail-on-add --fail-on-remove \
            --json --summary-only \
            --json-file ./.artifacts/env-diff.json

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: opd-artifacts
          path: ./.artifacts
          if-no-files-found: ignore
```

Notes:

- `--ndjson-file` streams line-delimited JSON events; `--json-file` appends compact or pretty JSON lines (depending on mode).
- In CI, doctor prints ::warning annotations for failed checks; env diff prints ::error for policy failures (when `--ci`, `--fail-on-add`, or `--fail-on-remove`), and ::warning otherwise.
- `--summary-only` reduces JSON output to a single final object with `final: true`.

## Validate Multiple Providers (CI)

Use schema composition to validate multiple provider key groups in a single step. This example runs in CI and fails on missing keys.

```yaml
name: Env Validate (CI)

on:
  pull_request:
    branches: [main]

jobs:
  env-validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: corepack enable && corepack prepare pnpm@10.13.1 --activate
      - run: pnpm install --frozen-lockfile
      - name: Validate Env
        run: |
          opd env validate \
            --file ./apps/web/.env.local \
            --schema builtin:google-oauth,builtin:github-oauth,builtin:resend-plus,builtin:s3-compat \
            --json --ci
```

## Sync then Seed

Sync preview env (public + DB only) and then run a Drizzle push. Works well in multi-package repositories.

```bash
# From workspace root
# 1) Sync env for apps/web
opd env sync vercel \
  --file ./apps/web/.env.local \
  --env preview \
  --only NEXT_PUBLIC_*,DATABASE_URL \
  --project-id "$VERCEL_PROJECT_ID" --org-id "$VERCEL_ORG_ID" \
  --yes

# 2) Seed/push from packages/db
cd packages/db
opd seed --schema script --script db:push --env preview
```

## Monorepo Env Strategy

Recommended layout for a Next.js app at `apps/web/` and DB in `packages/db/`.

```text
repo/
├─ apps/
│  └─ web/
│     ├─ .env.local                # Local dev
│     ├─ .env.preview.local        # Pulled from Vercel preview
│     └─ .env.production.local     # Pulled from Vercel prod
└─ packages/
   └─ db/
      └─ (drizzle or prisma setup)
```

- __Pull env from Vercel__ (non‑interactive link):

```bash
cd apps/web
opd env pull vercel --env preview \
  --project-id "$VERCEL_PROJECT_ID" --org-id "$VERCEL_ORG_ID"
```

- __Diff env before merging to main__:

```bash
opd env diff vercel \
  --file ./.env.production.local --env prod \
  --ignore NEXT_PUBLIC_* --fail-on-remove --json --ci
```

- __Sync a subset__ (public and DB only):

```bash
opd env sync vercel \
  --file ./.env.local --env preview \
  --only NEXT_PUBLIC_*,DATABASE_URL --yes
```

## Concurrency (Monorepo)

Run env + seed across multiple projects with a higher concurrency (e.g., 3). Each project still runs env then seed in order.

```bash
# From repo root with opd.config.json
opd run \
  --all \
  --env preview \
  --sync-env \
  --concurrency 3 \
  --json
```

## Monorepo Matrix CI

Run per-app jobs in parallel with a matrix, using `opd run` for env sync/diff and seeding. Configure `policy` in `opd.config.json` to set org-wide defaults.

```yaml
name: Monorepo Matrix (Env + Seed)

on:
  push:
    branches: [main]

jobs:
  run:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        project: [web, admin, api]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: corepack enable && corepack prepare pnpm@10.13.1 --activate
      - run: pnpm install --frozen-lockfile
      - name: Env Diff + Seed
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
        run: |
          opd run \
            --projects "${{ matrix.project }}" \
            --env preview \
            --diff-env --sync-env \
            --project-id "$VERCEL_PROJECT_ID" --org-id "$VERCEL_ORG_ID" \
            --json

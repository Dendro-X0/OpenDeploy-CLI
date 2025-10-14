# Workflow Generation (Reusable)

OpenDeploy can scaffold per-app caller workflows that delegate to reusable workflows for GitHub Pages and Cloudflare Pages. This is ideal for monorepos with multiple apps under `apps/*`.

## Why reusable workflows?

- Reuse the same audited workflow logic across apps.
- Keep per-app callers minimal (only inputs change).
- Easier CI maintenance and consistent deployment behavior.

## GitHub Pages (Next.js static export and other SSGs)

Generate a per-app workflow that uses `_reusable-gh-pages.yml`:

```bash
opd generate github --reusable
# writes .github/workflows/deploy-app-gh-pages.yml
```

Example caller (`.github/workflows/deploy-app-gh-pages.yml`):

```yaml
name: Deploy (GitHub Pages)

on:
  push:
    branches: [main]
    paths:
      - 'apps/docs/**'
      - '.github/workflows/deploy-app-gh-pages.yml'

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    uses: ./.github/workflows/_reusable-gh-pages.yml
    with:
      app_path: apps/docs
```

Inputs used by the caller:

- `app_path`: relative path to the app (auto-detected if omitted).

The reusable workflow performs:

- Checkout
- Setup Node 20 + pnpm cache
- Corepack/pnpm activation
- Install dependencies
- Build (Next static export with `DEPLOY_TARGET=github`)
- Upload `out/` as Pages artifact
- Deploy to GitHub Pages

## Cloudflare Pages (Next on Pages)

Generate a per-app workflow that uses `_reusable-cloudflare-pages.yml`:

```bash
opd generate cloudflare --reusable --project-name <pages-project>
# writes .github/workflows/deploy-app-cloudflare.yml
```

Example caller (`.github/workflows/deploy-app-cloudflare.yml`):

```yaml
name: Deploy (Cloudflare Pages)

on:
  push:
    branches: [main]
    paths:
      - 'apps/web/**'
      - '.github/workflows/deploy-app-cloudflare.yml'

permissions:
  contents: read

jobs:
  deploy:
    uses: ./.github/workflows/_reusable-cloudflare-pages.yml
    with:
      app_path: apps/web
      project_name: my-pages-project
    secrets: inherit
```

Inputs used by the caller:

- `app_path`: relative path to the app (auto-detected if omitted)
- `project_name`: Cloudflare Pages project name

Highlights of the reusable workflow:

- Checkout
- Setup Node 20 + pnpm cache
- Corepack/pnpm activation
- Approve native builds (esbuild/sharp/etc.)
- Install dependencies
- Build with `@cloudflare/next-on-pages`
- Deploy with `cloudflare/wrangler-action@v3` (forced `packageManager: npm` for reliability)

Notes:

- Ensure repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are configured to enable deploy.
- If secrets are missing, the job will build and skip deploy with guidance.

## Monorepo auto-detection

If you omit an explicit app path, OpenDeploy auto-detects the most likely app path (e.g., under `apps/*`) and wires it into the generated caller workflow.

## Troubleshooting

- GitHub Pages (Next.js): ensure `output: 'export'`, `images.unoptimized: true`, `trailingSlash: true`, `.nojekyll` exists in `out/`, and correct `basePath`/`assetPrefix` for project pages. The CLI surfaces hints during build and doctor.
- Cloudflare Pages (Next on Pages): the CLI attempts to emit an Inspect/Dashboard link after deploy. On Windows, prefer Linux-based CI runners for Next on Pages builds.

See also:

- `opd ci summarize` for a compact digest of failing jobs and error excerpts
- Quickstarts: GitHub Pages and Cloudflare Pages

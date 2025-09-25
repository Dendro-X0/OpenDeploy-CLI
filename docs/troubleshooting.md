# Troubleshooting (Netlify & Vercel)

This page summarizes common provider errors detected by OpenDeploy and actionable remedies. When an operation fails, OpenDeploy maps raw errors to stable codes and prints human‑friendly guidance. In JSON/NDJSON modes, these appear in the output as `code`, `message`, and optional `remedy` fields.

See implementation: `src/utils/errors.ts`

## Netlify

- NETLIFY_RUNTIME_MISSING
  - Cause: Netlify Next Runtime missing (manifest.yml not found).
  - Remedy: Install `@netlify/next` or switch to `@netlify/plugin-nextjs`. OpenDeploy auto‑falls back to the legacy plugin if needed.

- NETLIFY_ACCOUNT_ID_MISSING
  - Cause: CLI cannot resolve account/site when running env operations.
  - Remedy: Pass `--project-id <siteId>` (maps to `--site`), or link the directory: `netlify link --id <siteId>`.

- NETLIFY_SITE_NOT_FOUND
  - Cause: Site not found or directory is not linked.
  - Remedy: `netlify link --id <siteId>` or pass `--project-id <siteId>`.

- NETLIFY_BUILD_COMMAND_FAILED
  - Cause: `build.command` failed during Netlify build.
  - Remedy: Use a minimal `build.command` (e.g., `next build`). Avoid DB migration in build. OpenDeploy generates a safe `netlify.toml`.

- NETLIFY_FUNCTION_CRASH
  - Cause: A Netlify serverless/edge function crashed.
  - Remedy: Check function logs. Verify runtime env (AUTH/NEXTAUTH, EMAIL/SMTP/RESEND, etc.).

- NETLIFY_RATE_LIMIT
  - Cause: API rate limit.
  - Remedy: Retry with backoff. Reduce high‑frequency polling. Prefer CI artifacts for logs/state.

- NETLIFY_AUTH_TOKEN_MISSING
  - Cause: Authentication token missing/invalid.
  - Remedy: Set `NETLIFY_AUTH_TOKEN` or run `netlify login`.

- NETLIFY_PLUGIN_NOT_FOUND
  - Cause: `@netlify/plugin-nextjs` could not be resolved by build.
  - Remedy: Ensure plugin name is correct in `netlify.toml`. Core plugins are installed by Netlify in their build environment.

- NETLIFY_INVALID_SITE_ID
  - Cause: Provided Site ID is invalid.
  - Remedy: Verify site ID and pass via `--project-id` or link: `netlify link --id <siteId>`.

## Vercel

OpenDeploy maps common Vercel CLI issues to human guidance:

- VERCEL_AUTH_REQUIRED
  - Cause: Not logged in to Vercel.
  - Remedy: `vercel login`

- VERCEL_AUTH_EXPIRED
  - Cause: Authentication expired or unauthorized (401).
  - Remedy: `vercel login` (or set `VERCEL_TOKEN` in CI).

- VERCEL_NOT_LINKED
  - Cause: Directory not linked to a project.
  - Remedy: `vercel link` (or pass `--project/--org` in CI).

- VERCEL_INVALID_PROJECT_OR_TEAM
  - Cause: Invalid/unknown Vercel project/org/team.
  - Remedy: Verify `VERCEL_PROJECT_ID` / `VERCEL_ORG_ID` or use `--project/--org`; alternatively run `vercel link`.

- VERCEL_BUILD_FAILED
  - Cause: Build failed during Vercel deployment.
  - Remedy: Inspect logs: `opd deploy logs vercel --follow`; run `next build` locally; check env with `opd env diff` and `opd env validate`.

- NODE_MODULE_NOT_FOUND
  - Cause: Module resolution failed in build.
  - Remedy: Reinstall deps; ensure Node 18/20. (`pnpm install`)

- NEXT_LINT_OR_TYPES_FAILED
  - Cause: ESLint or TypeScript errors failed the build.
  - Remedy: Fix lint/type errors; consider disabling lint in production builds if desired.

- ENV_MISSING
  - Cause: A required environment variable appears to be missing.
  - Remedy: Use `opd env diff` to compare local vs remote; then `opd env sync` to apply.

- PERMISSION_DENIED
  - Cause: Permission denied during an operation.
  - Remedy: Check file permissions and provider access.

- NETWORK_ERROR
  - Cause: Temporary network failure.
  - Remedy: Retry. Check connectivity or provider status.

## Notes

- Human mode prints concise messages with `Try:` suggestions.
- JSON/NDJSON include `code`, `message`, `remedy`, and original `error` text when available.
- GitHub Actions annotations are emitted for doctor and env diff when running in CI.
 - Run `opd doctor --json` to see suggested commands based on linked state and monorepo cwd detection.

## Netlify publishDir issues

If a Netlify deploy fails due to a missing or empty publish directory, check:

- Inspect wizard JSON fields (from `opd start --provider netlify --json` or `opd start` in installed CLI):
  - `publishDir`: directory the wizard inferred
  - `publishDirExists`: whether the directory exists
  - `publishDirFileCount`: how many files were found
- Framework guidance:
  - Next.js: prefer `@netlify/next` runtime (publish `.next`), else legacy `@netlify/plugin-nextjs`.
  - Astro: `astro build` → publish `dist`.
  - SvelteKit: static via `@sveltejs/adapter-static` → publish `build`.
  - Remix (RR v7): `react-router build` → publish `build/client`.
  - Nuxt: `npx nuxi build` → publish `.output/public`.
- Commands:
  - Generate config only: `opd start --provider netlify --generate-config-only`
  - Print recommended commands: `opd start --provider netlify --print-cmd`
  - Prebuild and deploy artifacts: `pnpm build && opd start --provider netlify --deploy --no-build --project <SITE_ID>`

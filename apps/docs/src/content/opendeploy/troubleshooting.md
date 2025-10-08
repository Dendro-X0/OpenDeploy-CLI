# Troubleshooting (Vercel)

This page summarizes common provider errors detected by OpenDeploy and actionable remedies. When an operation fails, OpenDeploy maps raw errors to stable codes and prints human‑friendly guidance. In JSON/NDJSON modes, these appear in the output as `code`, `message`, and optional `remedy` fields.

See implementation: `src/utils/errors.ts`

> Note: Netlify is not supported by OpenDeploy. Please use the official Netlify CLI.

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

<!-- Netlify section removed -->

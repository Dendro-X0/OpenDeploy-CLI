# Configuration

This page describes how to configure OpenDeploy across frameworks and providers.

## Global settings
- CLI flags (common): `--json`, `--ndjson-out`, `--strict`, `--ci`
- Environment variables (examples):
  - `OPD_FORCE_CI=1` — enforce CI-friendly output
  - `OPD_PROVIDER_MODE=virtual|real` — local testing vs. real deploys

## Framework-specific
- Next.js: `next.config.js` (`output: "export"` for static export)
- Astro, SvelteKit, Remix, Nuxt: ensure build output dir aligns with provider expectations.

## Provider-specific
- Vercel: `VERCEL_TOKEN` (Nightly/Release CI), project configuration via CLI or dashboard
- Cloudflare Pages: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- GitHub Pages: `.nojekyll`, static export location

## CI
- Use `ci-run pr` locally for parity and concise artifacts in `./.artifacts/`.
- Use `ci-diff` to compare repo workflows to synthesized output.

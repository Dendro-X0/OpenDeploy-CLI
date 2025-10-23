# Deployment

This page outlines typical deployment flows per provider and how to validate results.

## Vercel (virtual on PR, real on Nightly)
- Local PR parity:
```bash
node packages/cli/dist/index.js ci-run pr --json
```
- Real deploy (Nightly) requires `VERCEL_TOKEN` in CI.

## Cloudflare Pages
- Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for real deploys.
- Wizard guides you through build output mapping.

## GitHub Pages
- Static export (`output: "export"` for Next.js). Ensure `.nojekyll` exists.

## Validating
- CLI JSON summary includes `url` and `logsUrl` when available.
- Review provider dashboard links and `./.artifacts/*.json` for details.

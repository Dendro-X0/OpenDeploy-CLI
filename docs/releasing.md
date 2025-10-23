# Releasing OpenDeploy CLI

Use this checklist to ship confidently with stable CI.

## Pre‑release checklist

- Build and tests green across OS matrix.
- CI drift OK (similarity ≥ 0.9):
  - `node packages/cli/dist/index.js ci-generate --profile pr --out ./.artifacts/ci-pr.generated.yml`
  - `node packages/cli/dist/index.js ci-diff --profile pr --json --open-artifacts`
- Security gates:
  - `node packages/cli/dist/index.js ci-run security-scan --json` (doctor.strict.json, scan.strict.json)
  - gitleaks workflow green
- Artifacts verified:
  - `./.artifacts/ci-run.last.json`
  - `./.artifacts/vitest.json`
  - `./.artifacts/doctor.strict.json`, `./.artifacts/scan.strict.json`
  - `./.artifacts/detect-*.json`, `./.artifacts/doctor-*.json`

## Tag and release

- Create a version tag `vX.Y.Z`.
- Push the tag to GitHub.
- The release workflow will:
  - Build CLI and run tests/security.
  - (If secrets set) run real provider-smoke and attach artifacts.
  - Create a GitHub Release with generated notes and attach artifacts.

## Provider secrets (for Nightly/Release real smoke)

- Vercel: `VERCEL_TOKEN`
- Cloudflare: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- GitHub: `GITHUB_TOKEN` (default is available in Actions runtime)

## Troubleshooting

- Compare local vs CI artifacts.
- If workflows differ, use `ci-diff` and update YAML.
- On Windows, avoid pipes; use `start --ndjson-out`.

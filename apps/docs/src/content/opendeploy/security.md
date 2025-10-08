# Security

OpenDeploy CLI is permanently open source and free. It is designed to be safe by default in both local and CI environments.

## Secrets and Redaction

- Secrets are never printed. The CLI redacts sensitive values in:
  - Human logs (stdout/stderr)
  - JSON summaries
  - NDJSON event streams
  - File sinks written with `--json-file` / `--ndjson-file`
- Redaction covers common patterns (API keys, tokens, URLs with credentials) and all variables that are not explicitly intended to be public.
- Public variables should be prefixed with `NEXT_PUBLIC_` (or your framework’s public prefix). Everything else is treated as sensitive.

## Safer Output in CI

- Use `--summary-only` to omit intermediate JSON and print only final objects that include `{ "final": true }`.
- Prefer `--json --timestamps` (or `--gha`) for predictable, minimally verbose output in CI.
- Persist outputs safely with `--json-file` and `--ndjson-file` if you need artifacts. Redaction still applies.

## Telemetry

- Telemetry is disabled by default. There is no background network traffic beyond provider CLIs you invoke (e.g., Vercel, Cloudflare, GitHub).

## Provider Auth

- You remain logged in with each provider’s official CLI (e.g., `vercel login`, `wrangler login`, or GitHub auth). OpenDeploy does not store your provider credentials.
- In CI, use the provider’s supported tokens/secrets mechanism.

## Recommended Practices

- Keep private env keys out of the repo and `.env*` files encrypted or excluded from VCS.
- Validate and reconcile env with `opd env diff` and `opd env validate` in CI.
- Use `--fail-on-add` and `--fail-on-remove` to prevent drift on critical environments.
- Prefer least-privilege provider tokens for CI.

## For Contributors

- Redaction logic lives in the logger utilities. Changes to logging/output must preserve redaction and avoid printing sensitive values by default.
- New commands and provider flows should include JSON schemas that avoid echoing raw secrets in their summaries.

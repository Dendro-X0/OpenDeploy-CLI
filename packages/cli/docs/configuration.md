# Configuration

This page documents runtime configuration that affects the CLI behavior. The defaults are safe and require no configuration, but you can opt in to advanced behavior.

## Secret redaction

OpenDeploy redacts secrets from all logs by default:

- Human logs (stdout/stderr)
- JSON and NDJSON console output
- JSON and NDJSON file sinks (when `--json-file` or `--ndjson-file` are used)

### Sources for redaction patterns

1) Local env files (best‑effort):
   - `.env`
   - `.env.local`
   - `.env.production.local`
2) Process environment variables (`process.env`)
3) Optional configuration file: `opd.redaction.json`

Keys with a `PUBLIC_` prefix are treated as public and will not be redacted.

### Advanced: `opd.redaction.json`

Create this file at your project root to add custom redaction patterns. Patterns from this file are merged with the defaults derived from env files and the process environment.

Supported schema:

```json
{
  "redaction": {
    "literals": [
      "sk_live_my_secret",
      "ghp_example_token"
    ],
    "regex": [
      "Bearer\\s+[A-Za-z0-9-_\\.]+",
      { "pattern": "eyJ[a-zA-Z0-9_\\-]{10,}\\.[a-zA-Z0-9_\\-]{10,}\\.[a-zA-Z0-9_\\-]{10,}", "flags": "g" }
    ]
  }
}
```

- `literals`: array of exact string values to redact everywhere (human logs and machine outputs).
- `regex`: array of either raw regex strings or `{ pattern, flags? }` objects.

The CLI also derives base64 versions of literal values from env files/process.env for extra protection.

### Verifying redaction

- Run with JSON/NDJSON and file sinks:
  - `opd up vercel --env preview --json --ndjson --json-file .artifacts/out.json --ndjson-file .artifacts/out.ndjson`
- Grep artifacts for a known secret value; it should not appear.

## CI output settings

- `--json`: print deterministic JSON objects (suppresses human logs)
- `--ndjson`: newline‑delimited JSON streaming (implies `--json`)
- `--json-file <path>`: also write JSON objects to a file
- `--ndjson-file <path>`: also write NDJSON lines to a file
- `--summary-only`: only print objects with `{ final: true }`
- `--timestamps`: include ISO timestamps in JSON objects
 - `--gha`: GitHub Actions‑friendly preset. Implies `--json --summary-only --timestamps`, sets default sinks under `./.artifacts/`, and enables GitHub annotations defaults.

## Go sidecar and experimental flags

You can opt into the Go sidecar for improved reliability/performance and try experimental provider paths.

Environment variables:

- `OPD_GO_FORCE=1` — force using the Go sidecar when present
- `OPD_GO_DISABLE=1` — disable the Go sidecar (use Node runner)
- `OPD_PTY=1|0` — force PTY on/off; defaults to on for interactive terminals, off in CI/JSON modes
- `OPD_PACKAGE=zip` — pre-package `publishDir` into a zip before Netlify deploy; emits an `artifact` NDJSON event
- `OPD_NETLIFY_DIRECT=1` — use Netlify Direct Deploy (no CLI). Requires `NETLIFY_AUTH_TOKEN` and a known `publishDir` + `--project`.
- `NETLIFY_AUTH_TOKEN` — Netlify API token for direct deploys

### Reliability knobs

Provider subprocess invocations honor these environment variables (also configurable via flags on supported commands: `--retries`, `--timeout-ms`, `--base-delay-ms`):

- `OPD_RETRIES` — number (default: 2)
- `OPD_TIMEOUT_MS` — number in milliseconds (default: 120000)
- `OPD_BASE_DELAY_MS` — base delay for exponential backoff with jitter (default: 300)

## Start Wizard Defaults

When you confirm saving defaults at the end of `opd start`, the CLI writes your selections to `opd.config.json` at the project root under the `startDefaults` key.

Example:

```json
{
  "startDefaults": {
    "framework": "next",
    "provider": "vercel",
    "env": "preview",
    "path": "apps/web",
    "syncEnv": true,
    "project": "prj_123",
    "org": "team_abc"
  }
}
```

Behavior:

- On subsequent runs of `opd start`, the wizard loads these defaults and uses them as initial values.
- Use `--no-save-defaults` to suppress the save prompt at the end of the wizard.
- To clear, either delete `opd.config.json` or remove the `startDefaults` property.

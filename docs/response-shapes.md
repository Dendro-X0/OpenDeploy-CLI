# Response Shapes (CI)

This page documents the JSON outputs emitted by the CLI when `--json` (or `--ndjson`) is used. Objects marked with `"final": true` are intended for CI consumption.

## Common Fields

| Field     | Type                     | Required | Description |
|-----------|--------------------------|----------|-------------|
| provider  | `"vercel"`               | Yes      | Provider name |
| target    | `"prod" | "preview"`    | Varies   | Present on `up`/`deploy`/`promote`/`rollback` where relevant |
| action    | `string`                 | Varies   | e.g. `promote`, `rollback` |
| url       | `string`                 | No       | Deployment/production URL |
| logsUrl   | `string`                 | No       | Inspect URL |
| ok        | `boolean`                | Varies   | Explicit success/failure indicator on some commands |
| final     | `true`                   | Yes      | Present on top-level summaries |

Notes:
- Vercel `logsUrl` is the Inspect URL. If not printed by the deploy stream, the CLI falls back to `vercel inspect <url>`.

## Schemas & Validation

All commands emit a final JSON summary which is validated at runtime (Ajv 2020). Every final object is annotated with:

- `schemaOk: boolean`
- `schemaErrors: string[]` (empty when valid)

Strict guardrail (CI-friendly): set `OPD_SCHEMA_STRICT=1` to cause a non-zero exit code when schema errors are present. The final JSON is still printed for diagnosis. See also: `docs/schemas.md`.

## start (wizard)

The `start` wizard emits a final JSON summary and may emit intermediate NDJSON events when `--ndjson` (or `OPD_NDJSON=1`) is enabled.

Common summary fields:

| Field       | Type                       | Required | Notes |
|-------------|----------------------------|----------|-------|
| action      | const                      | Yes      | `start` |
| provider    | enum                       | Yes      | `vercel` |
| target      | enum                       | Yes      | `prod` or `preview` |
| mode        | enum                       | Yes      | `deploy` or `prepare-only` |
| url         | string                     | No       | When a deploy is executed |
| logsUrl     | string                     | No       | Inspect URL |
| ciChecklist | object                     | Yes      | `{ buildCommand, publishDir?, envFile?, exampleKeys? }` |
| cwd         | string                     | No       | The chosen working directory for the wizard |
| final       | true                       | Yes      | Present on the summary object |

Notes:

- Vercel uses `mode: "deploy"` and prints both `url` and `logsUrl`. When `--alias` is provided, the CLI attempts to alias the deployment and includes it in the human logs.

Examples:

Vercel (deploy):

```json
{
  "ok": true,
  "action": "start",
  "provider": "vercel",
  "target": "preview",
  "mode": "deploy",
  "url": "https://my-app-xyz.vercel.app",
  "logsUrl": "https://vercel.com/acme/my-app/inspections/dep_456",
  "ciChecklist": { "buildCommand": "next build", "envFile": ".env" },
  "cwd": "/path/to/app",
  "final": true
}
```

NDJSON events:

- When `--ndjson`/`OPD_NDJSON=1` is enabled, the wizard may emit non-final progress events prior to the summary. A cross-provider logs event is emitted when a dashboard/inspect URL is available:

```json
{"action":"start","provider":"vercel","target":"preview","event":"logs","logsUrl":"https://vercel.com/acme/app/inspections/dep_123"}
```

<!-- Netlify logs event removed -->

## up

| Field     | Type                    | Required | Notes |
|-----------|-------------------------|----------|-------|
| provider  | enum                    | Yes      | `vercel` |
| target    | enum                    | Yes      | `prod` or `preview` |
| url       | string                  | No       | Preview/prod URL |
| logsUrl   | string                  | No       | Inspect/dashboard URL |
| durationMs| number                  | No       | Elapsed time |
| final     | true                    | Yes      | |

```json
{
  "provider": "vercel",
  "target": "preview",
  "url": "https://my-app-abc.vercel.app",
  "logsUrl": "https://vercel.com/acme/my-app/inspect/dep_123",
  "durationMs": 3210,
  "final": true
}
```

<!-- Netlify up example removed -->

## deploy

| Field      | Type                    | Required | Notes |
|------------|-------------------------|----------|-------|
| provider   | enum                    | Yes      | `vercel` |
| target     | enum                    | Yes      | `prod` or `preview` |
| url        | string                  | No       | Deployment URL |
| logsUrl    | string                  | No       | Inspect/dashboard URL |
| aliasUrl   | string                  | No       | When alias was applied |
| durationMs | number                  | No       | Elapsed time |
| final      | true                    | Yes      | |

```json
{
  "provider": "vercel",
  "target": "preview",
  "url": "https://my-app-xyz.vercel.app",
  "logsUrl": "https://vercel.com/acme/my-app/inspect/dep_456",
  "aliasUrl": "https://staging.my-app.com",
  "durationMs": 4021,
  "final": true
}
```

<!-- Netlify deploy example removed -->

<!-- Netlify promote example removed -->

### NDJSON Progress Events

When `--ndjson` is active, the CLI emits structured one-line JSON events during `up` before the final summary. Typical stages:

- `envSyncStart`, `envSyncDone`
- `linking`
- `deployStart`
- `url`
- `logsUrl`
- `deployed`
- `aliasSet`

Example (truncated):

```json
{"ok":true,"action":"up","stage":"deployStart","provider":"vercel","target":"preview"}
{"ok":true,"action":"up","stage":"url","provider":"vercel","url":"https://my-app-123.vercel.app"}
{"ok":true,"action":"up","stage":"deployed","provider":"vercel","target":"preview","url":"https://my-app-123.vercel.app"}
```

Notes:

- Add `--timestamps` to include ISO timestamps in each event.
- Use `--summary-only` to suppress intermediate JSON and print only objects with `"final": true`.

## promote

| Field    | Type     | Required | Notes |
|----------|----------|----------|-------|
| ok       | boolean  | No       | Present for explicit success/failure |
| provider | enum     | Yes      | `vercel` |
| action   | const    | Yes      | `promote` |
| target   | const    | Yes      | `prod` |
| from     | string   | No       | Vercel: preview URL promoted |
| url      | string   | No       | Production URL |
| alias    | string   | No       | Vercel: production alias |
| logsUrl  | string   | No       | Inspect URL |
| final    | true     | Yes      | |

```json
{
  "ok": true,
  "provider": "vercel",
  "action": "promote",
  "target": "prod",
  "from": "https://my-preview.vercel.app",
  "url": "https://my-app.com",
  "alias": "https://my-app.com",
  "final": true
}
```

<!-- Netlify promote example removed -->

## rollback

| Field      | Type     | Required | Notes |
|------------|----------|----------|-------|
| ok         | boolean  | No       | Presence varies by branch |
| provider   | enum     | Yes      | `vercel` |
| action     | const    | Yes      | `rollback` |
| target     | const    | Yes      | `prod` |
| to         | string   | No       | Vercel: target URL for rollback |
| url        | string   | No       | Vercel: production URL/alias after rollback |
| alias      | string   | No       | Vercel: production alias |
| candidate  | string   | No       | Vercel: suggested target when `--alias` not passed |
| needsAlias | boolean  | No       | Vercel: true when alias required |
| message    | string   | No       | Failure message |
| dashboard  | string   | No       | Dashboard link |
| deployId   | string   | No       | Restored deploy id |
| final      | true     | Yes      | |

```json
{
  "ok": true,
  "provider": "vercel",
  "action": "rollback",
  "target": "prod",
  "to": "https://prev-prod.vercel.app",
  "url": "https://my-app.com",
  "alias": "https://my-app.com",
  "final": true
}
```

```json
{
  "ok": true,
  "provider": "vercel",
  "action": "rollback",
  "target": "prod",
  "candidate": "https://prev-prod.vercel.app",
  "needsAlias": true,
  "final": true
}
```

<!-- Netlify rollback example removed -->

## JSON Schemas

Runtime validation uses TypeScript schema modules located at:

- `src/schemas/*.schema.ts`

Final summaries are annotated with `schemaOk` and `schemaErrors`. In CI, `OPD_SCHEMA_STRICT=1` is enabled so any drift results in a non-zero exit code while preserving the final JSON output for debugging.

## Retries and Timeouts

All provider subprocess calls honor the following knobs (CLI flags or environment variables):

- `--retries <n>` (env: `OPD_RETRIES`, default: 2)
- `--timeout-ms <ms>` (env: `OPD_TIMEOUT_MS`, default: 120000)
- `--base-delay-ms <ms>` (env: `OPD_BASE_DELAY_MS`, default: 300)

Backoff uses exponential growth with jitter.

## jq Quick Reference

Extract common fields from final JSON summaries:

```bash
# Get deploy URL from a final summary object
jq -r 'select(.final==true) | .url // empty' < ./.artifacts/opd.json

# Get logs/inspect URL
jq -r 'select(.final==true) | .logsUrl // empty' < ./.artifacts/opd.json

# Get ok flag or provider
jq -r 'select(.final==true) | .ok // empty'
jq -r 'select(.final==true) | .provider'
```

Parse NDJSON streams and select the final summary line:

```bash
# Print the final summary object from an NDJSON stream
grep -a "{" ./.artifacts/opd.ndjson | jq -r 'select(.final==true)'

# Extract the first discovered URL from progress events, fallback to final url
grep -a "{" ./.artifacts/opd.ndjson \
  | jq -r 'select(.stage=="url").url // empty' \
  | head -n1 \
  || grep -a "{" ./.artifacts/opd.ndjson | jq -r 'select(.final==true) | .url // empty'
```

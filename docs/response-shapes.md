# Response Shapes (CI)

This page documents the JSON outputs emitted by the CLI when `--json` (or `--ndjson`) is used. Objects marked with `"final": true` are intended for CI consumption.

## Common Fields

| Field     | Type                     | Required | Description |
|-----------|--------------------------|----------|-------------|
| provider  | `"vercel" | "netlify"`  | Yes      | Provider name |
| target    | `"prod" | "preview"`    | Varies   | Present on `up`/`deploy`/`promote`/`rollback` where relevant |
| action    | `string`                 | Varies   | e.g. `promote`, `rollback` |
| url       | `string`                 | No       | Deployment/production URL |
| logsUrl   | `string`                 | No       | Inspect (Vercel) or dashboard (Netlify) URL |
| ok        | `boolean`                | Varies   | Explicit success/failure indicator on some commands |
| final     | `true`                   | Yes      | Present on top-level summaries |

Notes:
- Vercel `logsUrl` is the Inspect URL. If not printed by the deploy stream, the CLI falls back to `vercel inspect <url>`.
- Netlify `logsUrl` is a dashboard link constructed from site name and the latest deploy id.

## up

| Field     | Type                    | Required | Notes |
|-----------|-------------------------|----------|-------|
| provider  | enum                    | Yes      | `vercel` or `netlify` |
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

```json
{
  "provider": "netlify",
  "target": "prod",
  "url": "https://my-site.netlify.app",
  "logsUrl": "https://app.netlify.com/sites/my-site/deploys/dep_abc123",
  "final": true
}
```

## deploy

| Field      | Type                    | Required | Notes |
|------------|-------------------------|----------|-------|
| provider   | enum                    | Yes      | `vercel` or `netlify` |
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

```json
{
  "provider": "netlify",
  "target": "prod",
  "url": "https://my-site.netlify.app",
  "logsUrl": "https://app.netlify.com/sites/my-site/deploys/dep_def456",
  "final": true
}
```

When using direct restore on Netlify (`--from <deployId>`):

```json
{
  "ok": true,
  "provider": "netlify",
  "action": "promote",
  "target": "prod",
  "siteId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "deployId": "dep_abc123",
  "final": true
}
```

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
| provider | enum     | Yes      | `vercel` or `netlify` |
| action   | const    | Yes      | `promote` |
| target   | const    | Yes      | `prod` |
| from     | string   | No       | Vercel: preview URL promoted |
| url      | string   | No       | Production URL |
| alias    | string   | No       | Vercel: production alias |
| logsUrl  | string   | No       | Netlify: dashboard URL |
| siteId   | string   | No       | Netlify site ID when available |
| deployId | string   | No       | Netlify: restored deploy id (when using direct restore) |
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

```json
{
  "ok": true,
  "provider": "netlify",
  "action": "promote",
  "target": "prod",
  "url": "https://my-site.netlify.app",
  "logsUrl": "https://app.netlify.com/sites/my-site/deploys/dep_ghi789",
  "siteId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "final": true
}
```

## rollback

| Field      | Type     | Required | Notes |
|------------|----------|----------|-------|
| ok         | boolean  | No       | Presence varies by branch |
| provider   | enum     | Yes      | `vercel` or `netlify` |
| action     | const    | Yes      | `rollback` |
| target     | const    | Yes      | `prod` |
| to         | string   | No       | Vercel: target URL for rollback |
| url        | string   | No       | Vercel: production URL/alias after rollback |
| alias      | string   | No       | Vercel: production alias |
| candidate  | string   | No       | Vercel: suggested target when `--alias` not passed |
| needsAlias | boolean  | No       | Vercel: true when alias required |
| message    | string   | No       | Netlify: failure message |
| dashboard  | string   | No       | Netlify: dashboard link |
| deployId   | string   | No       | Netlify: restored deploy id |
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

```json
{
  "ok": false,
  "provider": "netlify",
  "action": "rollback",
  "target": "prod",
  "message": "Restore failed. Use dashboard to restore.",
  "dashboard": "https://app.netlify.com/sites/my-site/deploys/dep_abc123",
  "final": true
}
```

## JSON Schemas

Draft JSON Schemas are provided under `schemas/`:

- `schemas/up.schema.json`
- `schemas/deploy.schema.json`
- `schemas/promote.schema.json`
- `schemas/rollback.schema.json`

They can be used to validate outputs in CI pipelines.

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
jq -r 'select(.final==true) | .url // empty' < ./.artifacts/opendeploy.json

# Get logs/inspect URL
jq -r 'select(.final==true) | .logsUrl // empty' < ./.artifacts/opendeploy.json

# Get ok flag or provider
jq -r 'select(.final==true) | .ok // empty'
jq -r 'select(.final==true) | .provider'
```

Parse NDJSON streams and select the final summary line:

```bash
# Print the final summary object from an NDJSON stream
grep -a "{" ./.artifacts/opendeploy.ndjson | jq -r 'select(.final==true)'

# Extract the first discovered URL from progress events, fallback to final url
grep -a "{" ./.artifacts/opendeploy.ndjson \
  | jq -r 'select(.stage=="url").url // empty' \
  | head -n1 \
  || grep -a "{" ./.artifacts/opendeploy.ndjson | jq -r 'select(.final==true) | .url // empty'
```

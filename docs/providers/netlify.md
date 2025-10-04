# Netlify

This page documents how OpenDeploy CLI deploys to Netlify and the optional speed/reliability features you can enable.

## Overview

OpenDeploy supports two paths for Netlify:

- CLI path (default): invokes `netlify deploy` and parses streaming output.
- Direct API path (experimental): uploads your `publishDir` directly via the Netlify Deploy API (no Netlify CLI required).

Both paths benefit from the Go sidecar for robust process handling and timeouts.

## Prerequisites

- Node.js 18+
- Netlify site ID (`--project` / site name)
- Build output directory (`publishDir`), or let the wizard detect it

Optional (recommended):

- Go sidecar enabled via `OPD_GO_FORCE=1` for best reliability/performance

## Flags and environment

- `OPD_GO_FORCE=1` — force using the Go sidecar when available (preferred)
- `OPD_GO_DISABLE=1` — disable the Go sidecar (fallback to Node)
- `OPD_PTY=1|0` — force PTY usage on/off (auto-detected by default)
- `OPD_JSON=1`, `OPD_NDJSON=1` — structured output; NDJSON emits a stream of events
- `OPD_PACKAGE=zip` — pre-package `publishDir` as a zip and emit an `artifact` event with checksum

Experimental (Direct Deploy):

- `OPD_NETLIFY_DIRECT=1` — use the Go sidecar Netlify API path
- `NETLIFY_AUTH_TOKEN` — required for direct deploys

## CLI path (default)

Examples:

```bash
# Preview deploy (no build) when publishDir is known
opd start --provider netlify --env preview --project <site_id>

# Production deploy
opd start --provider netlify --env prod --project <site_id>
```

With packaging signal:

```bash
OPD_GO_FORCE=1 OPD_PACKAGE=zip opd start --provider netlify --env preview --project <site_id> --json
```

This emits an `artifact` NDJSON event containing the packaged zip path and `sha256` checksum.

## Direct deploy (experimental)

```bash
NETLIFY_AUTH_TOKEN=<token> \
OPD_GO_FORCE=1 \
OPD_NETLIFY_DIRECT=1 \
opd start --provider netlify --env preview --project <site_id> --json
```

Behavior:

- Hashes files in `publishDir` (SHA1) to create a deploy
- Uploads only missing files required by the API
- Polls until `ready` and emits final `{ url, logsUrl }`

Notes:

- Requires `publishDir` and `--project` (site ID/name)
- Falls back to the CLI path on errors

## Troubleshooting

- Missing token: set `NETLIFY_AUTH_TOKEN` for direct deploys
- Timeouts/idle: look for `reason` in the final `done` event (`timeout`, `idle-timeout`)
- Stuck processes: enable the Go sidecar (`OPD_GO_FORCE=1`) to ensure process-tree cleanup on Windows/Unix

## See also

- `docs/development/opd-go-protocol.md` — Go sidecar handshake and event contract
- `docs/commands.md` — full CLI reference
- `docs/troubleshooting.md` — common issues

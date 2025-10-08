# Go Sidecar Protocol v1

This document describes the JSON/NDJSON protocol between the TypeScript CLI and the Go sidecar binary (`opd-go`).

## Handshake

On startup, the sidecar emits a single hello event:

```json
{ "action": "go", "event": "hello", "extra": { "protocolVersion": "1", "goVersion": "go1.x" } }
```

The Node client should verify `protocolVersion` is supported. If not, it should fall back to the pure-Node runner.

## Events

All subsequent messages are emitted as newline-delimited JSON (NDJSON). The following fields are used:

- `action`: always `"go"`
- `event`: one of `"status" | "stdout" | "stderr" | "error" | "done"`
- `data`: optional text payload for `status/stdout/stderr`
- `ok`: boolean on `done`
- `exitCode`: number on `done`
- `final`: always `true` on `done`
- `reason`: optional termination reason on `error/done`: `"timeout" | "idle-timeout" | "start-failed"`
- `extra`: optional object with action-specific fields

## Actions

### run-stream

Runs a shell command with timeouts and idle watchdog. Streams `stdout/stderr` lines and periodic `status` heartbeats.

Request:
```json
{
  "action": "run-stream",
  "cmd": "vercel deploy",
  "cwd": "/path/to/app",
  "timeoutSec": 600,
  "idleTimeoutSec": 120,
  "env": { "FOO": "bar" },
  "pty": true,
  "cols": 120,
  "rows": 30
}
```

### zip-dir

Create a zip archive of a directory.

Request:
```json
{ "action": "zip-dir", "src": "dist", "dest": ".artifacts/site.zip", "prefix": "" }
```

`done.extra.dest` contains the resulting archive path.

### tar-dir

Create a tar archive (optionally gzip) of a directory.

Request:
```json
{ "action": "tar-dir", "src": "dist", "dest": ".artifacts/site.tar.gz", "prefix": "", "targz": true }
```

`done.extra.dest` contains the resulting archive path.

### checksum-file

Compute file digest (sha256).

Request:
```json
{ "action": "checksum-file", "src": ".artifacts/site.zip", "algo": "sha256" }
```

`done.extra.digest` contains the hex digest.

### netlify-deploy-dir (experimental)

Deploy a directory directly to Netlify via API.

Requirements:
- Environment: `NETLIFY_AUTH_TOKEN`
- Request:
```json
{ "action": "netlify-deploy-dir", "src": "dist", "site": "site_123", "prod": false }
```

Results:
- Streams `status` (hashing, creating, uploading N, finalizing)
- Final `done.extra`: `{ "url": "https://…netlify.app", "logsUrl": "https://app.netlify.com/sites/<site>/deploys/<id>", "deployId": "dep_…" }`

## Termination and reasons

When a process is terminated by timeout or idle watchdog, `done` includes a `reason`. Consumers should surface `reason` in user output and CI logs.

## Process tree cleanup

- Windows: uses `taskkill /T /F` to terminate the full tree.
- Unix: launches process in its own process group and signals TERM then KILL to the group.

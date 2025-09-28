# Go Sidecar Runner (opd-go)

The CLI core remains TypeScript, but for robust process control we optionally use a Go sidecar (`opd-go`). This hybrid approach keeps the UX and integrations in Node.js/TS while delegating the hard parts of spawning and streaming to Go.

## What the sidecar does
- Spawns provider/utility commands reliably across OSes
- Streams stdout/stderr as NDJSON events
- Enforces hard timeout and idle-timeout
- Emits a final JSON summary with `ok`, `exitCode`, and `final: true`

## Protocol
- Request (stdin, single line JSON):
```json
{
  "action": "run-stream",
  "cmd": "vercel --version",
  "cwd": "",
  "timeoutSec": 900,
  "idleTimeoutSec": 45,
  "env": { }
}
```
- Events (stdout, NDJSON per line):
```json
{ "action": "go", "event": "stdout", "data": "..." }
{ "action": "go", "event": "stderr", "data": "..." }
{ "action": "go", "event": "status", "data": "heartbeat or info" }
{ "action": "go", "event": "done", "ok": true, "exitCode": 0, "final": true }
```

## Local build
- Windows:
```
pnpm run build:go:win
```
- macOS/Linux:
```
pnpm run build:go:nix
```
- Output:
  - Windows: `./.bin/opd-go.exe`
  - macOS/Linux: `./.bin/opd-go`

## Use the sidecar in the CLI
- PowerShell:
```
$env:OPD_GO_BIN = "$PWD\.bin\opd-go.exe"
```
- Bash:
```
export OPD_GO_BIN="$PWD/.bin/opd-go"
```
- Then run your normal CLI commands, e.g.:
```
opd start
```
The CLI prefers the Go runner if `OPD_GO_BIN`, `./.bin/opd-go(.exe)`, or `opd-go` on PATH are found. Otherwise, it falls back to the Node.js runner.

To disable the sidecar:
```
OPD_GO_DISABLE=1 opd start
```

## Quick smoke test
You can invoke the sidecar directly:

- PowerShell:
```
echo '{"action":"run-stream","cmd":"node -v"}' | .\.bin\opd-go.exe
```
- Bash:
```
echo '{"action":"run-stream","cmd":"node -v"}' | ./.bin/opd-go
```

## CI releases (prebuilt binaries)
On tagged releases, GoReleaser builds `opd-go` for Windows/macOS/Linux (amd64/arm64) and uploads archives with checksums. CI and local users without Go can download a prebuilt, verify checksums, and set `OPD_GO_BIN`.

## Where to read the code
- Sidecar: `go/cmd/opd-go/main.go` (timeouts, scanners, NDJSON)
- TS shim: `src/utils/process-go.ts` (binary resolution, event parsing)
- Preferred spawn: `src/utils/process-pref.ts` (Go sidecar vs Node fallback)
- Wizard integration: `src/commands/start.ts` (uses preferred spawn)

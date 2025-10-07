# OpenDeploy CLI — Smoke Tests

These smoke tests validate the Go sidecar and the Netlify direct deploy path. They are safe by default and will not deploy unless you set opt-in environment variables.

## Scripts

- smoke-sidecar.ps1 — Windows PowerShell test for sidecar handshake and run-stream
- smoke-packaging.ps1 — Windows PowerShell test for `zip-dir` and `checksum-file`
- netlify-direct.ps1 — Windows PowerShell test for Netlify Direct Deploy (optional)
- smoke-sidecar.sh — Bash test for sidecar handshake and run-stream
- smoke-packaging.sh — Bash test for packaging helpers
- netlify-direct.sh — Bash test for Netlify Direct Deploy (optional)

## Prereqs

- pnpm installed
- Node 18+
- For Netlify Direct Deploy:
  - Set `NETLIFY_AUTH_TOKEN`
  - Provide a site name/id via `OPD_NETLIFY_SITE`
  - Opt in with `OPD_SMOKE_RUN_NETLIFY_DIRECT=1`

## Usage (Windows / PowerShell)

```powershell
# From repo root
scripts/smoke/smoke-sidecar.ps1
scripts/smoke/smoke-packaging.ps1

# Optional: direct deploy (requires token + site)
$env:NETLIFY_AUTH_TOKEN = "..."
$env:OPD_NETLIFY_SITE = "mysite"
$env:OPD_SMOKE_RUN_NETLIFY_DIRECT = "1"
scripts/smoke/netlify-direct.ps1
```

## Usage (macOS/Linux / Bash)

```bash
# From repo root
bash scripts/smoke/smoke-sidecar.sh
bash scripts/smoke/smoke-packaging.sh

# Optional: direct deploy (requires token + site)
export NETLIFY_AUTH_TOKEN=...
export OPD_NETLIFY_SITE=mysite
export OPD_SMOKE_RUN_NETLIFY_DIRECT=1
bash scripts/smoke/netlify-direct.sh
```

Notes:
- These are minimal checks intended to catch integration regressions.
- The Netlify Direct test actually deploys; it is disabled unless explicitly enabled via env vars.

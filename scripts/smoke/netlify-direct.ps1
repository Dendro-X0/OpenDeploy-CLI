#Requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Ensure-Sidecar {
  $bin = Join-Path (Get-Location) ".bin/opd-go.exe"
  if (-not (Test-Path $bin)) {
    Write-Host "[info] Building Go sidecar..."
    pnpm -s build:go:win | Out-Host
  }
  return $bin
}

if (-not $env:NETLIFY_AUTH_TOKEN) { Write-Error "NETLIFY_AUTH_TOKEN is required" }
if (-not $env:OPD_NETLIFY_SITE) { Write-Error "OPD_NETLIFY_SITE must be set to your Netlify site id/name" }
if ($env:OPD_SMOKE_RUN_NETLIFY_DIRECT -ne '1') { Write-Host "[skip] OPD_SMOKE_RUN_NETLIFY_DIRECT!=1 (set to 1 to enable)"; exit 0 }

$env:OPD_GO_FORCE = "1"
$env:OPD_NDJSON = "1"
$env:OPD_PTY = "0"

$bin = Ensure-Sidecar

# Prepare temp artifact directory
$root = Join-Path (Get-Location) "scripts/smoke/tmp"
$null = New-Item -ItemType Directory -Force -Path $root | Out-Null
$dist = Join-Path $root ("nl-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
$null = New-Item -ItemType Directory -Force -Path $dist | Out-Null
Set-Content -LiteralPath (Join-Path $dist 'index.html') -Value '<!doctype html><title>Netlify Direct Smoke</title>' -Encoding UTF8

# Run direct deploy via sidecar
$req = '{"action":"netlify-deploy-dir","src":"' + ($dist -replace '\\','/') + '","site":"' + $env:OPD_NETLIFY_SITE + '","prod":false}'
$out = $req | & $bin
$outStr = ($out | Out-String)

if ($outStr -notmatch '"event"\s*:\s*"done"\s*,\s*"ok"\s*:\s*true') { Write-Error "direct deploy did not complete ok" }
$logs = [regex]::Match($outStr, '"logsUrl"\s*:\s*"([^"]+)"')
$url  = [regex]::Match($outStr, '"url"\s*:\s*"([^"]+)"')

Write-Host "[ok] Netlify direct deploy smoke passed: url=$($url.Groups[1].Value) logs=$($logs.Groups[1].Value)"

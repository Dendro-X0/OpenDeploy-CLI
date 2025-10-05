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

$env:OPD_GO_FORCE = "1"
$env:OPD_NDJSON = "1"
$env:OPD_PTY = "0"

$bin = Ensure-Sidecar

# Prepare temp directory with sample files
$root = Join-Path (Get-Location) "scripts/smoke/tmp"
$null = New-Item -ItemType Directory -Force -Path $root | Out-Null
$packDir = Join-Path $root ("pack-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
$null = New-Item -ItemType Directory -Force -Path $packDir | Out-Null
Set-Content -LiteralPath (Join-Path $packDir 'index.html') -Value '<!doctype html><title>Smoke</title>' -Encoding UTF8
Set-Content -LiteralPath (Join-Path $packDir 'meta.json') -Value '{"ok":true}' -Encoding UTF8

# Dest artifact
$artifacts = Join-Path (Get-Location) ".artifacts"
$null = New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
$zipPath = Join-Path $artifacts ("smoke-netlify-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".zip")

# Run zip-dir
$zipReq = '{"action":"zip-dir","src":"' + ($packDir -replace '\\','/') + '","dest":"' + ($zipPath -replace '\\','/') + '"}'
$outZip = $zipReq | & $bin
$outZipStr = ($outZip | Out-String)
if ($outZipStr -notmatch '"event"\s*:\s*"done"') { Write-Error "zip-dir did not emit done" }
if (-not (Test-Path $zipPath)) { Write-Error "zip artifact not found: $zipPath" }

# Checksum the artifact
$chkReq = '{"action":"checksum-file","src":"' + ($zipPath -replace '\\','/') + '","algo":"sha256"}'
$outChk = $chkReq | & $bin
$outChkStr = ($outChk | Out-String)
$match = [regex]::Match($outChkStr, '"digest"\s*:\s*"([0-9a-f]{64})"', 'IgnoreCase')
if (-not $match.Success) { Write-Error "checksum digest not found or invalid" }

Write-Host "[ok] Packaging helpers smoke passed: $zipPath sha256=$($match.Groups[1].Value)"

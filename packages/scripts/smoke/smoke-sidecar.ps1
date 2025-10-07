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
$env:OPD_PTY = "0"
$env:OPD_NDJSON = "1"

$bin = Ensure-Sidecar

Write-Host "[info] Running sidecar run-stream handshake smoke..."
$json = '{"action":"run-stream","cmd":"node -v"}'
$out = $json | & $bin

$outStr = ($out | Out-String)
if ($outStr -notmatch '"event"\s*:\s*"hello"') {
  Write-Error "hello event not observed"
}
if ($outStr -notmatch '"event"\s*:\s*"done"') {
  Write-Error "done event not observed"
}

Write-Host "[ok] Sidecar handshake + run-stream smoke passed"

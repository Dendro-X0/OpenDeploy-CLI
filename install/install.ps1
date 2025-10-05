# Requires -Version 5.1
$ErrorActionPreference = 'Stop'

$Owner = 'Dendro-X0'
$Repo = 'OpenDeploy-CLI'
$Asset = 'opd.js'
$InstallDir = Join-Path $env:USERPROFILE '.opd'
$WrapperCmd = Join-Path $InstallDir 'opd.cmd'
# Allow pinning a specific tag via OPD_VERSION (e.g., v1.2.0-rc.1); default to latest
$Version = if ($env:OPD_VERSION) { $env:OPD_VERSION } else { 'latest' }
if ($Version -eq 'latest') {
  $UrlBase = "https://github.com/$Owner/$Repo/releases/latest/download"
} else {
  $UrlBase = "https://github.com/$Owner/$Repo/releases/download/$Version"
}

function Write-Log($msg) { Write-Host "[opd] $msg" }
function Write-Err($msg) { Write-Host "[opd] ERROR: $msg" -ForegroundColor Red }

# Check Node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Err 'Node.js >= 18 is required'
  exit 1
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Set-Location $InstallDir

$assetTmp = "$Asset.tmp"

Write-Log "Downloading $Asset ..."
Invoke-WebRequest -UseBasicParsing -Uri "$UrlBase/$Asset" -OutFile $assetTmp

# Optional checksum verification
try {
  Write-Log 'Verifying checksum ...'
  $checks = Invoke-WebRequest -UseBasicParsing -Uri "$UrlBase/checksums.txt" | Select-Object -ExpandProperty Content
  if ($checks) {
    $hash = (Get-FileHash -Algorithm SHA256 $assetTmp).Hash.ToLower()
    if (-not ($checks -match "$hash\s+$Asset")) { throw 'Checksum mismatch' }
  } else {
    Write-Log 'Skipping checksum verification (checksums.txt not found)'
  }
} catch {
  Write-Log 'Skipping checksum verification (unavailable or mismatch check skipped)'
}

Move-Item -Force $assetTmp $Asset

# Create thin CMD shim
"@echo off`r`nnode `"%~dp0$Asset`" %*" | Out-File -FilePath $WrapperCmd -Encoding ascii -Force

# PATH helper
$pathHas = ($env:Path -split ';') -contains $InstallDir
if (-not $pathHas) {
  Write-Log 'Add to PATH (one-time):'
  Write-Host ("  setx PATH `"{0};%PATH%`"" -f $InstallDir)
  Write-Log "Then restart your terminal."
}

Write-Log "Installed $WrapperCmd"
Write-Log 'Run: opd --help'

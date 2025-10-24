# OpenDeploy CLI installer (Windows PowerShell)
# - Downloads the latest GitHub Release binary for your architecture
# - Installs to %USERPROFILE%\bin by default (no admin required)
# - Set $env:OPD_PREFIX to customize the install folder

$ErrorActionPreference = 'Stop'

$Owner = 'Dendro-X0'
$Repo  = 'OpenDeploy-CLI'
$UA    = 'opd-installer'
$Api   = "https://api.github.com/repos/$Owner/$Repo/releases/latest"

# Detect arch
$arch = (Get-CimInstance Win32_Processor).Architecture
$asset = switch ($arch) {
  9  { 'opd-win-x64.exe' }      # x64
  12 { 'opd-win-arm64.exe' }    # ARM64 (if/when available)
  default { 'opd-win-x64.exe' }
}

# Fetch release JSON and find asset
$hdr = @{ 'User-Agent' = $UA }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$rel = Invoke-RestMethod -Headers $hdr -Uri $Api
$url = ($rel.assets | Where-Object name -eq $asset).browser_download_url
if (-not $url) { throw "Asset not found: $asset in $($rel.tag_name)" }

$prefix = if ($env:OPD_PREFIX) { $env:OPD_PREFIX } else { Join-Path $env:USERPROFILE 'bin' }
$destDir = $prefix
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
$dest = Join-Path $destDir 'opd.exe'

Write-Host "Downloading $asset -> $dest"
Invoke-WebRequest -Headers $hdr -Uri $url -OutFile $dest

Write-Host "Installed: $dest"

# Ensure install dir on PATH for the current user
$pathParts = $env:PATH -split ';'
if (-not ($pathParts -contains $destDir)) {
  try {
    $newPath = "$destDir;" + $env:PATH
    [Environment]::SetEnvironmentVariable('PATH', $newPath, 'User')
    Write-Host "Added $destDir to User PATH. Open a new terminal to pick up changes."
  }
  catch {
    Write-Warning "Could not modify PATH automatically. Add this directory to PATH manually: $destDir"
  }
}

& $dest -v

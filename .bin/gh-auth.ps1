$ErrorActionPreference = 'Stop'

function Resolve-Gh {
  $gc = Get-Command gh -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($gc -and $gc.Source) { return $gc.Source }
  $paths = @(
    "$env:ProgramFiles\GitHub CLI\gh.exe",
    "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe"
  )
  foreach ($p in $paths) { if (Test-Path $p) { return $p } }
  Write-Host "GitHub CLI (gh) not found. Please install via winget install GitHub.cli" -ForegroundColor Red
  exit 127
}

$gh = Resolve-Gh
Write-Host "Launching GitHub CLI auth (web flow)..." -ForegroundColor Cyan
& $gh auth login -w
if ($LASTEXITCODE -ne 0) { Write-Error "gh auth login failed with $LASTEXITCODE"; exit $LASTEXITCODE }
Write-Host "GitHub CLI authenticated." -ForegroundColor Green

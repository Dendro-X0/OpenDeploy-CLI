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

function Require-Cmd {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Host "Required tool not found: $Name" -ForegroundColor Red
    exit 127
  }
}

function Resolve-Repo {
  try { $url = (& git remote get-url origin).Trim() } catch { $url = '' }
  if ($env:GITHUB_REPOSITORY) { return $env:GITHUB_REPOSITORY }
  if ($url -match 'github.com[:/]{1,2}([^/]+)/([^/.]+)') { return "$($Matches[1])/$($Matches[2])" }
  Write-Host "Unable to resolve GitHub repo. Set GITHUB_REPOSITORY or add an origin remote." -ForegroundColor Red
  exit 2
}

Require-Cmd git
$gh = Resolve-Gh
$repo = Resolve-Repo
$branch = (& git rev-parse --abbrev-ref HEAD).Trim()

Write-Host "Dispatching CI workflow for repo '$repo' on branch '$branch'..." -ForegroundColor Cyan
# Try ci.yml first, then fallback to ci-matrix.yml
& $gh workflow run ci.yml --repo $repo --ref $branch 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "ci.yml dispatch failed or not available; trying ci-matrix.yml" -ForegroundColor Yellow
  & $gh workflow run ci-matrix.yml --repo $repo --ref $branch
  if ($LASTEXITCODE -ne 0) { Write-Error "Failed to dispatch any CI workflow"; exit $LASTEXITCODE }
}
Write-Host "Dispatch request submitted." -ForegroundColor Green

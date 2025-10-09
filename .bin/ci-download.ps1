$ErrorActionPreference = 'Stop'
function Require-Cmd {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Host "Required tool not found: $Name" -ForegroundColor Red
    exit 127
  }
}
Require-Cmd git
Require-Cmd gh

$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Fetching latest workflow run artifacts for '$branch'..." -ForegroundColor Cyan

# Get the latest run ID for this branch
$json = & gh run list -b $branch -L 1 --json databaseId,status,conclusion,headBranch
$run = ($json | ConvertFrom-Json)[0]
if (-not $run) { Write-Host 'No runs found.'; exit 1 }
$runId = $run.databaseId

# Query artifacts
$view = & gh run view $runId --json artifacts
$artifacts = (ConvertFrom-Json $view).artifacts
if (-not $artifacts -or $artifacts.Count -eq 0) { Write-Host 'No artifacts to download.'; exit 0 }

$destRoot = Join-Path (Get-Location) ".artifacts/ci/latest"
New-Item -ItemType Directory -Force -Path $destRoot | Out-Null

foreach ($a in $artifacts) {
  $name = $a.name
  $dest = Join-Path $destRoot $name
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Write-Host "Downloading artifact '$name' from run $runId ..." -ForegroundColor Yellow
  & gh run download $runId -n $name -D $dest
}

Write-Host "Artifacts downloaded to: $destRoot" -ForegroundColor Green

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

# Find latest run for this branch
$listJson = & $gh run list --repo $repo -b $branch -L 1 --json databaseId,status,conclusion,headBranch 2>$null
if (-not $listJson) { Write-Host "No runs found for branch '$branch'" -ForegroundColor Yellow; exit 2 }
$runs = $listJson | ConvertFrom-Json
if (-not $runs -or $runs.Count -eq 0) { Write-Host "No runs found for branch '$branch'" -ForegroundColor Yellow; exit 2 }
$runId = $runs[0].databaseId

# Show failed job logs
& $gh run view --repo $repo $runId --log-failed

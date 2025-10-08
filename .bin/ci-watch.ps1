param(
  [string]$Workflow = 'ci.yml'
)

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

Require-Cmd git
$gh = Resolve-Gh

function Resolve-Repo {
  try {
    $url = (& git remote get-url origin).Trim()
  } catch {
    $url = ''
  }
  if ($env:GITHUB_REPOSITORY) { return $env:GITHUB_REPOSITORY }
  if ($url -match 'github.com[:/]{1,2}([^/]+)/([^/.]+)') {
    $owner = $Matches[1]
    $repo = $Matches[2]
    return "$owner/$repo"
  }
  Write-Host "Unable to resolve GitHub repo. Set GITHUB_REPOSITORY or add an origin remote." -ForegroundColor Red
  exit 2
}

$repo = Resolve-Repo

$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Watching latest workflow run for workflow '$Workflow' on branch '$branch'..." -ForegroundColor Cyan

# Resolve the latest run ID for this branch and workflow
$listJson = & $gh run list --repo $repo -b $branch --workflow $Workflow -L 20 --json databaseId,status,conclusion,headBranch 2>$null
if (-not $listJson) {
  # Fallback: try without workflow filter in case of name mismatch
  $listJson = & $gh run list --repo $repo -b $branch -L 1 --json databaseId,status,conclusion,headBranch 2>$null
  if (-not $listJson) {
    Write-Host "No runs found for branch '$branch'. Trigger a workflow first (e.g., pnpm run ci:dispatch)." -ForegroundColor Yellow
    exit 2
  }
}
$runs = $listJson | ConvertFrom-Json
if (-not $runs) { $runs = @() }
if ($runs -is [System.Collections.IDictionary]) { $runs = @($runs) }
if ($runs.Count -eq 0) {
  Write-Host "No runs found for branch '$branch'. Trigger a workflow first (e.g., pnpm run ci:dispatch)." -ForegroundColor Yellow
  exit 2
}
# Prefer an active run (in_progress or queued); otherwise fallback to most recent
$active = @($runs | Where-Object { $_.status -in @('in_progress','queued') })
if ($active.Count -gt 0) { $runId = $active[0].databaseId } else { $runId = $runs[0].databaseId }
Write-Host "Following run ID: $runId" -ForegroundColor Gray

# Watch until completion; exit code reflects run conclusion
& $gh run watch --repo $repo $runId --exit-status --interval 5

# Show logs for failed steps/jobs (if any)
& $gh run view --repo $repo $runId --log-failed

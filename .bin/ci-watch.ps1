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
Write-Host "Watching latest workflow run on branch '$branch'..." -ForegroundColor Cyan

# Show the latest run summary for the branch
& gh run list -b $branch -L 1

# Watch until completion; exit code reflects run conclusion
& gh run watch --exit-status --interval 5

# Show logs for failed steps/jobs (if any)
& gh run view --log-failed

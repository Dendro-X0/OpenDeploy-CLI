param(
  [int]$Tail = 200
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

# Summarize jobs
$jobsJson = & $gh run view --repo $repo $runId --json jobs 2>$null
if (-not $jobsJson) {
  Write-Host "gh run view --json jobs failed, falling back to gh api" -ForegroundColor Yellow
  $owner,$repoName = $repo.Split('/')
  $jobsJson = & $gh api "repos/$owner/$repoName/actions/runs/$runId/jobs?per_page=100" 2>$null
  $jobs = ($jobsJson | ConvertFrom-Json).jobs
} else {
  $jobs = ($jobsJson | ConvertFrom-Json).jobs
}
if ($null -eq $jobs) { $jobs = @() }
$failed = @($jobs | Where-Object { $_.conclusion -ne 'success' })
if ($failed.Count -eq 0) { Write-Host 'No failed jobs.' -ForegroundColor Green; exit 0 }

# Prepare output dir
$outDir = Join-Path (Resolve-Path '.').Path '.artifacts/ci/logs'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Write-Host ("Failed jobs: " + ($failed | ForEach-Object { $_.name + ' [' + $_.status + '/' + $_.conclusion + ']' } | Out-String))

foreach ($j in $failed) {
  $safeName = ($j.name -replace '[^a-zA-Z0-9_.-]+','_')
  $logPath = Join-Path $outDir ("$safeName.log")
  Write-Host ("----- Saving full logs: " + $j.name + " -> " + $logPath) -ForegroundColor Cyan
  if ($j.id) {
    try {
      & $gh run view --repo $repo $runId --job $j.id --log | Out-File -FilePath $logPath -Encoding UTF8
    } catch {
      Write-Host "gh run view --job failed, falling back to gh api job logs" -ForegroundColor Yellow
      $owner,$repoName = $repo.Split('/')
      & $gh api "repos/$owner/$repoName/actions/jobs/$($j.id)/logs" | Out-File -FilePath $logPath -Encoding UTF8
    }
  } else {
    Write-Host "Job id missing; skipping direct job log fetch. Using --log-failed aggregate." -ForegroundColor Yellow
    & $gh run view --repo $repo $runId --log-failed | Out-File -FilePath $logPath -Encoding UTF8
  }
  Write-Host ("----- Tail $Tail lines: " + $j.name) -ForegroundColor Yellow
  Get-Content $logPath -Tail $Tail
}

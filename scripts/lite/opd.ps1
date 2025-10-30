param(
  [Parameter(Position=0)] [string]$command = 'start',
  [string]$path = '.',
  [string]$provider = 'vercel',
  [string]$env = 'preview',
  [string]$output = '',
  [switch]$prod
)

$ErrorActionPreference = 'Stop'
function Fail($msg) { Write-Error $msg; exit 1 }
function Info($msg) { Write-Host $msg }

if ($command -in @('--help','-h','help','/?')) {
  @'
OpenDeploy Lite (PowerShell wrapper)
Usage:
  .\opd.ps1 start --path <app_dir> --provider <vercel|cloudflare-pages|github-pages> [--env preview|production] [--output <dir>] [--prod]

Notes:
- Uses official provider CLIs under the hood.
- Vercel: requires VERCEL_TOKEN for non-interactive deploy.
- Cloudflare Pages: requires wrangler and token (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID).
- GitHub Pages: uses npx gh-pages; requires repo to be a Git remote with permissions.
'@ | Write-Host
  exit 0
}

$provider = $provider.ToLowerInvariant()
if ($prod) { $env = 'production' }
if (-not (Test-Path $path)) { Fail "Path not found: $path" }

switch ($command) {
  'start' {
    switch ($provider) {
      'vercel' {
        if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
          Fail "Vercel CLI not found. Install: npm i -g vercel"
        }
        $args = @('--cwd', $path, '--yes')
        if ($env -eq 'production') { $args += '--prod' }
        if ($env:VERCEL_TOKEN) { $args += @('--token', $env:VERCEL_TOKEN) }
        Info "→ vercel $($args -join ' ')"
        & vercel @args
        exit $LASTEXITCODE
      }
      'cloudflare-pages' {
        if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
          Fail "Wrangler not found. Install: npm i -g wrangler"
        }
        if (-not $output) { $output = 'dist' }
        $projectName = Split-Path -Leaf $path
        $cmd = @('pages','deploy', $output, '--project-name', $projectName)
        if ($env -ne 'production') { $cmd += @('--branch','preview') }
        Info "→ wrangler $($cmd -join ' ') (cwd=$path)"
        Push-Location $path
        try { & wrangler @cmd; exit $LASTEXITCODE } finally { Pop-Location }
      }
      'github-pages' {
        if (-not $output) { $output = 'dist' }
        Info "→ npx gh-pages -d $output (cwd=$path)"
        Push-Location $path
        try { & npx gh-pages -d $output; exit $LASTEXITCODE } finally { Pop-Location }
      }
      Default { Fail "Unknown provider: $provider" }
    }
  }
  Default { Fail "Unknown command: $command" }
}

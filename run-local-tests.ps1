$ErrorActionPreference = Continue
$cli = "node packages/cli/dist/index.js"
$out = ".\.artifacts\\local-tests"
$null = New-Item -ItemType Directory -Force -Path $out
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$projects = @(
  "G:\\Web Development Project\\Codebase-X0\\my-workspace\\astro-mini",
  "G:\\Web Development Project\\Codebase-X0\\my-workspace\\nuxt-test\\nuxt-app",
  "G:\\Web Development Project\\Codebase-X0\\my-workspace\\sveltekit-mini",
  "G:\\Web Development Project\\Codebase-X0\\my-workspace\\next-ecommercekit-monorepo"
)
$providers = @("github-pages","cloudflare-pages","vercel")

# Ensure CLI is built
$cliDist = Join-Path $PWD "packages/cli/dist/index.js"
if (-not (Test-Path $cliDist)) {
  Write-Host "Building CLI (first run)…"
  & bash -lc "corepack enable" | Out-Null
  & bash -lc "pnpm install -r --no-frozen-lockfile" | Out-Null
  & bash -lc "pnpm -r --workspace-concurrency=1 build" | Out-Null
}

$success = 0; $fail = 0
foreach ($p in $projects) {
  $name = Split-Path $p -Leaf
  $projOut = Join-Path $out ("$ts-" + $name)
  $null = New-Item -ItemType Directory -Force -Path $projOut
  Write-Host "\n=== Project: $p ==="

  # Detect
  $detectFile = Join-Path $projOut "detect.json"
  try {
    & node packages/cli/dist/index.js detect --path "$p" --json --summary-only --timestamps *> $detectFile
    Write-Host "detect -> $detectFile"
    $success++
  } catch {
    Write-Warning "detect failed for $p: $($_.Exception.Message)"; $fail++
  }

  # Start dry-run per provider
  foreach ($prov in $providers) {
    $file = Join-Path $projOut ("start-" + $prov + ".json")
    try {
      & node packages/cli/dist/index.js start --path "$p" --provider $prov --env preview --dry-run --minimal --json --summary-only --timestamps *> $file
      Write-Host "start:$prov -> $file"
      $success++
    } catch {
      Write-Warning "start:$prov failed for $p: $($_.Exception.Message)"; $fail++
    }
  }
}

Write-Host "\nArtifacts saved under $out"
Write-Host ("Summary: success={0} fail={1}" -f $success, $fail)
PS

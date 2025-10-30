#!/usr/bin/env bash
set -euo pipefail

# OpenDeploy Lite (Bash wrapper)
# Delegates deploy to official CLIs while letting you keep a single command.
# Usage:
#   opd start --path <app_dir> --provider <vercel|cloudflare-pages|github-pages> [--env preview|production] [--output <dir>] [--prod]

command="start"
path="."
provider="vercel"
env="preview"
output=""
prod=false

usage() {
  cat <<'HELP'
OpenDeploy Lite (Bash)
Usage:
  opd start --path <app_dir> --provider <vercel|cloudflare-pages|github-pages> [--env preview|production] [--output <dir>] [--prod]
Notes:
- Uses official provider CLIs (vercel, wrangler, gh-pages) under the hood.
- Vercel: requires vercel CLI; set VERCEL_TOKEN for non-interactive deploys.
- Cloudflare Pages: requires wrangler and CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID.
- GitHub Pages: uses npx gh-pages; repo must have a writable remote.
HELP
}

if [[ ${1-} == "-h" || ${1-} == "--help" || ${1-} == "help" ]]; then
  usage; exit 0
fi

if [[ ${1-} ]]; then command="$1"; shift; fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --path) path="$2"; shift 2;;
    --provider) provider="$2"; shift 2;;
    --env) env="$2"; shift 2;;
    --output) output="$2"; shift 2;;
    --prod) prod=true; env="production"; shift;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown option: $1" >&2; usage; exit 1;;
  esac
done

provider=$(echo "$provider" | tr '[:upper:]' '[:lower:]')

[[ -d "$path" ]] || { echo "Path not found: $path" >&2; exit 1; }

case "$command" in
  start)
    case "$provider" in
      vercel)
        if ! command -v vercel >/dev/null 2>&1; then
          echo "Vercel CLI not found. Install: npm i -g vercel" >&2; exit 1
        fi
        args=( --cwd "$path" --yes )
        [[ "$env" == "production" ]] && args+=( --prod )
        [[ -n "${VERCEL_TOKEN:-}" ]] && args+=( --token "$VERCEL_TOKEN" )
        echo "→ vercel ${args[*]}" >&2
        exec vercel "${args[@]}"
        ;;
      cloudflare-pages)
        if ! command -v wrangler >/dev/null 2>&1; then
          echo "Wrangler not found. Install: npm i -g wrangler" >&2; exit 1
        fi
        [[ -n "$output" ]] || output="dist"
        project_name=$(basename "$path")
        cmd=( pages deploy "$output" --project-name "$project_name" )
        [[ "$env" != "production" ]] && cmd+=( --branch preview )
        echo "→ (cd $path && wrangler ${cmd[*]})" >&2
        ( cd "$path" && exec wrangler "${cmd[@]}" )
        ;;
      github-pages)
        [[ -n "$output" ]] || output="dist"
        echo "→ (cd $path && npx gh-pages -d $output)" >&2
        ( cd "$path" && exec npx gh-pages -d "$output" )
        ;;
      *) echo "Unknown provider: $provider" >&2; exit 1;;
    esac
    ;;
  *) echo "Unknown command: $command" >&2; usage; exit 1;;
fi

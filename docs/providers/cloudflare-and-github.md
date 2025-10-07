# Cloudflare Pages and GitHub Pages (Wizard)

OpenDeploy CLI supports Cloudflare Pages and GitHub Pages in the Start wizard alongside Vercel.

## Requirements
- Cloudflare Pages
  - Install Wrangler and log in: `wrangler login`
- GitHub Pages
  - A Git remote named `origin` that points to GitHub.
  - Permission to push to the repository (for `gh-pages`).

## Quick Start
- Cloudflare Pages
```
opd start --provider cloudflare --env prod
```
- GitHub Pages
```
opd start --provider github --env prod
```

## How it works
- The wizard uses provider plugins:
  - Cloudflare Pages plugin runs `wrangler pages deploy` under the hood.
  - GitHub Pages plugin pushes your artifact directory to the `gh-pages` branch via `gh-pages`.
- The wizard prints a final URL and emits JSON/NDJSON events when flags are set.

## Tips
- Ensure your static output exists (e.g., `dist/`), or let the wizard suggest a publish directory.
- For CI, prefer a prebuilt `opd-go` sidecar for robust streaming and timeouts.
- Use `--json` for structured summaries or `--ndjson` for streaming events.

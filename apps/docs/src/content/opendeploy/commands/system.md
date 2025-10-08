# System Commands

## Shortcuts

- `opd -v` — version (alias of `--version`)
- `opd -h` — help (alias of `--help`)
- `opd -s` — start wizard (equivalent to `opd start`)

## start
Guided wizard for selecting framework, provider, environment, optional env sync, and deploying.

Usage:
```bash
opd start [--framework <next|astro|sveltekit>] \
  [--provider <vercel|cloudflare|github>] [--env <prod|preview>] \
  [--path <dir>] [--project <id>] [--org <id>] \
  [--sync-env] [--dry-run] [--json] [--ci] [--no-save-defaults]
```

Behavior:
- Auto-detects frameworks when possible; otherwise prompts for a choice.
- Shows provider login status and offers one‑click login if required.
- Env sync is optional; when enabled, the wizard chooses a sensible `.env` file per target.
- Prints a final JSON summary `{ ok, provider, target, url?, logsUrl?, final: true }` when `--json` is used.
- With `--dry-run`, the wizard prints `{ ok: true, mode: 'dry-run', final: true }` and exits before syncing/deploying.
- If you pass `--project`/`--org` (Vercel) and the directory is not linked yet, the wizard offers to run `vercel link` inline.
- After deployment, the wizard prints a copyable non‑interactive command showing an equivalent `opd up ...` invocation.

Notes:
- The deploy step reuses the same logic as `up` for parity.
- Non‑interactive usage is supported with flags.
- Defaults: When confirmed, the wizard stores your selections under `startDefaults` in the root `opendeploy.config.json`. To clear, delete the file or remove the `startDefaults` property. Use `--no-save-defaults` to suppress the save prompt.

### Sidecar & experimental flags

You can optionally enable the Go sidecar and experimental provider features:

- `OPD_GO_FORCE=1` — prefer the Go sidecar when present (more reliable process control)
- `OPD_GO_DISABLE=1` — disable the sidecar and use the Node runner
- `OPD_PTY=1|0` — force PTY usage on/off; by default, PTY is used in interactive terminals but disabled in CI/JSON modes
<!-- Netlify-related flags removed -->

### Start wizard summary fields (JSON)

When `--json` (or `--ndjson`) is enabled, the final summary line includes at least:

```json
{
  "ok": true,
  "action": "start",
  "provider": "<vercel|cloudflare|github>",
  "target": "<prod|preview>",
  "mode": "deploy" | "prepare-only" | "workflow-only",
  "url": "<deployment or site URL, if available>",
  "logsUrl": "<dashboard/inspect URL, if available>",
  "final": true
}
```

Provider examples:

- Vercel (preview deploy):

```json
{
  "ok": true,
  "action": "start",
  "provider": "vercel",
  "target": "preview",
  "mode": "deploy",
  "url": "https://my-app-abc.vercel.app",
  "logsUrl": "https://vercel.com/acme/my-app/inspect/dep_123",
  "final": true
}
```

<!-- Netlify example removed -->

If `--deploy` is used, `mode` becomes `deploy` and `url` is included when available.

- Cloudflare Pages (deploy):

```json
{
  "ok": true,
  "action": "start",
  "provider": "cloudflare",
  "target": "preview",
  "mode": "deploy",
  "url": "https://my-app.pages.dev",
  "logsUrl": "https://dash.cloudflare.com/?to=/:account/pages/view/my-app",
  "final": true
}
```

- GitHub Pages (Actions workflow-only):

```json
{
  "ok": true,
  "action": "start",
  "provider": "github",
  "target": "prod",
  "mode": "workflow-only",
  "workflowPath": ".github/workflows/deploy-pages.yml",
  "actionsUrl": "https://github.com/<owner>/<repo>/actions/workflows/deploy-pages.yml",
  "final": true
}
```

## detect
Detect a Next.js app and its configuration.

Usage:
```bash
opd detect [--json]
```
Output fields:
- framework, rootDir, appDir, hasAppRouter
- packageManager (pnpm | yarn | npm | bun)
- monorepo (turborepo | nx | workspaces | none)
- buildCommand, outputDir, environmentFiles

Notes:
- With `--json`, only JSON is printed.

## doctor
Validate local environment and provider CLIs.

Usage:
```bash
opd doctor [--ci] [--json] [--verbose] [--fix] [--path <dir>] [--project <vercelProjectId>] [--org <orgId>]
```
Checks:
- Node version
- pnpm, bun, vercel CLIs
- Auth for Vercel
- Monorepo sanity (workspace lockfile, `.vercel/project.json`, optional root `vercel.json`)
- Monorepo linked apps scan (`apps/*`) and chosen deploy cwd advisories for common paths (e.g., `apps/web`).

Notes:
- With `--json`, only JSON is printed. `--ci` exits non‑zero if any check fails.
- With `--fix`, the CLI attempts best‑effort linking fixes:
  - Vercel: `vercel link --yes --project <id> [--org <id>]` when `--project` is provided

## completion
Generate shell completion scripts for bash, zsh, or PowerShell.

Usage:
```bash
opd completion --shell <bash|zsh|pwsh>
```

Install (user-local examples):

- Bash (Linux/macOS):
```bash
# macOS (Homebrew bash-completion):
opd completion --shell bash > $(brew --prefix)/etc/bash_completion.d/opd
# Generic (user):
opd completion --shell bash > ~/.opd-completion.bash
echo 'source ~/.opd-completion.bash' >> ~/.bashrc
```

- Zsh:
```bash
opd completion --shell zsh > ~/.opd-completion.zsh
echo 'fpath=(~/.zfunc $fpath)' >> ~/.zshrc
mkdir -p ~/.zfunc
mv ~/.opd-completion.zsh ~/.zfunc/_opd
echo 'autoload -U compinit && compinit' >> ~/.zshrc
```

- PowerShell (Windows/macOS/Linux):
```powershell
opd completion --shell pwsh | Out-File -FilePath $PROFILE -Append -Encoding utf8
# Restart PowerShell
```

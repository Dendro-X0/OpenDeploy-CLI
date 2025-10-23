# System Commands

## Shortcuts

- `opd -v` — version (alias of `--version`)
- `opd -h` — help (alias of `--help`)
- `opd -s` — start wizard (equivalent to `opd start`)

## start
Guided wizard for selecting framework, provider, environment, optional env sync, and deploying.

Usage:
```bash
opd start [--framework <next|astro|sveltekit|remix|expo>] \
  [--provider <vercel|cloudflare|github>] [--env <prod|preview>] \
  [--path <dir>] [--project <id>] [--org <id>] \
  [--sync-env] [--dry-run] [--json] [--ci] [--no-save-defaults] [--minimal] \
  [--build-timeout-ms <ms>] [--build-dry-run]
```

Behavior:
- Auto-detects frameworks when possible; otherwise prompts for a choice.
- Shows provider login status and offers one‑click login if required.
- Env sync is optional; when enabled, the wizard chooses a sensible `.env` file per target.
- Prints a final JSON summary `{ ok, provider, target, url?, logsUrl?, final: true }` when `--json` is used.
- With `--dry-run`, the wizard prints `{ ok: true, mode: 'dry-run', final: true }` and exits before syncing/deploying.
- If you pass `--project`/`--org` (Vercel) and the directory is not linked yet, the wizard offers to run `vercel link` inline.
- After deployment, the wizard prints a copyable non‑interactive command showing an equivalent `opd up ...` invocation.
- Minimal preset (`--minimal`): non‑interactive defaults for first‑time deploys. Detects framework and chooses provider automatically (GitHub Pages when Next.js static export is detected via `next.config.*: { output: 'export' }`, otherwise Vercel). Prints a concise summary in human mode and a final JSON line when `--json` is set.

Notes:
- The deploy step reuses the same logic as `up` for parity.
- Non‑interactive usage is supported with flags.
- Defaults: When confirmed, the wizard stores your selections under `startDefaults` in the root `opendeploy.config.json`. To clear, delete the file or remove the `startDefaults` property. Use `--no-save-defaults` to suppress the save prompt.
 - NDJSON mode (`--ndjson` or `OPD_NDJSON=1`) suppresses human UI and emits only NDJSON events and a final JSON summary. Set `OPD_STRICT_PLUGIN_VERSION=1` to hard‑fail on plugin API version mismatches.

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
Detect your app and its configuration (Next, Astro, SvelteKit, Remix, Expo).

Usage:
```bash
opd detect [--scan] [--json]
```
Output fields:
- framework, rootDir, appDir, hasAppRouter
- packageManager (pnpm | yarn | npm | bun)
- monorepo (turborepo | nx | workspaces | none)
- buildCommand, outputDir, environmentFiles

Notes:
- `--scan` lists monorepo candidate app directories and their frameworks (sourced from common folders and workspace globs). In `--json`, prints `{ candidates: [{ path, framework }] }`.
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

## ci logs

Show or follow GitHub Actions logs for the latest run on the current branch. Prints direct run URLs and emits GitHub annotations on failures.

Usage:

```bash
opd ci logs [--workflow <file>] [--follow] [--json]
```

Behavior:

- Auto-detects repository from `GITHUB_REPOSITORY` or `git remote get-url origin`.
- Auto-detects branch from `GITHUB_HEAD_REF`/`GITHUB_REF_NAME`, or falls back to the current Git branch; if detached, uses the origin default branch.
- Prints the direct run URL, e.g. `https://github.com/<owner>/<repo>/actions/runs/<id>`.
- With `--follow`, tails the latest run until completion and exits non‑zero on failure.
- On failures, prints `::error ::CI run failed: <url>` to enable GitHub Annotations in Actions.

Examples:

```bash
# Show latest run for the default workflow (ci.yml)
opd ci logs

# Follow the latest run until completion
opd ci logs --follow

# Use a specific workflow file name
opd ci logs --workflow deploy-pages.yml

# JSON summary (machine‑readable)
opd ci logs --json
```

Notes:

- Requires GitHub CLI (`gh`); install on Windows via `winget install GitHub.cli`.
- In `--json` mode, the final object includes `{ ok, repo, branch, workflow, id, url, status, conclusion, final: true }`.

## ci open

Open the most recent GitHub Actions run in your default browser. You can scope to a PR or a workflow file.

Usage:

```bash
opd ci open [--workflow <file>] [--pr <number>] [--json]
```

Behavior:

- Resolves repo automatically; optionally resolves branch from a PR number.
- Opens the URL using the OS default opener (`start` on Windows, `open` on macOS, `xdg-open` on Linux).
- In `--json` mode, prints `{ ok, repo, branch?, workflow?, id, url, status, conclusion, final: true }`.

Examples:

```bash
opd ci open
opd ci open --pr 42
opd ci open --workflow ci.yml
```

## ci dispatch

Trigger a workflow run. Safeguarded—requires `--yes`.

Usage:

```bash
opd ci dispatch --workflow <file> [--ref <ref>] [--inputs k=v,...] [--yes] [--json]
```

Behavior:

- Requires GitHub CLI (`gh`).
- Refuses to run unless `--yes` is present to prevent accidental triggers.
- `--inputs` accepts comma-separated `key=value` pairs and passes them via `--raw-field` to `gh`.
- In `--json` mode, prints `{ ok, repo, workflow, ref, final: true }`.

Examples:

```bash
opd ci dispatch --workflow ci.yml --yes
opd ci dispatch --workflow deploy-docs.yml --ref main --inputs site=docs,region=us --yes
```

## ci last

Show the most recent GitHub Actions run across any branch. Optionally scope to a PR (by head branch) or a specific workflow.

Usage:

```bash
opd ci last [--workflow <file>] [--pr <number>] [--json]
```

Notes:

- Prints the direct run URL and a compact JSON summary in `--json` mode.

## ci summarize

Produce a compact summary of the latest run for a workflow, including failing jobs and short error excerpts. Ensures the latest run summary and job logs are synced locally for IDE inspection.

Usage:

```bash
opd ci summarize [--workflow <file>] [--out <dir>] [--pr <number>] [--json]
```

Notes:

- Logs are stored under `./.artifacts/ci-logs/<workflow>/<runId>/`.
- VSCode task: "CI: Summarize latest (ci.yml)" is included in `.vscode/tasks.json`.

## ci sync

Download the latest run summary and per-job logs for a workflow into a local directory for IDE debugging.

Usage:

```bash
opd ci sync [--workflow <file>] [--out <dir>] [--follow] [--pr <number>] [--json]
```

Notes:

- With `--follow`, re-syncs until the run completes.
- Output directory defaults to `./.artifacts/ci-logs`.

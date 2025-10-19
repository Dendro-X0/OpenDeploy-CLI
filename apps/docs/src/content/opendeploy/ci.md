# CI Helpers

OpenDeploy provides CI-friendly commands to view and follow GitHub Actions runs right from your terminal. These commands print direct URLs, auto-detect repo and branch reliably, and emit GitHub Annotations on failures to improve PR feedback.

## Security Guard

Block risky configurations and potential secret leaks automatically on PRs and pushes.

- Validates Security Health via `opendeploy doctor --json --ci --strict`.
- Scans the repository via `opendeploy scan --json --strict`.

Example workflow (created at `.github/workflows/opendeploy-security-guard.yml`):

```yaml
name: OpenDeploy Security Guard

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ '**' ]

jobs:
  guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - run: pnpm install --frozen-lockfile
      - run: pnpm -C packages/cli build
      - name: Doctor (strict)
        env: { OPD_FORCE_CI: '1' }
        run: node packages/cli/dist/index.js doctor --json --ci --strict
      - name: Scan (strict)
        env: { OPD_FORCE_CI: '1' }
        run: node packages/cli/dist/index.js scan --json --strict
```

Notes:
- In CI, redaction is enforced and project-local cache paths are disabled automatically.
- Customize excludes and test inclusion via `opendeploy.scan.json`.

## Commands

### `ci logs`

Show or follow GitHub Actions logs for the latest run on the current branch (or for a PR).

Usage:

```bash
opd ci logs [--workflow <file>] [--follow] [--pr <number>] [--json]
```

Options:

- `--workflow <file>`: workflow file (e.g., `ci.yml`, `deploy-pages.yml`). Defaults to `ci.yml`.
- `--follow`: watch the latest run until completion, then exit 0/1 based on the conclusion.
- `--pr <number>`: scope to a PR by number (resolves the head branch automatically).
- `--json`: print a structured JSON summary `{ ok, repo, branch, workflow, id, url, status, conclusion, final: true }`.

Examples:

```bash
# Show the latest run URL for ci.yml on the current branch
opd ci logs

# Follow until completion; exit non-zero on failure
opd ci logs --follow

# Scope to PR #123 (resolves its head branch) and show last run
opd ci logs --pr 123

# Machine-readable summary for tooling
opd ci logs --json
```

Screenshots:

<img src="/screenshots/ci-logs-latest.png" alt="Latest run printed with direct URL" />
<img src="/screenshots/ci-logs-follow.png" alt="Following a run until completion" />

Notes:

- On failures (non-success conclusions), the command prints `::error ::CI run failed: <url>` which GitHub Actions recognizes as an annotation.
- Repository is auto-detected from `GITHUB_REPOSITORY` or `git remote get-url origin`.
- Branch is resolved from `GITHUB_HEAD_REF`/`GITHUB_REF_NAME`, or the current branch; if in detached HEAD, it falls back to the origin default branch.
- Requires GitHub CLI (`gh`). On Windows, install with `winget install GitHub.cli`.

---

### `ci last`

Show the most recent GitHub Actions run across any branch. Optionally scope to a PR (by head branch) or a specific workflow.

Usage:

```bash
opd ci last [--workflow <file>] [--pr <number>] [--json]
```

Examples:

```bash
# Most recent run across any branch
opd ci last

# Most recent run for a specific workflow file
opd ci last --workflow deploy-pages.yml

# Most recent run for PR #123 (uses PR head branch)
opd ci last --pr 123
```

Screenshots:

<img src="/screenshots/ci-last.png" alt="Most recent run with direct URL" />

JSON example:

```json
{
  "ok": true,
  "action": "ci-last",
  "repo": "acme/widgets",
  "branch": "feature/login",
  "workflow": "ci.yml",
  "id": 123456789,
  "url": "https://github.com/acme/widgets/actions/runs/123456789",
  "status": "completed",
  "conclusion": "success",
  "final": true
}
```

---

### `ci open`

Open the most recent run URL in your default browser. You can scope to a PR or a specific workflow file.

Usage:

```bash
opd ci open [--workflow <file>] [--pr <number>] [--json]
```

Notes:

- Uses the OS default opener (`start` on Windows, `open` on macOS, `xdg-open` on Linux).
- In `--json` mode, prints the resolved URL and run metadata.

Examples:

```bash
# Open latest run
opd ci open

# Open latest run for PR #123
opd ci open --pr 123

# Open latest run for a specific workflow file
opd ci open --workflow deploy-pages.yml
```

---

### `ci dispatch`

Trigger a workflow run. Safeguarded: requires `--yes`.

Usage:

```bash
opd ci dispatch --workflow <file> [--ref <ref>] [--inputs k=v,...] [--yes] [--json]
```

Notes:

- Requires GitHub CLI (`gh`) with repo access.
- `--inputs` takes comma-separated key=value pairs; they are passed via `--raw-field`.
- Refuses to run without `--yes` to prevent accidental triggers.

Examples:

```bash
# Dispatch default branch
opd ci dispatch --workflow ci.yml --yes

# Dispatch a specific ref with inputs
opd ci dispatch --workflow deploy-docs.yml --ref main --inputs site=docs,region=us --yes
```

---

### `ci summarize`

Produce a compact summary of the latest run for a workflow, including failing jobs and short error excerpts. Ensures the latest run summary and job logs are synced locally for IDE inspection.

Usage:

```bash
opd ci summarize [--workflow <file>] [--out <dir>] [--pr <number>] [--json]
```

Options:

- `--workflow <file>`: workflow file (e.g., `ci.yml`). Defaults to `ci.yml`.
- `--out <dir>`: output folder for synced logs (default `.artifacts/ci-logs`).
- `--pr <number>`: scope to a PR (uses its head branch).
- `--json`: print a structured JSON summary `{ ok, repo, branch, workflow, id, url, failures[], final: true }`.

Examples:

```bash
# Summarize the latest CI run for ci.yml
opd ci summarize

# Machine-readable summary for tooling
opd ci summarize --json

# Summarize a PR's latest run
opd ci summarize --pr 123
```

Notes:

- Stores logs at `./.artifacts/ci-logs/<workflow>/<runId>/`.
- Each failing job includes up to 10 error lines; if none are detected, the tail of the log is shown.
- Requires GitHub CLI (`gh`). On Windows, install with `winget install GitHub.cli`.

---

## GitHub Actions Integration

Use `ci logs --follow` in troubleshooting jobs to stream and annotate errors; or call `ci last --json` to record outcomes.

```yaml
name: CI (Troubleshooting)

on: workflow_dispatch

jobs:
  tail:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: corepack enable && corepack prepare pnpm@10.13.1 --activate
      - run: pnpm install --frozen-lockfile
      - name: Build OpenDeploy
        run: pnpm --filter "./packages/cli" build
      - name: Follow latest run on this branch
        run: |
          opd ci logs --follow
```

## Tips

- Use `--json` and sink to a file with `--json-file` or `OPD_JSON_FILE` to retain a compact audit of CI activity.
- Combine with `--timestamps` for time-series logs.
- Add screenshots under `apps/docs/public/screenshots/` using the paths referenced above.

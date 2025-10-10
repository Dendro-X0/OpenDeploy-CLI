import { Command } from 'commander'
import { logger } from '../utils/logger'
import { proc } from '../utils/process'
import { join } from 'node:path'

interface CiLogsOptions {
  readonly workflow?: string
  readonly follow?: boolean
  readonly json?: boolean
  readonly pr?: string
}

function parseRepoFromGitUrl(url: string): string | undefined {
  const https = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/i)
  if (https) return `${https[1]}/${https[2]}`
  const ssh = url.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/i)
  if (ssh) return `${ssh[1]}/${ssh[2]}`
  return undefined
}

async function resolveRepo(): Promise<string | undefined> {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY
  try {
    const out = await proc.run({ cmd: 'git remote get-url origin', cwd: process.cwd() })
    if (out.ok) return parseRepoFromGitUrl(out.stdout.trim())
  } catch { /* ignore */ }
  return undefined
}

/**
 * Resolve current branch from environment or Git.
 * @returns Branch name or 'main' if unknown
 */
async function resolveBranch(): Promise<string> {
  const envRef: string | undefined = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME
  if (envRef && envRef.trim().length > 0) return envRef.trim()
  // Try normal branch name
  const cur = await proc.run({ cmd: 'git rev-parse --abbrev-ref HEAD', cwd: process.cwd() })
  const branch1: string | undefined = cur.ok ? cur.stdout.trim() : undefined
  if (branch1 && branch1 !== 'HEAD') return branch1
  // Detached HEAD: derive origin default branch
  const head = await proc.run({ cmd: 'git symbolic-ref refs/remotes/origin/HEAD', cwd: process.cwd() })
  if (head.ok) {
    const m = head.stdout.trim().match(/origin\/(.+)$/)
    const b = m?.[1]
    if (b && b.length > 0) return b
  }
  return 'main'
}

/**
 * Check if GitHub CLI (gh) is installed.
 * @returns true if installed, false otherwise
 */
async function ghExists(): Promise<boolean> {
  const cmd = process.platform === 'win32' ? 'where gh' : 'command -v gh'
  const out = await proc.run({ cmd })
  return out.ok && out.stdout.trim().length > 0
}

/**
 * Get latest GitHub Actions run information.
 * @param args Repository, branch, and workflow
 * @returns Run information or undefined
 */
type GhRunInfo = { readonly id: number; readonly status?: string; readonly conclusion?: string; readonly branch?: string }

async function getLatestRun(args: { readonly repo: string; readonly branch?: string; readonly workflow?: string }): Promise<GhRunInfo | undefined> {
  const cmd: string = `gh run list --repo ${args.repo} ${args.branch ? `-b ${args.branch}` : ''} ${args.workflow ? `--workflow ${args.workflow}` : ''} -L 1 --json databaseId,status,conclusion,headBranch`
  const res = await proc.run({ cmd, cwd: process.cwd() })
  if (!res.ok) return undefined
  try {
    const arr = JSON.parse(res.stdout) as Array<{ databaseId?: number; status?: string; conclusion?: string; headBranch?: string }>
    const r = arr?.[0]
    if (!r || typeof r.databaseId !== 'number') return undefined
    return { id: r.databaseId, status: r.status, conclusion: r.conclusion, branch: r.headBranch }
  } catch { return undefined }
}

/**
 * Get GitHub Actions run URL.
 * @param repo Repository name
 * @param id Run ID
 * @returns Run URL
 */
function runUrl(repo: string, id: number): string { return `https://github.com/${repo}/actions/runs/${id}` }

/**
 * Emit GitHub Actions annotation.
 * @param kind Annotation kind (error or warning)
 * @param msg Annotation message
 */
function emitAnnotation(kind: 'error' | 'warning', msg: string): void {
  // GitHub Actions annotation format; safe to print elsewhere (no-ops)
  // eslint-disable-next-line no-console
  console.log(`::${kind} ::${msg}`)
}

function platformOpen(url: string): Promise<{ ok: boolean }> {
  const isWin: boolean = process.platform === 'win32'
  const isMac: boolean = process.platform === 'darwin'
  const cmd: string = isWin ? `start "" "${url}"` : (isMac ? `open "${url}"` : `xdg-open "${url}"`)
  return proc.run({ cmd }).then(r => ({ ok: r.ok }))
}

/**
 * Register CI log helpers (GitHub Actions).
 */
export function registerCiLogsCommand(program: Command): void {
  const ci = program.command('ci').description('CI helpers')
  ci
    .command('logs')
    .description('Show or follow GitHub Actions logs for the latest run on this branch (prints direct URLs)')
    .option('--workflow <file>', 'Workflow file name (e.g., ci.yml, pages.yml)', 'ci.yml')
    .option('--follow', 'Follow the latest run until completion')
    .option('--json', 'Emit structured JSON summary')
    .option('--pr <number>', 'Scope to a given PR number (resolves head branch)')
    .action(async (opts: CiLogsOptions): Promise<void> => {
      const repo = await resolveRepo()
      if (!repo) {
        const msg = 'Unable to resolve GitHub repo. Set GITHUB_REPOSITORY or add a git origin remote.'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-logs', message: msg, final: true })
        else logger.error(msg)
        process.exitCode = 1
        return
      }
      const hasGh = await ghExists()
      if (!hasGh) {
        const msg = 'GitHub CLI (gh) not found. Install via: winget install GitHub.cli'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-logs', repo, suggestion: 'install gh', final: true })
        else logger.error(msg)
        process.exitCode = 1
        return
      }
      // Resolve branch from PR when provided; otherwise autodetect
      let branch: string | undefined
      if (opts.pr) {
        const prRes = await proc.run({ cmd: `gh pr view ${opts.pr} --repo ${repo} --json headRefName`, cwd: process.cwd() })
        if (prRes.ok) {
          try { const js = JSON.parse(prRes.stdout) as { headRefName?: string }; if (js?.headRefName) branch = js.headRefName } catch { /* ignore */ }
        }
      }
      if (!branch) branch = await resolveBranch()
      const wf = String(opts.workflow || 'ci.yml')
      if (opts.follow) {
        const first = await getLatestRun({ repo, branch, workflow: wf })
        if (first) logger.info(`Run: ${runUrl(repo, first.id)}`)
        await proc.run({ cmd: `gh run watch --repo ${repo} --exit-status --interval 5`, cwd: process.cwd() })
        const last = await getLatestRun({ repo, branch, workflow: wf })
        if (last) {
          const url: string = runUrl(repo, last.id)
          const ok: boolean = (last.conclusion ?? '').toLowerCase() === 'success'
          if (opts.json) logger.jsonPrint({ ok, action: 'ci-logs', repo, branch, workflow: wf, id: last.id, url, status: last.status, conclusion: last.conclusion, follow: true, final: true })
          else logger.info(`${ok ? 'Success' : 'Done'}: ${url}`)
          if (!ok) emitAnnotation('error', `CI run failed: ${url}`)
          if (!ok) process.exitCode = 1
        } else {
          if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-logs', repo, branch, workflow: wf, message: 'No runs found after watch', final: true })
          else logger.warn('No runs found after watch')
        }
        return
      }
      const info = await getLatestRun({ repo, branch, workflow: wf })
      if (!info) {
        const msg = 'No runs found (trigger a workflow first).'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-logs', repo, branch, workflow: wf, message: msg, final: true })
        else logger.warn(msg)
        return
      }
      const url = runUrl(repo, info.id)
      const ok = (info.conclusion ?? '').toLowerCase() !== 'failure'
      if (opts.json) logger.jsonPrint({ ok, action: 'ci-logs', repo, branch, workflow: wf, id: info.id, url, status: info.status, conclusion: info.conclusion, final: true })
      else logger.info(`${info.status ?? 'status: unknown'} — ${url}`)
      if (!ok) emitAnnotation('error', `CI run failed: ${url}`)
      if (!ok) process.exitCode = 1
    })

  // ci last — most recent run regardless of branch; optional --workflow and --pr
  ci
    .command('last')
    .description('Show the most recent GitHub Actions run (any branch); optionally scope to a PR or workflow')
    .option('--workflow <file>', 'Workflow file name (e.g., ci.yml, pages.yml)')
    .option('--pr <number>', 'Scope to a given PR number (resolves head branch)')
    .option('--json', 'Emit structured JSON summary')
    .action(async (opts: { readonly workflow?: string; readonly pr?: string; readonly json?: boolean }): Promise<void> => {
      const repo = await resolveRepo()
      if (!repo) {
        const msg = 'Unable to resolve GitHub repo. Set GITHUB_REPOSITORY or add a git origin remote.'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-last', message: msg, final: true })
        else logger.error(msg)
        process.exitCode = 1
        return
      }
      const hasGh = await ghExists()
      if (!hasGh) {
        const msg = 'GitHub CLI (gh) not found. Install via: winget install GitHub.cli'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-last', repo, suggestion: 'install gh', final: true })
        else logger.error(msg)
        process.exitCode = 1
        return
      }
      // Optional PR scoping → resolve branch; otherwise no branch filter
      let branch: string | undefined
      if (opts.pr) {
        const prRes = await proc.run({ cmd: `gh pr view ${opts.pr} --repo ${repo} --json headRefName`, cwd: process.cwd() })
        if (prRes.ok) {
          try { const js = JSON.parse(prRes.stdout) as { headRefName?: string }; if (js?.headRefName) branch = js.headRefName } catch { /* ignore */ }
        }
      }
      const wf: string | undefined = opts.workflow
      const info = await getLatestRun({ repo, branch, workflow: wf })
      if (!info) {
        const msg = 'No runs found (trigger a workflow first).'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-last', repo, branch, workflow: wf, message: msg, final: true })
        else logger.warn(msg)
        return
      }
      const url = runUrl(repo, info.id)
      const ok = (info.conclusion ?? '').toLowerCase() !== 'failure'
      if (opts.json) logger.jsonPrint({ ok, action: 'ci-last', repo, branch, workflow: wf, id: info.id, url, status: info.status, conclusion: info.conclusion, final: true })
      else logger.info(`${info.status ?? 'status: unknown'} — ${url}`)
      if (!ok) emitAnnotation('error', `CI run failed: ${url}`)
      if (!ok) process.exitCode = 1
    })

  // ci open — open the latest run URL (optionally scope to workflow/pr)
  ci
    .command('open')
    .description('Open the most recent GitHub Actions run in your browser (optionally scope to a workflow or PR)')
    .option('--workflow <file>', 'Workflow file name (e.g., ci.yml, pages.yml)')
    .option('--pr <number>', 'Scope to a given PR number (resolves head branch)')
    .option('--json', 'Emit structured JSON summary')
    .action(async (opts: { readonly workflow?: string; readonly pr?: string; readonly json?: boolean }): Promise<void> => {
      const repo = await resolveRepo()
      if (!repo) {
        const msg = 'Unable to resolve GitHub repo. Set GITHUB_REPOSITORY or add a git origin remote.'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-open', message: msg, final: true })
        else logger.error(msg)
        process.exitCode = 1
        return
      }
      const hasGh = await ghExists()
      if (!hasGh) {
        const msg = 'GitHub CLI (gh) not found. Install via: winget install GitHub.cli'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-open', repo, suggestion: 'install gh', final: true })
        else logger.error(msg)
        process.exitCode = 1
        return
      }
      let branch: string | undefined
      if (opts.pr) {
        const prRes = await proc.run({ cmd: `gh pr view ${opts.pr} --repo ${repo} --json headRefName`, cwd: process.cwd() })
        if (prRes.ok) {
          try { const js = JSON.parse(prRes.stdout) as { headRefName?: string }; if (js?.headRefName) branch = js.headRefName } catch { /* ignore */ }
        }
      }
      const wf: string | undefined = opts.workflow
      const info = await getLatestRun({ repo, branch, workflow: wf })
      if (!info) {
        const msg = 'No runs found (trigger a workflow first).'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-open', repo, branch, workflow: wf, message: msg, final: true })
        else logger.warn(msg)
        return
      }
      const url = runUrl(repo, info.id)
      const opened = await platformOpen(url)
      if (opts.json) logger.jsonPrint({ ok: opened.ok, action: 'ci-open', repo, branch, workflow: wf, id: info.id, url, status: info.status, conclusion: info.conclusion, final: true })
      else logger.info(`Opened: ${url}`)
      if (!opened.ok) process.exitCode = 1
    })

  // ci dispatch — trigger a workflow
  ci
    .command('dispatch')
    .description('Dispatch a GitHub Actions workflow (safeguarded). Requires --yes to proceed.')
    .option('--workflow <file>', 'Workflow file name (e.g., ci.yml, pages.yml)')
    .option('--ref <ref>', 'Git ref to run on', 'main')
    .option('--inputs <k=v,...>', 'Comma-separated inputs (use key=value pairs)')
    .option('--yes', 'Confirm dispatch without prompting')
    .option('--json', 'Emit structured JSON summary')
    .action(async (opts: { readonly workflow?: string; readonly ref?: string; readonly inputs?: string; readonly yes?: boolean; readonly json?: boolean }): Promise<void> => {
      const repo = await resolveRepo()
      if (!repo) {
        const msg = 'Unable to resolve GitHub repo. Set GITHUB_REPOSITORY or add a git origin remote.'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-dispatch', message: msg, final: true })
        else logger.error(msg)
        process.exitCode = 1
        return
      }
      const hasGh = await ghExists()
      if (!hasGh) {
        const msg = 'GitHub CLI (gh) not found. Install via: winget install GitHub.cli'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-dispatch', repo, suggestion: 'install gh', final: true })
        else logger.error(msg)
        process.exitCode = 1
        return
      }
      const wf: string | undefined = opts.workflow
      if (!wf) {
        const msg = 'Missing --workflow <file>. Specify a workflow filename (e.g., ci.yml).'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-dispatch', repo, message: msg, final: true })
        else logger.error(msg)
        process.exitCode = 1
        return
      }
      if (!opts.yes) {
        const msg = 'Refusing to dispatch without --yes. Re-run with --yes to proceed.'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-dispatch', repo, workflow: wf, message: msg, final: true })
        else logger.warn(msg)
        process.exitCode = 1
        return
      }
      const ref: string = opts.ref || 'main'
      const fields: string[] = []
      if (opts.inputs) {
        for (const kv of opts.inputs.split(',')) {
          const [k, v] = kv.split('=')
          if (k && v !== undefined) fields.push(`--raw-field ${k}=${v}`)
        }
      }
      const cmd: string = `gh workflow run ${wf} --repo ${repo} --ref ${ref} ${fields.join(' ')}`.trim()
      const runRes = await proc.run({ cmd, cwd: process.cwd() })
      const ok: boolean = runRes.ok
      if (opts.json) logger.jsonPrint({ ok, action: 'ci-dispatch', repo, workflow: wf, ref, final: true })
      else logger.info(ok ? 'Workflow dispatch requested.' : (runRes.stderr.trim() || 'Workflow dispatch failed.'))
      if (!ok) process.exitCode = 1
    })

  // ci artifacts — list or download artifacts from the latest run
  ci
    .command('artifacts')
    .description('List or download artifacts from the latest GitHub Actions run')
    .option('--workflow <file>', 'Workflow file name (e.g., ci.yml, pages.yml)')
    .option('--pr <number>', 'Scope to a given PR number (resolves head branch)')
    .option('--download', 'Download artifacts instead of listing')
    .option('--name <pattern>', 'Only download artifacts matching name (exact match)')
    .option('--out <dir>', 'Directory to download artifacts into (default ./.artifacts)', '.artifacts')
    .option('--json', 'Emit structured JSON summary')
    .action(async (opts: { readonly workflow?: string; readonly pr?: string; readonly download?: boolean; readonly name?: string; readonly out?: string; readonly json?: boolean }): Promise<void> => {
      const repo = await resolveRepo()
      if (!repo) {
        const msg = 'Unable to resolve GitHub repo. Set GITHUB_REPOSITORY or add a git origin remote.'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-artifacts', message: msg, final: true })
        else logger.error(msg)
        process.exitCode = 1
        return
      }
      const hasGh = await ghExists()
      if (!hasGh) {
        const msg = 'GitHub CLI (gh) not found. Install via: winget install GitHub.cli'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-artifacts', repo, suggestion: 'install gh', final: true })
        else logger.error(msg)
        process.exitCode = 1
        return
      }
      // Resolve branch from PR when provided; otherwise autodetect
      let branch: string | undefined
      if (opts.pr) {
        const prRes = await proc.run({ cmd: `gh pr view ${opts.pr} --repo ${repo} --json headRefName`, cwd: process.cwd() })
        if (prRes.ok) {
          try { const js = JSON.parse(prRes.stdout) as { headRefName?: string }; if (js?.headRefName) branch = js.headRefName } catch { /* ignore */ }
        }
      }
      if (!branch) branch = await resolveBranch()
      const wf: string | undefined = opts.workflow
      const info = await getLatestRun({ repo, branch, workflow: wf })
      if (!info) {
        const msg = 'No runs found (trigger a workflow first).'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-artifacts', repo, branch, workflow: wf, message: msg, final: true })
        else logger.warn(msg)
        return
      }
      const id = info.id
      // List artifacts as JSON for reliability
      const view = await proc.run({ cmd: `gh run view ${id} --repo ${repo} --json artifacts`, cwd: process.cwd() })
      if (!view.ok) {
        const msg = view.stderr.trim() || view.stdout.trim() || 'Failed to query artifacts'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-artifacts', repo, branch, workflow: wf, id, message: msg, final: true })
        else logger.error(msg)
        process.exitCode = 1
        return
      }
      let artifacts: Array<{ readonly name?: string; readonly sizeInBytes?: number }> = []
      try { const js = JSON.parse(view.stdout) as { artifacts?: Array<{ name?: string; sizeInBytes?: number }> }; artifacts = js.artifacts ?? [] } catch { /* ignore */ }
      if (!opts.download) {
        if (opts.json) logger.jsonPrint({ ok: true, action: 'ci-artifacts', repo, branch, workflow: wf, id, artifacts, final: true })
        else {
          if (artifacts.length === 0) logger.info('No artifacts')
          else for (const a of artifacts) logger.info(`• ${a.name ?? 'artifact'}${typeof a.sizeInBytes === 'number' ? ` (${Math.round(a.sizeInBytes/1024)} KiB)` : ''}`)
        }
        return
      }
      // Download
      const outDir: string = opts.out && opts.out.length > 0 ? opts.out : '.artifacts'
      const nameArg = opts.name ? ` --name "${opts.name}"` : ''
      const cmd = `gh run download ${id} --repo ${repo} --dir "${join(process.cwd(), outDir)}"${nameArg}`
      const dl = await proc.run({ cmd, cwd: process.cwd() })
      const ok = dl.ok
      if (opts.json) logger.jsonPrint({ ok, action: 'ci-artifacts', repo, branch, workflow: wf, id, outDir, name: opts.name, final: true })
      else logger.info(ok ? `Downloaded to ${outDir}` : (dl.stderr.trim() || 'Download failed'))
      if (!ok) process.exitCode = 1
    })

  // ci rerun — re-run the most recent run (optionally scoped)
  ci
    .command('rerun')
    .description('Re-run the most recent GitHub Actions run (optionally scope to a workflow or PR)')
    .option('--workflow <file>', 'Workflow file name (e.g., ci.yml, pages.yml)')
    .option('--pr <number>', 'Scope to a given PR number (resolves head branch)')
    .option('--json', 'Emit structured JSON summary')
    .action(async (opts: { readonly workflow?: string; readonly pr?: string; readonly json?: boolean }): Promise<void> => {
      const repo = await resolveRepo()
      if (!repo) {
        const msg = 'Unable to resolve GitHub repo. Set GITHUB_REPOSITORY or add a git origin remote.'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-rerun', message: msg, final: true })
        else logger.error(msg)
        process.exitCode = 1
        return
      }
      const hasGh = await ghExists()
      if (!hasGh) {
        const msg = 'GitHub CLI (gh) not found. Install via: winget install GitHub.cli'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-rerun', repo, suggestion: 'install gh', final: true })
        else logger.error(msg)
        process.exitCode = 1
        return
      }
      let branch: string | undefined
      if (opts.pr) {
        const prRes = await proc.run({ cmd: `gh pr view ${opts.pr} --repo ${repo} --json headRefName`, cwd: process.cwd() })
        if (prRes.ok) {
          try { const js = JSON.parse(prRes.stdout) as { headRefName?: string }; if (js?.headRefName) branch = js.headRefName } catch { /* ignore */ }
        }
      }
      if (!branch) branch = await resolveBranch()
      const wf: string | undefined = opts.workflow
      const info = await getLatestRun({ repo, branch, workflow: wf })
      if (!info) {
        const msg = 'No runs found (trigger a workflow first).'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'ci-rerun', repo, branch, workflow: wf, message: msg, final: true })
        else logger.warn(msg)
        return
      }
      const cmd = `gh run rerun ${info.id} --repo ${repo}`
      const rr = await proc.run({ cmd, cwd: process.cwd() })
      const ok = rr.ok
      if (opts.json) logger.jsonPrint({ ok, action: 'ci-rerun', repo, branch, workflow: wf, id: info.id, final: true })
      else logger.info(ok ? 'Rerun requested.' : (rr.stderr.trim() || 'Rerun failed.'))
      if (!ok) process.exitCode = 1
    })
}

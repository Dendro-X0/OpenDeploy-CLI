import { Command } from 'commander'
import { join } from 'node:path'
import { mkdir, writeFile, appendFile } from 'node:fs/promises'
import { proc } from '../utils/process'
import { logger, isJsonMode } from '../utils/logger'

/**
 * Run PR and Drift workflows locally and capture step-by-step logs to artifacts.
 * Provides concise JSON summaries and human-readable .log files.
 */

type Jsonish = Readonly<Record<string, unknown>>

type RunStepResult = Readonly<{
  readonly cmd: string
  readonly ok: boolean
  readonly code: number
  readonly stdoutPath: string
  readonly stderrPath: string
}>

async function ensureArtifacts(): Promise<string> {
  const dir: string = './.artifacts'
  try { await mkdir(dir, { recursive: true }) } catch { /* ignore */ }
  return dir
}

async function runAndCapture(name: string, cmd: string, baseLog: string): Promise<RunStepResult> {
  const res = await proc.run({ cmd })
  const outFile = `${baseLog}.${name}.stdout.log`
  const errFile = `${baseLog}.${name}.stderr.log`
  try { await writeFile(outFile, res.stdout ?? '', 'utf8') } catch { /* ignore */ }
  try { await writeFile(errFile, res.stderr ?? '', 'utf8') } catch { /* ignore */ }
  return { cmd, ok: !!res.ok, code: typeof res.code === 'number' ? res.code : (res.ok ? 0 : 1), stdoutPath: outFile, stderrPath: errFile }
}

async function appendSection(logPath: string, title: string, body: string): Promise<void> {
  const sep: string = `\n=== ${title} ===\n`
  try { await appendFile(logPath, sep + body + '\n', 'utf8') } catch { /* ignore */ }
}

async function runLocalPr(): Promise<Jsonish> {
  const artifacts = await ensureArtifacts()
  const baseLog = join(artifacts, 'ci-local-pr')
  const mainLog = `${baseLog}.log`
  let steps: RunStepResult[] = []

  await appendSection(mainLog, 'Env', `node: ${process.version}`)
  steps.push(await runAndCapture('pnpm-version', 'pnpm -v', baseLog))
  steps.push(await runAndCapture('install', 'pnpm install --no-frozen-lockfile', baseLog))
  steps.push(await runAndCapture('build-cli', 'pnpm -C packages/cli build', baseLog))
  const prCmd = 'node packages/cli/dist/index.js ci-run pr --json'
  const pr = await runAndCapture('ci-run-pr', prCmd, baseLog)

  const ok = steps.every(s => s.ok) && pr.ok
  const summary: Jsonish = {
    ok,
    action: 'ci-local',
    profile: 'pr',
    steps,
    prJson: '.artifacts/ci-run.last.json',
    log: mainLog,
    final: true,
  }
  try { await writeFile(join(artifacts, 'ci-local-pr.result.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8') } catch { /* ignore */ }
  return summary
}

async function runLocalDrift(): Promise<Jsonish> {
  const artifacts = await ensureArtifacts()
  const baseLog = join(artifacts, 'ci-local-drift')
  const mainLog = `${baseLog}.log`
  let steps: RunStepResult[] = []

  steps.push(await runAndCapture('build-cli', 'pnpm -C packages/cli build', baseLog))
  steps.push(await runAndCapture('ci-generate', 'node packages/cli/dist/index.js ci-generate --profile pr --out ./.artifacts/ci-pr.generated.yml', baseLog))
  const diff = await runAndCapture('ci-diff', 'node packages/cli/dist/index.js ci-diff --profile pr --json', baseLog)

  const ok = steps.every(s => s.ok) && diff.ok
  const summary: Jsonish = {
    ok,
    action: 'ci-local',
    profile: 'drift',
    steps,
    diffJson: '.artifacts/ci-diff.last.json',
    log: mainLog,
    final: true,
  }
  try { await writeFile(join(artifacts, 'ci-local-drift.result.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8') } catch { /* ignore */ }
  return summary
}

export function registerCiLocalCommand(program: Command): void {
  program
    .command('ci-local')
    .description('Run CI workflows locally (pr | drift) and capture logs to ./.artifacts')
    .argument('<workflow>', 'Workflow to run: pr | drift')
    .option('--json', 'Output JSON')
    .action(async (workflow: string, opts: { readonly json?: boolean }): Promise<void> => {
      const which = (workflow === 'drift') ? 'drift' : 'pr'
      const out = which === 'pr' ? await runLocalPr() : await runLocalDrift()
      if (isJsonMode(opts.json)) { logger.json(out); return }
      logger.section(`CI Local ${which.toUpperCase()} Result`)
      logger.info(JSON.stringify(out, null, 2))
    })
}

import { Command } from 'commander'
import { join } from 'node:path'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { proc } from '../utils/process'
import { logger, isJsonMode } from '../utils/logger'

type Jsonish = Readonly<Record<string, unknown>>

type DiffResult = Readonly<{
  readonly workflowPath: string
  readonly similarity: number
  readonly missingInRepo: readonly string[]
  readonly extraInRepo: readonly string[]
}>

async function ensureArtifacts(): Promise<string> {
  const dir: string = './.artifacts'
  try { await mkdir(dir, { recursive: true }) } catch { /* ignore */ }
  return dir
}

function normalizeLines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/g, ''))
    .filter((l) => l.length > 0)
}

function jaccardSimilarity(a: readonly string[], b: readonly string[]): number {
  const A = new Set(a)
  const B = new Set(b)
  const inter = new Set([...A].filter((x) => B.has(x)))
  const union = new Set([...A, ...B])
  return union.size === 0 ? 1 : inter.size / union.size
}

async function listWorkflowFiles(): Promise<string[]> {
  const base: string = './.github/workflows'
  const paths: string[] = []
  try {
    const st = await stat(base)
    if (!st.isDirectory()) return []
    const names = await readdir(base)
    for (const n of names) {
      if (/\.(yml|yaml)$/i.test(n)) paths.push(join(base, n))
    }
  } catch { /* ignore */ }
  return paths
}

async function readText(path: string): Promise<string> {
  try { return await readFile(path, 'utf8') } catch { return '' }
}

async function generateYaml(profile: string, include: string | undefined, outPath: string): Promise<boolean> {
  const base = join(process.cwd(), 'packages', 'cli', 'dist', 'index.js')
  const parts: string[] = ['node', `"${base}"`, 'ci-generate', '--profile', profile, '--out', outPath]
  if (include && include.length > 0) { parts.push('--include', include) }
  const cmd: string = parts.join(' ')
  const res = await proc.run({ cmd })
  return res.ok
}

async function computeDiffs(args: { readonly profile: string; readonly include?: string }): Promise<{ readonly ok: boolean; readonly generatedPath: string; readonly diffs: readonly DiffResult[] }> {
  const artifacts = await ensureArtifacts()
  const genPath = join(artifacts, `ci-${args.profile}.generated.yml`)
  const okGen = await generateYaml(args.profile, args.include, genPath)
  const genText: string = await readText(genPath)
  const genLines: string[] = normalizeLines(genText)
  const files: string[] = await listWorkflowFiles()
  const diffs: DiffResult[] = []
  for (const f of files) {
    const repoText = await readText(f)
    const repoLines = normalizeLines(repoText)
    const sim = jaccardSimilarity(genLines, repoLines)
    const missing = genLines.filter((l) => !repoLines.includes(l)).slice(0, 50)
    const extra = repoLines.filter((l) => !genLines.includes(l)).slice(0, 50)
    diffs.push({ workflowPath: f, similarity: sim, missingInRepo: missing, extraInRepo: extra })
  }
  return { ok: okGen, generatedPath: genPath, diffs }
}

export function registerCiDiffCommand(program: Command): void {
  program
    .command('ci-diff')
    .description('Compare your workflows to ci-generate output and highlight drift')
    .option('--profile <name>', 'Profile: pr|nightly|tag', 'pr')
    .option('--include <jobs>', 'Comma-separated job names to include')
    .option('--json', 'Output JSON')
    .option('--open-artifacts', 'Open artifacts folder after run')
    .action(async (opts: { readonly profile?: string; readonly include?: string; readonly json?: boolean; readonly openArtifacts?: boolean }): Promise<void> => {
      const profile: string = (opts.profile === 'nightly' ? 'nightly' : (opts.profile === 'tag' ? 'tag' : 'pr'))
      const res = await computeDiffs({ profile, include: opts.include })
      const artifacts = await ensureArtifacts()
      const summaryPath = join(artifacts, 'ci-diff.last.json')
      const humanPath = join(artifacts, 'ci-diff.txt')
      const payload: Jsonish = { ok: res.ok, action: 'ci-diff', profile, generated: res.generatedPath, diffs: res.diffs, final: true }
      try { await writeFile(summaryPath, JSON.stringify(payload, null, 2) + '\n', 'utf8') } catch { /* ignore */ }
      try {
        const lines: string[] = []
        lines.push(`Profile: ${profile}`)
        lines.push(`Generated: ${res.generatedPath}`)
        for (const d of res.diffs) {
          lines.push('')
          lines.push(`• Workflow: ${d.workflowPath}`)
          lines.push(`  Similarity: ${(d.similarity * 100).toFixed(1)}%`)
          if (d.missingInRepo.length > 0) {
            lines.push('  Missing in repo (top 10):')
            for (const m of d.missingInRepo.slice(0, 10)) lines.push(`    - ${m}`)
          }
          if (d.extraInRepo.length > 0) {
            lines.push('  Extra in repo (top 10):')
            for (const e of d.extraInRepo.slice(0, 10)) lines.push(`    - ${e}`)
          }
        }
        await writeFile(humanPath, lines.join('\n') + '\n', 'utf8')
      } catch { /* ignore */ }
      const out = { ...payload, summaryJson: summaryPath, summaryTxt: humanPath }
      if (isJsonMode(opts.json)) { logger.json(out); return }
      logger.section('CI Workflow Drift')
      logger.info(JSON.stringify(out, null, 2))
      if (opts.openArtifacts) {
        const isWin: boolean = process.platform === 'win32'
        const isMac: boolean = process.platform === 'darwin'
        const cmd: string = isWin ? 'explorer .\\.artifacts' : (isMac ? 'open ./.artifacts' : 'xdg-open ./.artifacts')
        void proc.run({ cmd })
      }
    })
}

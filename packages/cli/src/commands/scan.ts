import { Command } from 'commander'
import { readdir, stat, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { logger, isJsonMode } from '../utils/logger'
import { computeRedactors } from '../utils/redaction'
import { fsx } from '../utils/fs'

type Finding = { readonly path: string; readonly count: number }
type ScanConfig = { readonly exclude?: readonly string[]; readonly includeTests?: boolean }

function isExcluded(name: string): boolean {
  const b = name.toLowerCase()
  return b === 'node_modules' || b === '.git' || b === '.vercel' || b === '.next' || b === 'coverage' || b === 'dist' || b === '.turbo' || b === '.pnpm-store' || b === '.artifacts' || b === '.opendeploy'
}

function globToRegExp(glob: string): RegExp {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${esc}$`, 'i')
}

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir)
  for (const name of entries) {
    if (isExcluded(name)) continue
    const p = join(dir, name)
    try {
      const s = await stat(p)
      if (s.isDirectory()) { yield* walk(p) } else if (s.isFile()) { yield p }
    } catch { /* ignore */ }
  }
}

function countMatches(text: string, patterns: readonly RegExp[]): number {
  let total = 0
  for (const r of patterns) {
    try {
      const m = text.match(r)
      if (m && m.length > 0) total += m.length
    } catch { /* ignore */ }
  }
  return total
}

export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Scan the working directory for potential secrets (lightweight fallback if gitleaks is unavailable)')
    .option('--json', 'Output JSON results')
    .option('--strict', 'Exit non-zero if any findings are detected')
    .option('--max-size <bytes>', 'Maximum file size to scan (bytes)', '262144')
    .option('--include-tests', 'Also scan test files and directories', false)
    .option('--exclude <globs>', 'Comma-separated glob patterns to exclude (e.g., "**/*.test.ts,**/__tests__/**")')
    .action(async (opts: { json?: boolean; strict?: boolean; maxSize?: string; includeTests?: boolean; exclude?: string }): Promise<void> => {
      const cwd: string = process.cwd()
      const jsonMode: boolean = isJsonMode(opts.json)
      try {
        const maxSize = Math.max(1024, Number(opts.maxSize || '262144'))
        // Load optional config file
        let conf: ScanConfig = {}
        try {
          const cfgPath = join(cwd, 'opendeploy.scan.json')
          if (await fsx.exists(cfgPath)) {
            const raw = await fsx.readJson<unknown>(cfgPath)
            if (raw && typeof raw === 'object') conf = raw as ScanConfig
          }
        } catch { /* ignore bad config */ }
        const excludeGlobs: string[] = []
        // Defaults: skip test files/dirs unless includeTests
        const includeTests: boolean = opts.includeTests === true || conf.includeTests === true
        if (!includeTests) {
          excludeGlobs.push('**/__tests__/**', '**/*.test.*', '**/*.spec.*', '**/tests/**')
        }
        if (opts.exclude) excludeGlobs.push(...opts.exclude.split(',').map(s => s.trim()).filter(Boolean))
        if (Array.isArray(conf.exclude)) excludeGlobs.push(...conf.exclude)
        const excludeRes: RegExp[] = excludeGlobs.map(globToRegExp)
        const patterns = await computeRedactors({ cwd, envFiles: ['.env', '.env.local', '.env.production.local'], includeProcessEnv: false })
        const findings: Finding[] = []
        for await (const file of walk(cwd)) {
          try {
            const rel = file.startsWith(cwd) ? file.slice(cwd.length + 1) : file
            const norm = rel.replace(/\\/g, '/')
            if (excludeRes.some(re => re.test(norm))) continue
            const s = await stat(file)
            if (s.size > maxSize) continue
            const buf = await readFile(file)
            // binary heuristic: contains NUL
            if (buf.includes(0)) continue
            const text = buf.toString('utf8')
            const c = countMatches(text, patterns)
            if (c > 0) findings.push({ path: rel, count: c })
          } catch { /* skip unreadable files */ }
        }
        const total = findings.reduce((a, f) => a + f.count, 0)
        if (jsonMode) {
          logger.json({ action: 'scan', ok: total === 0, totalFindings: total, files: findings, final: true })
        } else {
          if (total === 0) {
            logger.success('Scan: no potential secrets found')
          } else {
            logger.warn(`Scan: ${total} potential matches across ${findings.length} file(s)`) 
            for (const f of findings.slice(0, 20)) logger.warn(` - ${f.path} (${f.count})`)
            if (findings.length > 20) logger.warn(` ... and ${findings.length - 20} more files`)
          }
        }
        if (opts.strict === true && total > 0) process.exitCode = 1
      } catch (err) {
        const msg: string = err instanceof Error ? err.message : String(err)
        if (jsonMode) logger.json({ action: 'scan', ok: false, error: msg, final: true })
        else logger.error(msg)
        process.exitCode = 1
      }
    })
}

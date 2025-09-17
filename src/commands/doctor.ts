import { Command } from 'commander'
import { logger } from '../utils/logger'
import { proc } from '../utils/process'
import { join } from 'node:path'
import { readdir, stat as fsStat } from 'node:fs/promises'
import { fsx } from '../utils/fs'
import { detectMonorepo } from '../core/detectors/monorepo'
import { detectPackageManager } from '../core/detectors/package-manager'
import { mapProviderError } from '../utils/errors'
import { printDoctorSummary } from '../utils/summarize'

interface DoctorOptions { readonly ci?: boolean; readonly json?: boolean; readonly verbose?: boolean }

interface CheckResult { readonly name: string; readonly ok: boolean; readonly message: string }

function parseNodeOk(): boolean {
  const version: string = process.versions.node
  const [majorStr, minorStr] = version.split('.')
  const major: number = Number(majorStr)
  const minor: number = Number(minorStr)
  if (Number.isNaN(major) || Number.isNaN(minor)) return false
  if (major > 18) return true
  if (major === 18 && minor >= 17) return true
  return false
}

async function checkCmdAny(cmds: readonly string[], label: string): Promise<CheckResult> {
  for (const c of cmds) {
    const out = await proc.run({ cmd: `${c} --version` })
    if (out.ok) return { name: `${label} --version`, ok: true, message: out.stdout.trim() }
  }
  return { name: `${label} --version`, ok: false, message: 'not installed or not on PATH' }
}

async function checkVercelAuth(): Promise<CheckResult> {
  const candidates: readonly string[] = process.platform === 'win32' ? ['vercel', 'vercel.cmd'] : ['vercel']
  for (const c of candidates) {
    const out = await proc.run({ cmd: `${c} whoami` })
    if (out.ok && out.stdout.trim().length > 0) return { name: 'vercel auth', ok: true, message: out.stdout.trim() }
  }
  return { name: 'vercel auth', ok: false, message: 'not logged in (run: vercel login)' }
}

async function checkNetlifyAuth(): Promise<CheckResult> {
  const candidates: readonly string[] = process.platform === 'win32' ? ['netlify', 'netlify.cmd'] : ['netlify']
  for (const c of candidates) {
    const out = await proc.run({ cmd: `${c} status` })
    if (out.ok && out.stdout.toLowerCase().includes('logged in')) return { name: 'netlify auth', ok: true, message: out.stdout.trim() }
  }
  return { name: 'netlify auth', ok: false, message: 'not logged in (run: netlify login)' }
}

/**
 * Register the `doctor` command.
 */
export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Validate local environment and provider CLIs')
    .option('--ci', 'CI mode (exit non-zero on warnings)')
    .option('--json', 'Output JSON')
    .option('--verbose', 'Verbose output')
    .action(async (opts: DoctorOptions): Promise<void> => {
      try {
        if (opts.json === true) logger.setJsonOnly(true)
        const results: CheckResult[] = []
        const suggestions: string[] = []
        const nodeOk: boolean = parseNodeOk()
        results.push({ name: 'node >= 18.17', ok: nodeOk, message: process.versions.node })
        const pnpmCandidates: readonly string[] = process.platform === 'win32' ? ['pnpm', 'pnpm.cmd', 'corepack pnpm'] : ['pnpm', 'corepack pnpm']
        const pnpm = await checkCmdAny(pnpmCandidates, 'pnpm')
        results.push(pnpm)
        const bunCandidates: readonly string[] = process.platform === 'win32' ? ['bun', 'bun.exe', 'bun.cmd'] : ['bun']
        const bunCli = await checkCmdAny(bunCandidates, 'bun')
        results.push(bunCli)
        const vercelCandidates: readonly string[] = process.platform === 'win32' ? ['vercel', 'vercel.cmd'] : ['vercel']
        const vercelCli = await checkCmdAny(vercelCandidates, 'vercel')
        results.push(vercelCli)
        const netlifyCandidates: readonly string[] = process.platform === 'win32' ? ['netlify', 'netlify.cmd'] : ['netlify']
        const netlifyCli = await checkCmdAny(netlifyCandidates, 'netlify')
        results.push(netlifyCli)
        // Optional toolchain checks
        const prismaCandidates: readonly string[] = process.platform === 'win32'
          ? ['pnpm exec prisma', 'npx prisma', 'prisma', 'prisma.cmd']
          : ['pnpm exec prisma', 'npx prisma', 'prisma']
        const prismaCli = await checkCmdAny(prismaCandidates, 'prisma (optional)')
        results.push(prismaCli)
        const drizzleCandidates: readonly string[] = process.platform === 'win32'
          ? ['pnpm exec drizzle-kit', 'npx drizzle-kit', 'drizzle-kit', 'drizzle-kit.cmd']
          : ['pnpm exec drizzle-kit', 'npx drizzle-kit', 'drizzle-kit']
        const drizzleCli = await checkCmdAny(drizzleCandidates, 'drizzle-kit (optional)')
        results.push(drizzleCli)
        const psqlCandidates: readonly string[] = process.platform === 'win32' ? ['psql', 'psql.exe'] : ['psql']
        const psqlCli = await checkCmdAny(psqlCandidates, 'psql (optional)')
        results.push(psqlCli)
        const vercelAuth = await checkVercelAuth()
        results.push(vercelAuth)
        const netlifyAuth = await checkNetlifyAuth()
        results.push(netlifyAuth)
        // Monorepo and workspace sanity
        const cwd: string = process.cwd()
        const mono = await detectMonorepo({ cwd })
        results.push({ name: 'monorepo', ok: mono !== 'none', message: mono })
        if (mono !== 'none') {
          const pm = await detectPackageManager({ cwd })
          if (pm === 'pnpm') {
            const hasLock = await fsx.exists(join(cwd, 'pnpm-lock.yaml'))
            results.push({ name: 'pnpm lockfile at root', ok: hasLock, message: hasLock ? 'found' : 'missing' })
          }
          // Vercel link file (optional but recommended for CLI ops)
          const projectJson = join(cwd, '.vercel', 'project.json')
          const linked = await fsx.exists(projectJson)
          results.push({ name: 'vercel link (.vercel/project.json)', ok: linked, message: linked ? 'linked' : 'not linked (run: vercel link)' })
          // Root vercel.json is optional; helpful when deploying from monorepo root
          const hasRootVercel = await fsx.exists(join(cwd, 'vercel.json'))
          results.push({ name: 'root vercel.json (optional)', ok: true, message: hasRootVercel ? 'present' : 'absent (ok). Prefer Vercel Git + Root Directory; add if CLI root deploys are needed.' })
          // Netlify link file (optional but recommended for CLI ops)
          const netlifyState = join(cwd, '.netlify', 'state.json')
          const netlifyLinked = await fsx.exists(netlifyState)
          results.push({ name: 'netlify link (.netlify/state.json)', ok: netlifyLinked, message: netlifyLinked ? 'linked' : 'not linked (run: netlify link --id <siteId>)' })

          // apps/* linked scan to prevent monorepo path issues
          const appsDir = join(cwd, 'apps')
          const existsApps = await fsx.exists(appsDir)
          if (existsApps) {
            try {
              const entries = await readdir(appsDir)
              const appDirs: string[] = []
              for (const name of entries) {
                const p = join(appsDir, name)
                try { const s = await fsStat(p); if (s.isDirectory()) appDirs.push(name) } catch { /* ignore */ }
              }
              const reports: string[] = []
              for (const app of appDirs) {
                const v = await fsx.exists(join(appsDir, app, '.vercel', 'project.json'))
                const n = await fsx.exists(join(appsDir, app, '.netlify', 'state.json'))
                if (v || n) reports.push(`${app}: ${v ? 'vercel' : ''}${v && n ? ',' : ''}${n ? 'netlify' : ''}`)
              }
              if (reports.length > 0) {
                results.push({ name: 'linked apps (apps/*)', ok: true, message: reports.join('; ') })
              } else {
                results.push({ name: 'linked apps (apps/*)', ok: true, message: 'none detected (ok)' })
              }
              // Chosen deploy cwd advisories for common path=apps/web
              if (appDirs.includes('web')) {
                const target = join(appsDir, 'web')
                const targetVercelLinked = await fsx.exists(join(target, '.vercel', 'project.json'))
                const rootVercelLinked = await fsx.exists(join(cwd, '.vercel', 'project.json'))
                const vercelRunCwd = targetVercelLinked ? target : (rootVercelLinked && !targetVercelLinked ? cwd : target)
                const relVercel = vercelRunCwd.startsWith(cwd) ? vercelRunCwd.slice(cwd.length + 1) || '.' : vercelRunCwd
                results.push({ name: 'vercel chosen cwd (path=apps/web)', ok: true, message: relVercel })
                // Netlify deploy runs from target path; report that directly
                const relNetlify = target.startsWith(cwd) ? target.slice(cwd.length + 1) : target
                results.push({ name: 'netlify chosen cwd (path=apps/web)', ok: true, message: relNetlify })

                // Suggest commands (deploy/prod) based on discovered links
                // Vercel project id (if present)
                let vercelProjId: string | undefined
                try {
                  const pj = await fsx.readJson<{ projectId?: string }>(join(vercelRunCwd, '.vercel', 'project.json'))
                  if (pj && typeof pj.projectId === 'string') vercelProjId = pj.projectId
                } catch { /* ignore */ }
                const vcCmd = `opendeploy deploy vercel --env prod --path ${relVercel}${vercelProjId ? ` --project ${vercelProjId}` : ''}`
                suggestions.push(vcCmd)
                // Netlify site id (if present)
                let nlSiteId: string | undefined
                try {
                  const ns = await fsx.readJson<{ siteId?: string }>(join(target, '.netlify', 'state.json'))
                  if (ns && typeof ns.siteId === 'string') nlSiteId = ns.siteId
                } catch { /* ignore */ }
                const nlCmd = `opendeploy deploy netlify --env prod --path ${relNetlify}${nlSiteId ? ` --project ${nlSiteId}` : ''}`
                suggestions.push(nlCmd)
              }
            } catch { /* ignore */ }
          }
        }
        const ok: boolean = results.every(r => r.ok)
        if (opts.json === true) {
          logger.json({ ok, results, suggestions })
          process.exitCode = ok ? 0 : 1
          return
        }
        for (const r of results) {
          if (r.ok) logger.success(`${r.name}: ${r.message}`)
          else logger.warn(`${r.name}: ${r.message}`)
        }
        if (suggestions.length > 0) {
          logger.info('Suggested commands:')
          for (const s of suggestions) logger.info(`  ${s}`)
        }
        const total: number = results.length
        const okCount: number = results.filter(r => r.ok).length
        const failCount: number = total - okCount
        const failSamples = results.filter(r => !r.ok).slice(0, 5).map(r => ({ name: r.name, message: r.message }))
        printDoctorSummary({ total, okCount, failCount, failSamples })
        if (!ok) {
          logger.warn('Some checks failed. Run the suggested login/install commands and re-run doctor.')
          if (opts.ci === true) process.exitCode = 1
          if (opts.ci === true || process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
            for (const r of results.filter(r => !r.ok)) {
              // GitHub annotation format: ::warning file=app.js,line=1,col=5::Missing semicolon
              // We don't have file/line context; emit a generic annotation.
              // eslint-disable-next-line no-console
              console.log(`::warning ::${r.name} - ${r.message}`)
            }
          }
        }
      } catch (err) {
        const raw: string = err instanceof Error ? err.message : String(err)
        const info = mapProviderError('doctor', raw)
        if (opts.json === true || process.env.OPD_JSON === '1' || process.env.OPD_NDJSON === '1') {
          logger.json({ ok: false, command: 'doctor', code: info.code, message: info.message, remedy: info.remedy, error: raw, final: true })
        }
        logger.error(`${info.message} (${info.code})`)
        if (info.remedy) logger.info(`Try: ${info.remedy}`)
        process.exitCode = 1
      }
    })
}

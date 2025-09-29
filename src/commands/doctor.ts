async function checkOpdGo(cwd: string, printCmd?: boolean): Promise<CheckResult> {
  // Priority: OPD_GO_BIN -> ./.bin/opd-go(.exe) -> PATH
  try {
    const override: string | undefined = process.env.OPD_GO_BIN
    if (override && override.length > 0) {
      const exists = await fsx.exists(override)
      return { name: 'opd-go (optional)', ok: exists, message: exists ? `OPD_GO_BIN=${override}` : `OPD_GO_BIN points to missing file: ${override}` }
    }
    const exe: string = process.platform === 'win32' ? 'opd-go.exe' : 'opd-go'
    const local: string = join(cwd, '.bin', exe)
    if (await fsx.exists(local)) {
      return { name: 'opd-go (optional)', ok: true, message: `local .bin/${exe}` }
    }
    const pathCmd: string = process.platform === 'win32' ? 'where opd-go' : 'command -v opd-go'
    if (printCmd) logger.info(`$ ${pathCmd}`)
    const probe = await runWithRetry({ cmd: pathCmd, cwd })
    if (probe.ok && probe.stdout.trim().length > 0) {
      const first = probe.stdout.trim().split(/\r?\n/)[0] || 'opd-go'
      return { name: 'opd-go (optional)', ok: true, message: first }
    }
    return { name: 'opd-go (optional)', ok: false, message: 'not found (build with: pnpm build:go or set OPD_GO_BIN)'}
  } catch {
    return { name: 'opd-go (optional)', ok: false, message: 'not found (build with: pnpm build:go or set OPD_GO_BIN)'}
  }
}

import { Command } from 'commander'
import { logger, isJsonMode } from '../utils/logger'
import { proc, runWithRetry } from '../utils/process'
import { join } from 'node:path'
import { readdir, stat as fsStat } from 'node:fs/promises'
import { fsx } from '../utils/fs'
import { detectMonorepo } from '../core/detectors/monorepo'
import { detectPackageManager } from '../core/detectors/package-manager'
import { mapProviderError } from '../utils/errors'
import { printDoctorSummary } from '../utils/summarize'
import { writeFile } from 'node:fs/promises'
import Ajv2020 from 'ajv/dist/2020'
import { doctorSummarySchema } from '../schemas/doctor-summary.schema'
import { readFile as readFileFs } from 'node:fs/promises'

// ---- GitHub Pages + Next static export checks (best-effort, non-fatal) ----
async function checkNextGithubPages(cwd: string): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const push = (name: string, ok: boolean, message: string): void => { results.push({ name, ok, message }) }
  try {
    const hasNoJekyllPublic = await fsx.exists(join(cwd, 'public', '.nojekyll'))
    const hasNoJekyllOut = await fsx.exists(join(cwd, 'out', '.nojekyll'))
    push('.nojekyll (public/ or out/)', hasNoJekyllPublic || hasNoJekyllOut, hasNoJekyllPublic ? 'public/.nojekyll' : (hasNoJekyllOut ? 'out/.nojekyll' : 'missing'))
  } catch { push('.nojekyll (public/ or out/)', false, 'error reading') }
  try {
    let cfg = ''
    const candidates = ['next.config.ts', 'next.config.js', 'next.config.mjs']
    for (const f of candidates) {
      const p = join(cwd, f)
      if (await fsx.exists(p)) { cfg = await readFileFs(p, 'utf8'); break }
    }
    if (cfg.length > 0) {
      const hasExport = /output\s*:\s*['"]export['"]/m.test(cfg)
      push("next.config: output: 'export'", hasExport, hasExport ? 'ok' : "missing (set output: 'export')")
      const hasTrailing = /trailingSlash\s*:\s*true/m.test(cfg)
      push('next.config: trailingSlash', hasTrailing, hasTrailing ? 'true' : 'not set (recommended true)')
      const hasUnopt = /images\s*:\s*\{[^}]*unoptimized\s*:\s*true/m.test(cfg)
      push('next.config: images.unoptimized', hasUnopt, hasUnopt ? 'true' : 'not set (recommended true)')
      const hasBasePath = /basePath\s*:\s*['"][^'"]+['"]/m.test(cfg)
      push('next.config: basePath', hasBasePath, hasBasePath ? 'present' : 'not set (recommended for Project Pages)')
    } else {
      push('next.config.* present', false, 'file not found')
    }
  } catch { push('next.config parse', false, 'error reading next.config.*') }
  try {
    const outDir = join(cwd, 'out')
    if (await fsx.exists(outDir)) {
      const staticDir = join(outDir, '_next', 'static')
      const exists = await fsx.exists(staticDir)
      push('export assets (_next/static)', exists, exists ? 'found' : 'missing')
    }
  } catch { /* ignore */ }
  return results
}

interface DoctorOptions { readonly ci?: boolean; readonly json?: boolean; readonly verbose?: boolean; readonly fix?: boolean; readonly path?: string; readonly project?: string; readonly org?: string; readonly site?: string; readonly printCmd?: boolean }

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

async function checkCmdAny(cmds: readonly string[], label: string, printCmd?: boolean): Promise<CheckResult> {
  for (const c of cmds) {
    const cmd = `${c} --version`
    if (printCmd) logger.info(`$ ${cmd}`)
    const out = await runWithRetry({ cmd })
    if (out.ok) return { name: `${label} --version`, ok: true, message: out.stdout.trim() }
  }
  return { name: `${label} --version`, ok: false, message: 'not installed or not on PATH' }
}

async function checkVercelAuth(printCmd?: boolean): Promise<CheckResult> {
  const candidates: readonly string[] = process.platform === 'win32' ? ['vercel', 'vercel.cmd'] : ['vercel']
  for (const c of candidates) {
    const cmd = `${c} whoami`
    if (printCmd) logger.info(`$ ${cmd}`)
    const out = await runWithRetry({ cmd })
    if (out.ok && out.stdout.trim().length > 0) return { name: 'vercel auth', ok: true, message: out.stdout.trim() }
  }
  return { name: 'vercel auth', ok: false, message: 'not logged in (run: vercel login)' }
}

async function checkNetlifyAuth(printCmd?: boolean): Promise<CheckResult> {
  const candidates: readonly string[] = process.platform === 'win32' ? ['netlify', 'netlify.cmd'] : ['netlify']
  for (const c of candidates) {
    const cmd = `${c} status`
    if (printCmd) logger.info(`$ ${cmd}`)
    const out = await runWithRetry({ cmd })
    if (out.ok && out.stdout.toLowerCase().includes('logged in')) return { name: 'netlify auth', ok: true, message: out.stdout.trim() }
  }
  return { name: 'netlify auth', ok: false, message: 'not logged in (run: netlify login)' }
}

async function checkWranglerAuth(printCmd?: boolean): Promise<CheckResult> {
  const candidates: readonly string[] = process.platform === 'win32' ? ['wrangler', 'wrangler.cmd'] : ['wrangler']
  for (const c of candidates) {
    const verCmd: string = `${c} --version`
    if (printCmd) logger.info(`$ ${verCmd}`)
    const ver = await runWithRetry({ cmd: verCmd })
    if (!ver.ok) continue
    const whoCmd: string = `${c} whoami`
    if (printCmd) logger.info(`$ ${whoCmd}`)
    const who = await runWithRetry({ cmd: whoCmd })
    if (who.ok && who.stdout.trim().length > 0) return { name: 'wrangler auth', ok: true, message: who.stdout.trim() }
    return { name: 'wrangler auth', ok: false, message: 'not logged in (run: wrangler login)' }
  }
  return { name: 'wrangler', ok: false, message: 'not installed or not on PATH (install: npm i -g wrangler)' }
}

async function checkGitHubPagesSetup(cwd: string, printCmd?: boolean): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  // Check that a git origin remote exists
  const remoteCmd: string = 'git remote -v'
  if (printCmd) logger.info(`$ ${remoteCmd}`)
  const rem = await runWithRetry({ cmd: remoteCmd, cwd })
  const hasOrigin: boolean = rem.ok && /origin\s+/.test(rem.stdout)
  results.push({ name: 'git origin remote', ok: hasOrigin, message: hasOrigin ? 'found' : 'missing (set with: git remote add origin <url>)' })
  // Check gh-pages branch existence on remote
  const lsCmd: string = 'git ls-remote --heads origin gh-pages'
  if (printCmd) logger.info(`$ ${lsCmd}`)
  const ls = await runWithRetry({ cmd: lsCmd, cwd })
  const hasGhPages: boolean = ls.ok && ls.stdout.trim().length > 0
  results.push({ name: 'gh-pages branch (remote)', ok: hasGhPages, message: hasGhPages ? 'exists' : 'not found (will be created on first publish)' })
  return results
}

/**
 * Register the `doctor` command.
 */
export function registerDoctorCommand(program: Command): void {
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  const validate = ajv.compile(doctorSummarySchema as unknown as object)
  const annotate = (obj: Record<string, unknown>): Record<string, unknown> => {
    const ok: boolean = validate(obj) as boolean
    const errs: string[] = Array.isArray(validate.errors) ? validate.errors.map(e => `${e.instancePath || '/'} ${e.message ?? ''}`.trim()) : []
    if (process.env.OPD_SCHEMA_STRICT === '1' && errs.length > 0) { process.exitCode = 1 }
    return { ...obj, schemaOk: ok, schemaErrors: errs }
  }
  const doctorCmd = program
    .command('doctor')
    .description('Validate local environment and provider CLIs')
    .option('--ci', 'CI mode (exit non-zero on warnings)')
    .option('--json', 'Output JSON')
    .option('--verbose', 'Verbose output')
    .option('--fix', 'Attempt to fix common issues (linking)')
    .option('--path <dir>', 'Working directory to check/fix (monorepos)')
    .option('--project <id>', 'Vercel project ID (for linking)')
    .option('--org <id>', 'Vercel org/team ID (for linking)')
    .option('--site <siteId>', 'Netlify site ID (for linking)')
    .option('--print-cmd', 'Print underlying provider commands that will be executed')
    .action(async (opts: DoctorOptions): Promise<void> => {
      try {
        const jsonMode: boolean = isJsonMode(opts.json)
        if (jsonMode) logger.setJsonOnly(true)
        const results: CheckResult[] = []
        const suggestions: string[] = []
        const nodeOk: boolean = parseNodeOk()
        results.push({ name: 'node >= 18.17', ok: nodeOk, message: process.versions.node })
        const pnpmCandidates: readonly string[] = process.platform === 'win32' ? ['pnpm', 'pnpm.cmd', 'corepack pnpm'] : ['pnpm', 'corepack pnpm']
        const pnpm = await checkCmdAny(pnpmCandidates, 'pnpm', opts.printCmd)
        results.push(pnpm)
        const bunCandidates: readonly string[] = process.platform === 'win32' ? ['bun', 'bun.exe', 'bun.cmd'] : ['bun']
        const bunCli = await checkCmdAny(bunCandidates, 'bun', opts.printCmd)
        results.push(bunCli)
        // Go sidecar (optional)
        const goRunner = await checkOpdGo(process.cwd(), opts.printCmd)
        results.push(goRunner)
        const vercelCandidates: readonly string[] = process.platform === 'win32' ? ['vercel', 'vercel.cmd'] : ['vercel']
        const vercelCli = await checkCmdAny(vercelCandidates, 'vercel', opts.printCmd)
        results.push(vercelCli)
        const netlifyCandidates: readonly string[] = process.platform === 'win32' ? ['netlify', 'netlify.cmd'] : ['netlify']
        const netlifyCli = await checkCmdAny(netlifyCandidates, 'netlify', opts.printCmd)
        results.push(netlifyCli)
        // Cloudflare Pages CLI (wrangler)
        const wranglerCandidates: readonly string[] = process.platform === 'win32' ? ['wrangler', 'wrangler.cmd'] : ['wrangler']
        const wranglerCli = await checkCmdAny(wranglerCandidates, 'wrangler', opts.printCmd)
        results.push(wranglerCli)
        // Optional toolchain checks
        const prismaCandidates: readonly string[] = process.platform === 'win32'
          ? ['pnpm exec prisma', 'npx prisma', 'prisma', 'prisma.cmd']
          : ['pnpm exec prisma', 'npx prisma', 'prisma']
        const prismaCli = await checkCmdAny(prismaCandidates, 'prisma (optional)', opts.printCmd)
        results.push(prismaCli)
        const drizzleCandidates: readonly string[] = process.platform === 'win32'
          ? ['pnpm exec drizzle-kit', 'npx drizzle-kit', 'drizzle-kit', 'drizzle-kit.cmd']
          : ['pnpm exec drizzle-kit', 'npx drizzle-kit', 'drizzle-kit']
        const drizzleCli = await checkCmdAny(drizzleCandidates, 'drizzle-kit (optional)', opts.printCmd)
        results.push(drizzleCli)
        const psqlCandidates: readonly string[] = process.platform === 'win32' ? ['psql', 'psql.exe'] : ['psql']
        const psqlCli = await checkCmdAny(psqlCandidates, 'psql (optional)', opts.printCmd)
        results.push(psqlCli)
        const vercelAuth = await checkVercelAuth(opts.printCmd)
        results.push(vercelAuth)
        const netlifyAuth = await checkNetlifyAuth(opts.printCmd)
        results.push(netlifyAuth)
        const wranglerAuth = await checkWranglerAuth(opts.printCmd)
        results.push(wranglerAuth)
        // Monorepo and workspace sanity
        const cwdRoot: string = process.cwd()
        const cwd: string = opts.path ? join(cwdRoot, opts.path) : cwdRoot
        const mono = await detectMonorepo({ cwd })
        results.push({ name: 'monorepo', ok: mono !== 'none', message: mono })
        if (mono !== 'none') {
          const pm = await detectPackageManager({ cwd })
          if (pm === 'pnpm') {
            const hasLock = await fsx.exists(join(cwd, 'pnpm-lock.yaml'))
            results.push({ name: 'pnpm lockfile at root', ok: hasLock, message: hasLock ? 'found' : 'missing' })
          }
        // Optional: best-effort fixes
        if (opts.fix === true) {
          try {
            // Vercel link fix
            const vercelLinked = await fsx.exists(join(cwd, '.vercel', 'project.json'))
            if (!vercelLinked && opts.project) {
              const flags: string[] = ['--yes', `--project ${opts.project}`]
              if (opts.org) flags.push(`--org ${opts.org}`)
              const linkVercel = `vercel link ${flags.join(' ')}`
              if (opts.printCmd) logger.info(`$ ${linkVercel}`)
              const res = await runWithRetry({ cmd: linkVercel, cwd })
              if (!res.ok) suggestions.push('vercel link --yes --project <id> [--org <id>]')
              else results.push({ name: 'vercel link (fix)', ok: true, message: 'linked' })
            }
            // Netlify link fix
            const netlifyLinked = await fsx.exists(join(cwd, '.netlify', 'state.json'))
            if (!netlifyLinked && opts.site) {
              const linkNetlify = `netlify link --id ${opts.site}`
              if (opts.printCmd) logger.info(`$ ${linkNetlify}`)
              const res = await runWithRetry({ cmd: linkNetlify, cwd })
              if (!res.ok) suggestions.push('netlify link --id <siteId>')
              else results.push({ name: 'netlify link (fix)', ok: true, message: 'linked' })
            }
          } catch { /* ignore */ }
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
        // GitHub Pages readiness (best-effort)
        try {
          const ghChecks = await checkGitHubPagesSetup(cwd, opts.printCmd)
          for (const r of ghChecks) results.push(r)
          const originOk = ghChecks.find(r => r.name === 'git origin remote')?.ok === true
          const ghBranchOk = ghChecks.find(r => r.name === 'gh-pages branch (remote)')?.ok === true
          if (!originOk) suggestions.push('git remote add origin <url> && git push -u origin main')
          if (!ghBranchOk) suggestions.push('opendeploy deploy github')
          // Next + GH Pages checks
          const nx = await checkNextGithubPages(cwd)
          for (const r of nx) results.push(r as CheckResult)
          const hasNoJ = nx.find(r => r.name.startsWith('.nojekyll'))?.ok
          const hasExport = nx.find(r => r.name.includes("output: 'export'"))?.ok
          const assetsOk = nx.find(r => r.name.startsWith('export assets'))?.ok
          if (hasNoJ === false) suggestions.push('touch public/.nojekyll (or rely on CLI to add it during deploy)')
          if (hasExport === false) suggestions.push("set output: 'export' in next.config.ts/js for static export")
          if (assetsOk === false) suggestions.push('pnpm build (verify out/_next/static exists)')
        } catch { /* ignore */ }

        if (jsonMode) {
          logger.jsonPrint(annotate({ ok, action: 'doctor' as const, results, suggestions, final: true }))
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
        // If local .bin/opd-go exists but not on PATH and OPD_GO_BIN is unset, provide a hint to set OPD_GO_BIN
        try {
          const exe: string = process.platform === 'win32' ? 'opd-go.exe' : 'opd-go'
          const local: string = join(cwd, '.bin', exe)
          const localExists: boolean = await fsx.exists(local)
          const envOverride = process.env.OPD_GO_BIN
          let onPath = false
          try {
            const pathCmd: string = process.platform === 'win32' ? 'where opd-go' : 'command -v opd-go'
            const probe = await runWithRetry({ cmd: pathCmd, cwd })
            onPath = probe.ok && probe.stdout.trim().length > 0
          } catch { onPath = false }
          if (localExists && !onPath && (!envOverride || envOverride.length === 0)) {
            const ps = `$env:OPD_GO_BIN = \"$PWD\\.bin\\${exe}\"`
            const sh = `export OPD_GO_BIN=\"$PWD/.bin/${exe}\"`
            suggestions.push(`Set OPD_GO_BIN (PowerShell): ${ps}`)
            suggestions.push(`Set OPD_GO_BIN (Bash): ${sh}`)
          }
        } catch { /* ignore */ }
        // Add suggestions for missing optional tools
        try {
          const hasOpdGo: boolean = results.find(r => r.name === 'opd-go (optional)')?.ok === true
          if (!hasOpdGo) suggestions.push('pnpm run build:go')
        } catch { /* ignore */ }
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
        if (isJsonMode(opts.json)) { logger.jsonPrint(annotate({ ok: false, action: 'doctor' as const, code: info.code, message: info.message, remedy: info.remedy, error: raw, final: true })) }
        logger.error(`${info.message} (${info.code})`)
        if (info.remedy) logger.info(`Try: ${info.remedy}`)
        process.exitCode = 1
      }
    })

  // ----- doctor env-snapshot -----
  doctorCmd
    .command('env-snapshot')
    .description('Capture a deterministic environment snapshot for parity checks')
    .option('--out <file>', 'Output file path', '.artifacts/env.snapshot.json')
    .action(async (opts: { readonly out: string }): Promise<void> => {
      try {
        const snap: Snapshot = buildEnvSnapshot()
        const json: string = JSON.stringify(snap, null, 2) + '\n'
        await writeFile(opts.out, json, 'utf8')
        logger.success(`Environment snapshot written to ${opts.out}`)
      } catch (err) {
        const raw: string = err instanceof Error ? err.message : String(err)
        logger.error(`env-snapshot failed: ${raw}`)
        process.exitCode = 1
      }
    })

  // ----- doctor env-compare -----
  doctorCmd
    .command('env-compare')
    .description('Compare two environment snapshots and print differences')
    .option('--a <file>', 'Snapshot A file path')
    .option('--b <file>', 'Snapshot B file path')
    .action(async (opts: { readonly a?: string; readonly b?: string }): Promise<void> => {
      try {
        if (!opts.a || !opts.b) {
          logger.error('Provide both --a and --b snapshot file paths')
          process.exitCode = 1
          return
        }
        const a: Record<string, unknown> = (await fsx.readJson<Record<string, unknown>>(opts.a)) ?? {}
        const b: Record<string, unknown> = (await fsx.readJson<Record<string, unknown>>(opts.b)) ?? {}
        const diff: { readonly added: string[]; readonly removed: string[]; readonly changed: Array<{ readonly key: string; readonly a: unknown; readonly b: unknown }> } = diffSnapshots(a, b)
        const ok: boolean = diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0
        logger.jsonPrint(annotate({ ok, action: 'doctor' as const, subcommand: 'env-compare' as const, diff, final: true }))
        if (!ok) process.exitCode = 1
      } catch (err) {
        const raw: string = err instanceof Error ? err.message : String(err)
        logger.error(`env-compare failed: ${raw}`)
        process.exitCode = 1
      }
    })
}

// -------- helpers: environment snapshot/compare --------

interface Snapshot {
  readonly platform: string
  readonly release: string
  readonly arch: string
  readonly node: string
  readonly pnpm?: string
  readonly PATH?: string
  readonly PATHEXT?: string
  readonly TZ?: string
  readonly LC_ALL?: string
  readonly FORCE_COLOR?: string
  readonly TERM?: string
}

function pickEnv(keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of keys) { const v = process.env[k]; if (typeof v === 'string') out[k] = v }
  return out
}

function buildEnvSnapshot(): Snapshot {
  const core: Snapshot = {
    platform: process.platform,
    release: typeof (process as any).getSystemVersion === 'function' ? (process as any).getSystemVersion() ?? '' : process.release.name,
    arch: process.arch,
    node: process.versions.node,
    pnpm: process.env.npm_config_user_agent,
    ...pickEnv(['PATH','PATHEXT','TZ','LC_ALL','FORCE_COLOR','TERM'])
  }
  return core
}

function diffSnapshots(a: Record<string, unknown>, b: Record<string, unknown>): { readonly added: string[]; readonly removed: string[]; readonly changed: Array<{ readonly key: string; readonly a: unknown; readonly b: unknown }> } {
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)])
  const added: string[] = []
  const removed: string[] = []
  const changed: Array<{ readonly key: string; readonly a: unknown; readonly b: unknown }> = []
  for (const k of keys) {
    const va = (a as Record<string, unknown>)[k]
    const vb = (b as Record<string, unknown>)[k]
    if (!(k in a)) { added.push(k); continue }
    if (!(k in b)) { removed.push(k); continue }
    if (JSON.stringify(va) !== JSON.stringify(vb)) changed.push({ key: k, a: va, b: vb })
  }
  return { added, removed, changed }
}

import { Command } from 'commander'
import { join, isAbsolute } from 'node:path'
import { logger, isJsonMode } from '../utils/logger'
import { fsx } from '../utils/fs'
import { spinner } from '../utils/ui'
import { startHeartbeat, type Stopper } from '../utils/progress'
import { readFile as readFileFs } from 'node:fs/promises'
import { proc, runWithRetry } from '../utils/process'
import { envSync } from './env'
import { printDeploySummary } from '../utils/summarize'
import { computeRedactors } from '../utils/redaction'
import { extractVercelInspectUrl } from '../utils/inspect'
import { runStartWizard } from './start'
import { detectApp } from '../core/detectors/auto'
import type { Framework } from '../types/framework'
import { loadProvider } from '../core/provider-system/provider'
import Ajv from 'ajv'
import { upSummarySchema } from '../schemas/up-summary.schema'
import { providerBuildResultSchema } from '../schemas/provider-build-result.schema'
import { providerDeployResultSchema } from '../schemas/provider-deploy-result.schema'
import { runWithTimeout } from '../utils/process'

interface UpOptions {
  readonly path?: string
  readonly json?: boolean
  readonly ci?: boolean
  readonly syncEnv?: boolean
  readonly alias?: string
  readonly project?: string
  readonly org?: string
  readonly env?: 'prod' | 'preview'
  readonly dryRun?: boolean
  readonly printCmd?: boolean
  readonly retries?: string
  readonly timeoutMs?: string
  readonly baseDelayMs?: string
  readonly ndjson?: boolean
  readonly noBuild?: boolean
  readonly preflightOnly?: boolean
  readonly strictPreflight?: boolean
  readonly preflightArtifactsOnly?: boolean
  readonly fixPreflight?: boolean
}

function inferPublishDir(fw: Framework): string {
  if (fw === 'nuxt') return '.output/public'
  if (fw === 'remix') return 'build/client'
  if (fw === 'astro') return 'dist'
  if (fw === 'expo') return 'dist'
  if (fw === 'next') return '.next'
  if (fw === 'sveltekit') return 'build'
  return 'dist'
}

function providerLoginUrl(p: string): string {
  const prov: string = String(p)
  if (prov === 'vercel') return 'https://vercel.com/login'
  if (prov === 'cloudflare') return 'https://dash.cloudflare.com/login'
  return 'https://github.com/login'
}

async function openUrl(url: string): Promise<boolean> {
  try {
    const u: string = url
    const cmd: string = process.platform === 'win32'
      ? `powershell -NoProfile -NonInteractive -Command Start-Process "${u}"`
      : process.platform === 'darwin'
        ? `open "${u}"`
        : `xdg-open "${u}"`
    const res = await runWithTimeout({ cmd }, 5_000)
    return res.ok
  } catch { return false }
}

/**
 * Register the `up` command (preview deploy with smart defaults).
 * - Detects Next.js app
 * - Optionally syncs env from local file (optimized writes)
 * - Deploys to preview on selected provider
 * - Optionally assigns alias (Vercel)
 */
export function registerUpCommand(program: Command): void {
  const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false })
  const validate = ajv.compile(upSummarySchema as unknown as object)
  const validateBuild = ajv.compile(providerBuildResultSchema as unknown as object)
  const validateDeploy = ajv.compile(providerDeployResultSchema as unknown as object)
  const annotate = (obj: Record<string, unknown>): Record<string, unknown> => {
    const ok: boolean = validate(obj) as boolean
    const errs: string[] = Array.isArray(validate.errors) ? validate.errors.map(e => `${e.instancePath || '/'} ${e.message ?? ''}`.trim()) : []
    if (process.env.OPD_SCHEMA_STRICT === '1' && errs.length > 0) { process.exitCode = 1 }
    return { ...obj, schemaOk: ok, schemaErrors: errs }
  }
  program
    .command('up')
    .description('Deploy to preview with safe defaults (env sync + deploy)')
    .argument('[provider]', 'Target provider: vercel | cloudflare | github')
    .option('--env <env>', 'Environment: prod | preview', 'preview')
    .option('--path <dir>', 'Path to app directory (for monorepos)')
    .option('--json', 'Output JSON result')
    .option('--ci', 'CI mode (non-interactive)')
    .option('--dry-run', 'Do not execute actual deployment')
    .option('--sync-env', 'Sync environment from local .env before deploy')
    .option('--alias <domain>', 'After deploy, assign this alias to the deployment (vercel only)')
    .option('--project <id>', 'Provider project/site ID')
    .option('--org <id>', 'Provider org/team ID (Vercel)')
    .option('--print-cmd', 'Print underlying provider commands that will be executed')
    .option('--retries <n>', 'Retries for provider commands (default 2)')
    .option('--timeout-ms <ms>', 'Timeout per provider command in milliseconds (default 120000)')
    .option('--base-delay-ms <ms>', 'Base delay for exponential backoff with jitter (default 300)')
    .option('--ndjson', 'Output NDJSON events for progress')
    .option('--no-build', 'Skip local build; deploy existing publish directory (when supported)')
    .option('--preflight-only', 'Run preflight checks and exit without building/publishing (GitHub Pages)')
    .option('--strict-preflight', 'Treat preflight warnings as errors (GitHub/Cloudflare)')
    .option('--preflight-artifacts-only', 'Run provider build and asset sanity, then exit without deploying (Cloudflare/GitHub)')
    .option('--fix-preflight', 'Apply safe preflight fixes (e.g., ensure .nojekyll for GitHub Pages)')
    .action(async (provider: string | undefined, opts: UpOptions): Promise<void> => {
      const rootCwd: string = process.cwd()
      const targetCwd: string = opts.path ? (isAbsolute(opts.path) ? opts.path : join(rootCwd, opts.path)) : rootCwd
      try {
        // Ultra-early fast path for Cloudflare preflight in tests/CI to avoid timeouts
        const jsonQuick: boolean = isJsonMode(opts.json)
        if (provider === 'cloudflare' && (opts.preflightOnly === true || opts.strictPreflight === true)) {
          const preflight: Array<{ readonly name: string; readonly ok: boolean; readonly level: 'warn' | 'note'; readonly message?: string }> = []
          let warned = false
          try {
            // Read next.config.* if present
            const candidates = ['next.config.ts', 'next.config.js', 'next.config.mjs']
            let cfg = ''
            for (const f of candidates) { const pth = join(targetCwd, f); if (await fsx.exists(pth)) { cfg = await readFileFs(pth, 'utf8'); break } }
            if (cfg.length > 0) {
              if (/output\s*:\s*['"]export['"]/m.test(cfg)) { preflight.push({ name: 'cloudflare: next.config output export omitted', ok: false, level: 'warn', message: 'remove output: "export"' }); warned = true }
              if (/assetPrefix\s*:\s*['"][^'\"]+['"]/m.test(cfg)) { preflight.push({ name: 'cloudflare: assetPrefix absent', ok: false, level: 'warn', message: 'remove assetPrefix' }); warned = true }
              const m = cfg.match(/basePath\s*:\s*['"]([^'\"]*)['"]/m)
              if (m && m[1] && m[1] !== '') { preflight.push({ name: 'cloudflare: basePath empty', ok: false, level: 'warn', message: 'set basePath to ""' }); warned = true }
              if (/trailingSlash\s*:\s*true/m.test(cfg)) { preflight.push({ name: 'cloudflare: trailingSlash recommended false', ok: true, level: 'note', message: 'set trailingSlash: false' }) }
            }
          } catch { /* ignore */ }
          try {
            const wranglerPath = join(targetCwd, 'wrangler.toml')
            if (await fsx.exists(wranglerPath)) {
              const raw = await readFileFs(wranglerPath, 'utf8')
              if (!/pages_build_output_dir\s*=\s*"\.vercel\/output\/static"/m.test(raw)) { preflight.push({ name: 'cloudflare: wrangler pages_build_output_dir', ok: false, level: 'warn', message: 'set to .vercel/output/static' }); warned = true }
              if (!/pages_functions_directory\s*=\s*"\.vercel\/output\/functions"/m.test(raw)) { preflight.push({ name: 'cloudflare: wrangler pages_functions_directory', ok: true, level: 'note', message: 'set to .vercel/output/functions' }) }
              if (!/compatibility_flags\s*=\s*\[.*"nodejs_compat".*\]/m.test(raw)) { preflight.push({ name: 'cloudflare: wrangler nodejs_compat flag', ok: true, level: 'note', message: 'add compatibility_flags = ["nodejs_compat"]' }) }
            } else {
              preflight.push({ name: 'cloudflare: wrangler.toml present', ok: false, level: 'warn', message: 'missing wrangler.toml' }); warned = true
            }
          } catch { /* ignore */ }
          const targetShort: 'prod' | 'preview' = (opts.env === 'prod' ? 'prod' : 'preview')
          if (opts.strictPreflight && warned) {
            if (jsonQuick) { logger.jsonPrint({ ok: false, action: 'up' as const, provider: 'cloudflare' as const, target: targetShort, message: 'Preflight failed (strict): resolve Next.js Cloudflare Pages warnings.', preflightOnly: true, preflight, final: true }); process.exit(1) }
            throw new Error('Preflight failed (strict): resolve Next.js Cloudflare Pages warnings.')
          }
          if (opts.preflightOnly) {
            if (jsonQuick) { logger.jsonPrint({ ok: true, action: 'up' as const, provider: 'cloudflare' as const, target: targetShort, preflightOnly: true, preflight, final: true }); process.exit(0) }
            logger.success('Preflight checks completed (Cloudflare Pages). No build/publish performed.')
            return
          }
        }
        const jsonMode: boolean = isJsonMode(opts.json)
        const ndjsonOn: boolean = opts.ndjson === true || process.env.OPD_NDJSON === '1'
        if (ndjsonOn) logger.setNdjson(true)
        // Structured preflight capture for JSON consumers
        const preflight: Array<{ readonly name: string; readonly ok: boolean; readonly level: 'warn' | 'note'; readonly message?: string }> = []
        if (jsonMode) logger.setJsonOnly(true)
        if (jsonMode || ndjsonOn || opts.ci === true) process.env.OPD_FORCE_CI = '1'
        if (opts.retries) process.env.OPD_RETRIES = String(Math.max(0, Number(opts.retries) || 0))
        if (opts.timeoutMs) process.env.OPD_TIMEOUT_MS = String(Math.max(0, Number(opts.timeoutMs) || 0))
        if (opts.baseDelayMs) process.env.OPD_BASE_DELAY_MS = String(Math.max(0, Number(opts.baseDelayMs) || 0))
        // If provider is missing, fall back to the guided wizard
        if (!provider) {
          await runStartWizard({ provider: undefined, env: (opts.env === 'prod' ? 'prod' : 'preview'), path: opts.path, project: opts.project, org: opts.org, syncEnv: Boolean(opts.syncEnv), json: Boolean(opts.json), ci: Boolean(opts.ci), dryRun: Boolean(opts.dryRun) })
          return
        }
        // Signal to any nested flows/tools that env sync is desired for single-command up
        process.env.OPD_SYNC_ENV = '1'
        // Plugin-first flow unless explicitly opting into legacy
        if (process.env.OPD_LEGACY !== '1') {
          const allowed: readonly string[] = ['vercel', 'cloudflare', 'github']
          // Explicitly reject Netlify
          if (provider && provider.toLowerCase() === 'netlify') {
            const msg = 'Netlify is not supported by OpenDeploy. Please use the official Netlify CLI.'
            if (jsonMode) { logger.jsonPrint({ ok: false, action: 'up' as const, provider: 'netlify', message: msg, final: true }); return }
            throw new Error(msg)
          }
          const prov: string = (provider && allowed.includes(provider)) ? provider : 'vercel'
          const envTargetUp: 'preview' | 'production' = (opts.env === 'prod' ? 'production' : 'preview')
          // Early preflight short-circuit for Cloudflare to avoid provider linking
          if (prov === 'cloudflare' && (opts.preflightOnly === true || opts.strictPreflight === true)) {
            try {
              // Prepare preflight results
              const preflight: Array<{ readonly name: string; readonly ok: boolean; readonly level: 'warn' | 'note'; readonly message?: string }> = []
              let warned = false
              // Detect presence of next.config.*
              let hasNextConfig = false
              try {
                const cands = ['next.config.ts', 'next.config.js', 'next.config.mjs']
                for (const f of cands) { if (await fsx.exists(join(targetCwd, f))) { hasNextConfig = true; break } }
              } catch { /* ignore */ }
              // Only run Next-specific checks if Next.js is present or next.config exists
              if (hasNextConfig) {
                try {
                  let cfg = ''
                  const candidates = ['next.config.ts', 'next.config.js', 'next.config.mjs']
                  for (const f of candidates) { const pth = join(targetCwd, f); if (await fsx.exists(pth)) { cfg = await readFileFs(pth, 'utf8'); break } }
                  if (cfg.length > 0) {
                    const hasOutputExport: boolean = /output\s*:\s*['"]export['"]/m.test(cfg)
                    if (hasOutputExport) { preflight.push({ name: 'cloudflare: next.config output export omitted', ok: false, level: 'warn', message: 'remove output: "export"' }); warned = true }
                    const hasAssetPrefix: boolean = /assetPrefix\s*:\s*['"][^'\"]+['"]/m.test(cfg)
                    if (hasAssetPrefix) { preflight.push({ name: 'cloudflare: assetPrefix absent', ok: false, level: 'warn', message: 'remove assetPrefix' }); warned = true }
                    const basePathMatch = cfg.match(/basePath\s*:\s*['"]([^'\"]*)['"]/m)
                    if (basePathMatch && basePathMatch[1] && basePathMatch[1] !== '') { preflight.push({ name: 'cloudflare: basePath empty', ok: false, level: 'warn', message: 'set basePath to ""' }); warned = true }
                    const trailingTrue: boolean = /trailingSlash\s*:\s*true/m.test(cfg)
                    if (trailingTrue) { preflight.push({ name: 'cloudflare: trailingSlash recommended false', ok: true, level: 'note', message: 'set trailingSlash: false' }) }
                  }
                } catch { /* ignore */ }
              }
              // wrangler.toml checks
              try {
                const wranglerPath = join(targetCwd, 'wrangler.toml')
                if (await fsx.exists(wranglerPath)) {
                  const raw = await readFileFs(wranglerPath, 'utf8')
                  if (!/pages_build_output_dir\s*=\s*"\.vercel\/output\/static"/m.test(raw)) { preflight.push({ name: 'cloudflare: wrangler pages_build_output_dir', ok: false, level: 'warn', message: 'set to .vercel/output/static' }); warned = true }
                  if (!/pages_functions_directory\s*=\s*"\.vercel\/output\/functions"/m.test(raw)) { preflight.push({ name: 'cloudflare: wrangler pages_functions_directory', ok: true, level: 'note', message: 'set to .vercel/output/functions' }) }
                  if (!/compatibility_flags\s*=\s*\[.*"nodejs_compat".*\]/m.test(raw)) { preflight.push({ name: 'cloudflare: wrangler nodejs_compat flag', ok: true, level: 'note', message: 'add compatibility_flags = ["nodejs_compat"]' }) }
                } else {
                  preflight.push({ name: 'cloudflare: wrangler.toml present', ok: false, level: 'warn', message: 'missing wrangler.toml' }); warned = true
                }
              } catch { /* ignore */ }
              const targetShort: 'prod' | 'preview' = envTargetUp === 'production' ? 'prod' : 'preview'
              if (opts.strictPreflight && warned) { if (jsonMode) { logger.jsonPrint({ ok: false, action: 'up' as const, provider: 'cloudflare' as const, target: targetShort, message: 'Preflight failed (strict): resolve Next.js Cloudflare Pages warnings.', preflightOnly: true, preflight, final: true }); process.exit(1) } throw new Error('Preflight failed (strict): resolve Next.js Cloudflare Pages warnings.') }
              if (opts.preflightOnly) { if (jsonMode) { logger.jsonPrint({ ok: true, action: 'up' as const, provider: 'cloudflare' as const, target: targetShort, preflightOnly: true, preflight, final: true }); process.exit(0) } logger.success('Preflight checks completed (Cloudflare Pages). No build/publish performed.'); return }
            } catch (e) {
              // fall through to general error handler
              throw e
            }
          }
          // Early dry-run (no provider CLI needed)
          if (opts.dryRun === true) {
            const envShort: 'prod' | 'preview' = (opts.env === 'prod' ? 'prod' : 'preview')
            if (jsonMode) {
              const cmdPlan: string[] = []
              if (prov === 'vercel') {
                if (opts.project || opts.org) cmdPlan.push(`vercel link --yes${opts.project ? ` --project ${opts.project}` : ''}${opts.org ? ` --org ${opts.org}` : ''}`.trim())
                cmdPlan.push(envTargetUp === 'production' ? 'vercel deploy --prod --yes' : 'vercel deploy --yes')
                if (opts.alias) cmdPlan.push(`vercel alias set <deployment-url> ${opts.alias}`)
              } else if (prov === 'cloudflare') {
                // Choose publish dir by framework; add guidance for Next.js
                try {
                  const det = await detectApp({ cwd: targetCwd })
                  const fw = det.framework as Framework
                  let dir = det.publishDir
                  if (!dir) {
                    if (fw === 'astro') dir = 'dist'
                    else if (fw === 'sveltekit') dir = 'build'
                    else if (fw === 'next') dir = 'out' // static export path; requires next export or next-on-pages
                    else dir = 'dist'
                  }
                  if (fw === 'next') {
                    cmdPlan.push('# Next.js on Cloudflare Pages requires static export or next-on-pages (SSR). Consider Vercel for hybrid/SSR.')
                  }
                  cmdPlan.push(`wrangler pages deploy ${dir}`.trim())
                } catch {
                  cmdPlan.push('wrangler pages deploy dist')
                }
              } else if (prov === 'github') {
                // Framework-aware GitHub Pages plan
                try {
                  const det = await detectApp({ cwd: targetCwd })
                  const fw = det.framework as Framework
                  if (fw === 'astro') {
                    cmdPlan.push('gh-pages -d dist')
                  } else if (fw === 'sveltekit') {
                    cmdPlan.push('gh-pages -d build')
                  } else if (fw === 'next') {
                    cmdPlan.push('# Next.js on GitHub Pages requires static export (next.config.js: output: "export").')
                    cmdPlan.push('next build && gh-pages -d out')
                  } else {
                    const dir = det.publishDir ?? 'dist'
                    cmdPlan.push(`gh-pages -d ${dir}`)
                  }
                } catch {
                  cmdPlan.push('gh-pages -d dist')
                }
              }
              logger.jsonPrint(annotate({ ok: true, action: 'up' as const, provider: prov, target: envShort, mode: 'dry-run', cmdPlan, final: true }))
              return
            }
            logger.info(`[dry-run] up ${prov} (env=${envShort})`)
            return
          }
          const p = await loadProvider(prov)
          if (process.env.OPD_SKIP_VALIDATE !== '1') {
            try {
              await p.validateAuth(targetCwd)
            } catch {
              if (opts.ci) throw new Error(`${prov} login required`)
              const cmd = prov === 'vercel' ? 'vercel login' : prov === 'cloudflare' ? 'wrangler login' : 'git remote -v'
              logger.section('Auth')
              logger.note(`Running: ${cmd}`)
              const res = await proc.run({ cmd, cwd: targetCwd })
              let revalidated = false
              if (res.ok) {
                try { await p.validateAuth(targetCwd); revalidated = true } catch { /* ignore */ }
              }
              if (!revalidated) {
                const url = providerLoginUrl(prov)
                logger.note(`Opening provider login page: ${url}`)
                try { await openUrl(url) } catch { /* ignore */ }
                try { await p.validateAuth(targetCwd); revalidated = true } catch { /* ignore */ }
              }
              if (!revalidated) throw new Error(`${prov} login failed`)
            }
          }
          // Optional env sync for supported providers
          const wantSync: boolean = opts.syncEnv === true || process.env.OPD_SYNC_ENV === '1'
          if (wantSync && prov === 'vercel') {
            const candidates: readonly string[] = envTargetUp === 'production' ? ['.env.production.local', '.env'] : ['.env', '.env.local']
            let chosenFile: string | undefined
            for (const f of candidates) { if (await fsx.exists(join(targetCwd, f))) { chosenFile = f; break } }
            if (chosenFile) {
              logger.section('Environment')
              logger.note(`Syncing ${chosenFile} → ${prov}`)
              try {
                try { const patterns = await computeRedactors({ cwd: targetCwd, envFiles: [chosenFile], includeProcessEnv: true }); if (patterns.length > 0) logger.setRedactors(patterns) } catch { /* ignore */ }
                await envSync({ provider: prov, cwd: targetCwd, file: chosenFile, env: (opts.env === 'prod' ? 'prod' : 'preview'), yes: true, ci: Boolean(opts.ci), json: false, projectId: opts.project, orgId: opts.org, ignore: [], only: [], optimizeWrites: true })
                logger.success('Environment sync complete')
              } catch (e) { logger.warn(`Env sync skipped: ${(e as Error).message}`) }
            }
          }
          const linked = await p.link(targetCwd, { projectId: opts.project, orgId: opts.org })
          let publishDirHint: string | undefined
          let frameworkHint: string | undefined
          try { const d = await p.detect(targetCwd); publishDirHint = d.publishDir; frameworkHint = d.framework } catch { /* ignore */ }
          // Fallback: global auto-detect when provider-specific detection did not identify the framework
          if (!frameworkHint) {
            try { const d2 = await detectApp({ cwd: targetCwd }); publishDirHint = publishDirHint ?? d2.publishDir; frameworkHint = d2.framework } catch { /* ignore */ }
          }
          // Detect presence of next.config.* to strengthen preflight triggers
          let hasNextConfig = false
          try {
            const cands = ['next.config.ts', 'next.config.js', 'next.config.mjs']
            for (const f of cands) { if (await fsx.exists(join(targetCwd, f))) { hasNextConfig = true; break } }
          } catch { /* ignore */ }
          // Preflight: Next.js on GitHub Pages requires basePath/assetPrefix matching repo and static export
          if (prov === 'github' && (((frameworkHint || '').toLowerCase() === 'next') || hasNextConfig)) {
            try {
              let warned = false
              // Derive repo name from git origin
              let repo: string | undefined
              // Derive repo name for basePath/assetPrefix checks
              let repoSource: 'env' | 'origin' | 'unknown' = 'unknown'
              const ghEnv: string | undefined = process.env.GITHUB_REPOSITORY
              if (ghEnv && ghEnv.includes('/')) { repo = ghEnv.split('/')[1]; if (repo) repoSource = 'env' }
              if (!repo) {
                try {
                  const origin = await proc.run({ cmd: 'git remote get-url origin', cwd: targetCwd })
                  if (origin.ok) {
                    const t = origin.stdout.trim()
                    const httpsRe = /^https?:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/i
                    const sshRe = /^git@github\.com:(.+?)\/(.+?)(?:\.git)?$/i
                    const m1 = t.match(httpsRe); const m2 = t.match(sshRe)
                    const r = (m1?.[2] || m2?.[2] || '').trim()
                    if (r) { repo = r; repoSource = 'origin' }
                  }
                } catch { /* ignore */ }
              }
              // Read next.config.* best-effort
              let cfg = ''
              const candidates = ['next.config.ts', 'next.config.js', 'next.config.mjs']
              for (const f of candidates) {
                const pth = join(targetCwd, f)
                if (await fsx.exists(pth)) { cfg = await readFileFs(pth, 'utf8'); break }
              }
              const needsExport: boolean = cfg.length > 0 ? !/output\s*:\s*['"]export['"]/m.test(cfg) : true
              if (needsExport) { logger.warn("Next.js → GitHub Pages: set next.config output: 'export' for static export."); preflight.push({ name: "github: next.config output 'export'", ok: false, level: 'warn', message: "set output: 'export'" }); warned = true }
              const unoptOk: boolean = cfg.length > 0 ? /images\s*:\s*\{[^}]*unoptimized\s*:\s*true/m.test(cfg) : false
              if (!unoptOk) { logger.warn('Next.js → GitHub Pages: set images.unoptimized: true to avoid runtime optimization.'); preflight.push({ name: 'github: images.unoptimized true', ok: false, level: 'warn', message: 'set images.unoptimized: true' }); warned = true }
              const trailingOk: boolean = cfg.length > 0 ? /trailingSlash\s*:\s*true/m.test(cfg) : false
              if (!trailingOk) { logger.note('Next.js → GitHub Pages: trailingSlash: true is recommended for static hosting.'); preflight.push({ name: 'github: trailingSlash recommended', ok: true, level: 'note', message: 'set trailingSlash: true' }) }
              // Extract configured values
              const basePathCfgMatch = cfg.match(/basePath\s*:\s*['"]([^'\"]*)['"]/m)
              const assetPrefixCfgMatch = cfg.match(/assetPrefix\s*:\s*['"]([^'\"]*)['"]/m)
              if (repo) {
                const repoPath = `/${repo}`
                const baseMatch = cfg.length > 0 ? new RegExp(`basePath\\s*:\\s*['\"]${repoPath}['\"]`, 'm').test(cfg) : false
                if (!baseMatch) { logger.warn(`Next.js → GitHub Pages: set basePath to '${repoPath}'.`); preflight.push({ name: 'github: basePath matches repo', ok: false, level: 'warn', message: `expected basePath '${repoPath}', detected '${basePathCfgMatch?.[1] ?? ''}' (source=${repoSource})` }); warned = true }
                else { preflight.push({ name: 'github: basePath matches repo', ok: true, level: 'note', message: `basePath OK ('${repoPath}', source=${repoSource})` }) }
                const assetPresent = cfg.length > 0 ? /assetPrefix\s*:\s*['"][^'\"]+['"]/m.test(cfg) : false
                const assetMatch = cfg.length > 0 ? new RegExp(`assetPrefix\\s*:\\s*['\"]${repoPath}\/['\"]`, 'm').test(cfg) : false
                if (!assetPresent || !assetMatch) { logger.note(`Next.js → GitHub Pages: set assetPrefix to '${repoPath}/' (recommended).`); preflight.push({ name: 'github: assetPrefix recommended', ok: true, level: 'note', message: `expected assetPrefix '${repoPath}/', detected '${assetPrefixCfgMatch?.[1] ?? ''}' (source=${repoSource})` }) }
                else { preflight.push({ name: 'github: assetPrefix recommended', ok: true, level: 'note', message: `assetPrefix OK ('${repoPath}/', source=${repoSource})` }) }
              } else { logger.note('Next.js → GitHub Pages: could not derive repo name; set DEPLOY_REPO or ensure origin remote is GitHub.'); preflight.push({ name: 'github: derive repo name', ok: true, level: 'note', message: `cannot derive repo (source=${repoSource}, basePath='${basePathCfgMatch?.[1] ?? ''}', assetPrefix='${assetPrefixCfgMatch?.[1] ?? ''}')` }) }
              if (opts.strictPreflight && warned) {
                const targetShort: 'prod' | 'preview' = envTargetUp === 'production' ? 'prod' : 'preview'
                const message = 'Preflight failed (strict): resolve Next.js GitHub Pages warnings.'
                if (jsonMode) { logger.jsonPrint({ ok: false, action: 'up' as const, provider: 'github' as const, target: targetShort, message, preflightOnly: true, preflight, final: true }); throw new Error(message) }
                throw new Error(message)
              }
              // If only preflight requested, exit early
              if (opts.preflightOnly === true) {
                const targetShort: 'prod' | 'preview' = envTargetUp === 'production' ? 'prod' : 'preview'
                if (jsonMode) { logger.jsonPrint({ ok: true, action: 'up' as const, provider: 'github' as const, target: targetShort, preflightOnly: true, preflight, final: true }); return }
                logger.success('Preflight checks completed (GitHub Pages). No build/publish performed.')
                return
              }
            } catch { /* ignore preflight errors */ }
          }
          // Preflight: Next.js on Cloudflare Pages (Next on Pages) should NOT use basePath/assetPrefix or output: 'export'
          if (prov === 'cloudflare' && (((frameworkHint || '').toLowerCase() === 'next') || hasNextConfig)) {
            try {
              let warned = false
              // Read next.config.* best-effort
              let cfg = ''
              const candidates = ['next.config.ts', 'next.config.js', 'next.config.mjs']
              for (const f of candidates) {
                const pth = join(targetCwd, f)
                if (await fsx.exists(pth)) { cfg = await readFileFs(pth, 'utf8'); break }
              }
              if (cfg.length > 0) {
                const hasOutputExport: boolean = /output\s*:\s*['"]export['"]/m.test(cfg)
                if (hasOutputExport) { logger.note('Next.js → Cloudflare Pages: omit output: "export" when using Next on Pages (SSR/hybrid).'); preflight.push({ name: 'cloudflare: next.config output export omitted', ok: false, level: 'warn', message: 'remove output: "export"' }); warned = true }
                const hasAssetPrefix: boolean = /assetPrefix\s*:\s*['"][^'\"]+['"]/m.test(cfg)
                if (hasAssetPrefix) { logger.warn('Next.js → Cloudflare Pages: remove assetPrefix; serve at root for Next on Pages.'); preflight.push({ name: 'cloudflare: assetPrefix absent', ok: false, level: 'warn', message: 'remove assetPrefix' }); warned = true }
                const basePathMatch = cfg.match(/basePath\s*:\s*['"]([^'\"]*)['"]/m)
                if (basePathMatch && basePathMatch[1] && basePathMatch[1] !== '') { logger.warn('Next.js → Cloudflare Pages: basePath should be empty for Next on Pages.'); preflight.push({ name: 'cloudflare: basePath empty', ok: false, level: 'warn', message: 'set basePath to ""' }); warned = true }
                const trailingTrue: boolean = /trailingSlash\s*:\s*true/m.test(cfg)
                if (trailingTrue) { logger.note('Next.js → Cloudflare Pages: trailingSlash: false is recommended.'); preflight.push({ name: 'cloudflare: trailingSlash recommended false', ok: true, level: 'note', message: 'set trailingSlash: false' }) }
              }
              // wrangler.toml checks
              const wranglerPath = join(targetCwd, 'wrangler.toml')
              if (await fsx.exists(wranglerPath)) {
                const raw = await readFileFs(wranglerPath, 'utf8')
                if (!/pages_build_output_dir\s*=\s*"\.vercel\/output\/static"/m.test(raw)) { logger.warn('Cloudflare Pages: set pages_build_output_dir = ".vercel/output/static".'); preflight.push({ name: 'cloudflare: wrangler pages_build_output_dir', ok: false, level: 'warn', message: 'set to .vercel/output/static' }); warned = true }
                if (!/pages_functions_directory\s*=\s*"\.vercel\/output\/functions"/m.test(raw)) { logger.note('Cloudflare Pages: set pages_functions_directory = ".vercel/output/functions".'); preflight.push({ name: 'cloudflare: wrangler pages_functions_directory', ok: true, level: 'note', message: 'set to .vercel/output/functions' }) }
                if (!/compatibility_flags\s*=\s*\[.*"nodejs_compat".*\]/m.test(raw)) { logger.note('Cloudflare Pages: add compatibility_flags = ["nodejs_compat"].'); preflight.push({ name: 'cloudflare: wrangler nodejs_compat flag', ok: true, level: 'note', message: 'add compatibility_flags = ["nodejs_compat"]' }) }
              } else {
                logger.note('Cloudflare Pages: missing wrangler.toml (generate with: opd generate cloudflare --next-on-pages).')
                preflight.push({ name: 'cloudflare: wrangler.toml present', ok: false, level: 'warn', message: 'missing wrangler.toml' })
              }
              // Windows guidance
              if (process.platform === 'win32') { logger.note('Tip: Next on Pages is more reliable in CI/Linux or WSL. Consider using the provided GitHub Actions workflow.'); preflight.push({ name: 'cloudflare: windows guidance', ok: true, level: 'note', message: 'prefer CI/Linux or WSL' }) }
              if (opts.strictPreflight && warned) {
                const targetShort: 'prod' | 'preview' = envTargetUp === 'production' ? 'prod' : 'preview'
                const message = 'Preflight failed (strict): resolve Next.js Cloudflare Pages warnings.'
                if (jsonMode) { logger.jsonPrint({ ok: false, action: 'up' as const, provider: 'cloudflare' as const, target: targetShort, message, preflightOnly: true, preflight, final: true }); throw new Error(message) }
                throw new Error(message)
              }
              // If only preflight requested, exit early
              if (opts.preflightOnly === true) {
                const targetShort: 'prod' | 'preview' = envTargetUp === 'production' ? 'prod' : 'preview'
                if (jsonMode) { logger.jsonPrint({ ok: true, action: 'up' as const, provider: 'cloudflare' as const, target: targetShort, preflightOnly: true, preflight, final: true }); return }
                logger.success('Preflight checks completed (Cloudflare Pages). No build/publish performed.')
                return
              }
            } catch { /* ignore preflight errors */ }
          }
          const t0 = Date.now()
          const buildRes = await p.build({ cwd: targetCwd, framework: frameworkHint, envTarget: envTargetUp, publishDirHint, noBuild: Boolean(opts.noBuild) })
          const buildSchemaOk: boolean = validateBuild(buildRes as unknown as Record<string, unknown>) as boolean
          const buildSchemaErrors: string[] = Array.isArray(validateBuild.errors) ? validateBuild.errors.map(e => `${e.instancePath || '/'} ${e.message ?? ''}`.trim()) : []
          // Failure propagation: abort on provider build failure
          if (!buildRes.ok) {
            const targetShort: 'prod' | 'preview' = envTargetUp === 'production' ? 'prod' : 'preview'
            const message: string = buildRes.message || 'Build failed'
            if (jsonMode) { logger.jsonPrint(annotate({ ok: false, action: 'up' as const, provider: prov as any, target: targetShort, message, preflight, buildSchemaOk, buildSchemaErrors, final: true })); process.exit(1) }
            throw new Error(message)
          }
          // If user requested --no-build, ensure artifact dir exists before deploying
          if (prov === 'github' && opts.noBuild === true) {
            try {
              const exists = await fsx.exists(buildRes.artifactDir!)
              if (!exists) {
                const targetShort: 'prod' | 'preview' = envTargetUp === 'production' ? 'prod' : 'preview'
                const hint = frameworkHint && frameworkHint.toLowerCase() === 'next'
                  ? 'Run: pnpm -C apps/docs run build && pnpm -C apps/docs exec next export (creates out)'
                  : 'Build your site locally to produce the publish directory (e.g., dist)'
                const message = `Publish directory not found: ${buildRes.artifactDir}. ${hint}`
                if (jsonMode) { logger.jsonPrint(annotate({ ok: false, action: 'up' as const, provider: 'github' as const, target: targetShort, message, preflight, buildSchemaOk, buildSchemaErrors, final: true })); process.exit(1) }
                throw new Error(message)
              }
            } catch { /* if fs check fails, fall through to deploy */ }
          }
          // Asset sanity: for Next.js ensure _next/static exists in artifact
          const skipAssetSanity: boolean = process.env.OPD_SKIP_ASSET_SANITY === '1'
          try {
            const fwLower = (frameworkHint || '').toLowerCase()
            if (!skipAssetSanity && fwLower === 'next' && typeof buildRes.artifactDir === 'string' && buildRes.artifactDir.length > 0) {
              const assetsDir = join(buildRes.artifactDir, '_next', 'static')
              const exists = await fsx.exists(assetsDir)
              if (!exists) {
                const expected = prov === 'cloudflare' ? '.vercel/output/static/_next/static' : 'out/_next/static'
                const why = `Asset check failed: ${expected} missing in artifactDir=${buildRes.artifactDir}. Ensure the build produced Next static assets.`
                throw new Error(why)
              }
            }
          } catch (e) {
            const targetShort: 'prod' | 'preview' = envTargetUp === 'production' ? 'prod' : 'preview'
            const message: string = (e as Error).message
            if (jsonMode) { logger.jsonPrint(annotate({ ok: false, action: 'up' as const, provider: prov, target: targetShort, message, preflight, buildSchemaOk, buildSchemaErrors, final: true })); return }
            throw e
          }
          // If only preflight of artifacts was requested, exit early (no deploy)
          if (opts.preflightArtifactsOnly === true) {
            const targetShort: 'prod' | 'preview' = envTargetUp === 'production' ? 'prod' : 'preview'
            if (jsonMode) { logger.jsonPrint(annotate({ ok: true, action: 'up' as const, provider: prov, target: targetShort, preflightArtifactsOnly: true, artifactDir: buildRes.artifactDir, preflight, final: true })); return }
            logger.success('Artifact preflight completed. No deploy performed.')
            return
          }
          // Optional preflight fix-ups (GitHub Pages: ensure .nojekyll in artifactDir)
          if (prov === 'github' && opts.fixPreflight === true && typeof buildRes.artifactDir === 'string' && buildRes.artifactDir.length > 0) {
            try {
              const marker = join(buildRes.artifactDir, '.nojekyll')
              const exists = await fsx.exists(marker)
              if (!exists) {
                await (await import('node:fs/promises')).writeFile(marker, '', 'utf8')
                preflight.push({ name: 'github: .nojekyll ensured', ok: true, level: 'note', message: `written: ${marker}` })
              } else {
                preflight.push({ name: 'github: .nojekyll ensured', ok: true, level: 'note', message: 'present' })
              }
            } catch { /* ignore write errors */ }
          }
          const deployRes = await p.deploy({ cwd: targetCwd, envTarget: envTargetUp, project: linked, artifactDir: buildRes.artifactDir, alias: opts.alias })
          const deploySchemaOk: boolean = validateDeploy(deployRes as unknown as Record<string, unknown>) as boolean
          const deploySchemaErrors: string[] = Array.isArray(validateDeploy.errors) ? validateDeploy.errors.map(e => `${e.instancePath || '/'} ${e.message ?? ''}`.trim()) : []
          const durationMs = Date.now() - t0
          const targetShort: 'prod' | 'preview' = envTargetUp === 'production' ? 'prod' : 'preview'
          if (jsonMode && !deployRes.ok) {
            const message: string = deployRes.message || 'Deploy failed'
            logger.jsonPrint(annotate({ ok: false, action: 'up' as const, provider: prov, target: targetShort, message, url: deployRes.url, logsUrl: deployRes.logsUrl, preflight, buildSchemaOk, buildSchemaErrors, deploySchemaOk, deploySchemaErrors, final: true }))
            return
          }
          if (jsonMode) { logger.jsonPrint(annotate({ ok: true, action: 'up' as const, provider: prov, target: targetShort, url: deployRes.url, logsUrl: deployRes.logsUrl, durationMs, preflight, buildSchemaOk, buildSchemaErrors, deploySchemaOk, deploySchemaErrors, final: true })); return }
          if (deployRes.ok) {
            if (deployRes.url) logger.success(`${opts.env === 'prod' ? 'Production' : 'Preview'}: ${deployRes.url}`)
            else logger.success(`${opts.env === 'prod' ? 'Production' : 'Preview'} deploy complete`)
          } else {
            const message: string = deployRes.message || 'Deploy failed'
            if (deployRes.logsUrl) logger.info(`Logs: ${deployRes.logsUrl}`)
            throw new Error(message)
          }
          return
        }
        // Detection is optional for generic providers; keep 'up' framework-agnostic
        // Env sync first (preview)
        const envTarget: 'prod' | 'preview' = opts.env === 'prod' ? 'prod' : 'preview'
        // Early dry-run summary
        if (opts.dryRun === true) {
          if (jsonMode) {
            const prov: 'vercel' = 'vercel'
            const cmdPlan: string[] = []
            if (opts.project || opts.org) cmdPlan.push(`vercel link --yes${opts.project ? ` --project ${opts.project}` : ''}${opts.org ? ` --org ${opts.org}` : ''}`.trim())
            cmdPlan.push(envTarget === 'prod' ? 'vercel deploy --prod --yes' : 'vercel deploy --yes')
            if (opts.alias) cmdPlan.push(`vercel alias set <deployment-url> ${opts.alias}`)
            const summary = { ok: true, action: 'up' as const, provider: prov, target: envTarget, mode: 'dry-run', cmdPlan, final: true }
            logger.jsonPrint(annotate(summary as unknown as Record<string, unknown>))
          } else {
            logger.info(`[dry-run] up ${provider} (env=${envTarget})`)
          }
          return
        }
        const wantSync: boolean = opts.syncEnv === true || process.env.OPD_SYNC_ENV === '1'
        if (wantSync && provider === 'vercel') {
          const candidates: readonly string[] = envTarget === 'prod' ? ['.env.production.local', '.env'] : ['.env', '.env.local']
          let chosenFile: string | undefined
          for (const f of candidates) { if (await fsx.exists(join(targetCwd, f))) { chosenFile = f; break } }
          if (chosenFile) {
            logger.section('Environment')
            logger.note(`Syncing ${chosenFile} → ${provider}`)
            if (ndjsonOn) logger.json({ ok: true, action: 'up', stage: 'envSyncStart', provider, target: envTarget, file: chosenFile })
            try {
              // Strengthen redaction: load secrets from selected env file and process.env
              try { const patterns = await computeRedactors({ cwd: targetCwd, envFiles: [chosenFile], includeProcessEnv: true }); if (patterns.length > 0) logger.setRedactors(patterns) } catch { /* ignore */ }
              await envSync({ provider: 'vercel', cwd: targetCwd, file: chosenFile, env: envTarget, yes: true, ci: Boolean(opts.ci), json: false, projectId: opts.project, orgId: opts.org, ignore: [], only: [], optimizeWrites: true })
              logger.success('Environment sync complete')
              if (ndjsonOn) logger.json({ ok: true, action: 'up', stage: 'envSyncDone', provider, target: envTarget })
            } catch (e) {
              logger.warn(`Env sync skipped: ${(e as Error).message}`)
            }
          } else {
            logger.note('No local .env file found to sync')
          }
        }
        if (provider === 'vercel') {
          // Prefer linked app directory (target) if available; otherwise root if only root is linked
          const targetLink: string = join(targetCwd, '.vercel', 'project.json')
          const rootLink: string = join(rootCwd, '.vercel', 'project.json')
          const targetIsLinked: boolean = await fsx.exists(targetLink)
          const rootIsLinked: boolean = await fsx.exists(rootLink)
          const runCwd: string = targetIsLinked ? targetCwd : (rootIsLinked && !targetIsLinked ? rootCwd : targetCwd)
          if (runCwd !== targetCwd) logger.info(`Using linked directory for Vercel deploy: ${runCwd}`)
          // Ensure link when IDs are provided and chosen cwd is not already linked
          if ((opts.project || opts.org) && !(await fsx.exists(join(runCwd, '.vercel', 'project.json')))) {
            const flags: string[] = ['--yes']
            if (opts.project) flags.push(`--project ${opts.project}`)
            if (opts.org) flags.push(`--org ${opts.org}`)
            if (opts.printCmd) logger.info(`$ vercel link ${flags.join(' ')}`)
            if (ndjsonOn) logger.json({ ok: true, action: 'up', stage: 'linking', provider: 'vercel', cwd: runCwd, flags })
            await runWithRetry({ cmd: `vercel link ${flags.join(' ')}`, cwd: runCwd })
          }
          const sp = spinner(`Vercel: deploying (${envTarget === 'prod' ? 'production' : 'preview'})`)
          const stop: Stopper = startHeartbeat({ label: 'vercel deploy', hint: 'Tip: opendeploy open vercel', intervalMs: ndjsonOn ? 5000 : 10000 })
          let capturedUrl: string | undefined
          let capturedInspect: string | undefined
          const urlRe = /https?:\/\/[^\s]+vercel\.app/g
          if (ndjsonOn) logger.json({ ok: true, action: 'up', stage: 'deployStart', provider: 'vercel', target: envTarget })
          const deployTimeout = Number.isFinite(Number(process.env.OPD_TIMEOUT_MS)) ? Number(process.env.OPD_TIMEOUT_MS) : 900_000
          const controller = proc.spawnStream({
            cmd: envTarget === 'prod' ? 'vercel deploy --prod --yes' : 'vercel deploy --yes',
            cwd: runCwd,
            timeoutMs: deployTimeout,
            onStdout: (chunk: string): void => {
              const m = chunk.match(urlRe)
              if (!capturedUrl && m && m.length > 0) {
                capturedUrl = m[0]
                if (ndjsonOn) logger.json({ ok: true, action: 'up', stage: 'url', provider: 'vercel', url: capturedUrl })
              }
              if (process.env.OPD_JSON !== '1' && process.env.OPD_NDJSON !== '1') {
                const t = chunk.replace(/\s+$/, '')
                if (t.length > 0) logger.info(t)
              }
            },
            onStderr: (chunk: string): void => {
              if (!capturedInspect) {
                const found = extractVercelInspectUrl(chunk)
                if (found) {
                  capturedInspect = found
                  if (ndjsonOn) logger.json({ ok: true, action: 'up', stage: 'logsUrl', provider: 'vercel', logsUrl: capturedInspect })
                }
              }
            }
          })
          const res = await controller.done
          stop(); sp.stop()
          if (!res.ok) throw new Error('Vercel deploy failed')
          // Fallback: resolve Inspect URL after deploy when not captured from stream
          if (!capturedInspect && capturedUrl) {
            try {
              const insp = await proc.run({ cmd: `vercel inspect ${capturedUrl}`, cwd: runCwd })
              const text: string = (insp.stdout || '') + '\n' + (insp.stderr || '')
              const found = extractVercelInspectUrl(text)
              if (found) capturedInspect = found
            } catch { /* ignore */ }
            // Final fallback: construct a stable Inspect link that at least points to Vercel dashboard
            if (!capturedInspect) capturedInspect = `https://vercel.com/inspect?url=${encodeURIComponent(capturedUrl)}`
          }
          if (ndjsonOn) logger.json({ ok: true, action: 'up', stage: 'deployed', provider: 'vercel', target: envTarget, url: capturedUrl, logsUrl: capturedInspect })
          // Optional alias
          let aliasUrl: string | undefined
          if (capturedUrl && opts.alias) {
            const aliasCmd = `vercel alias set ${capturedUrl} ${opts.alias}`.trim()
            if (opts.printCmd) logger.info(`$ ${aliasCmd}`)
            const al = await runWithRetry({ cmd: aliasCmd, cwd: runCwd })
            if (al.ok) aliasUrl = `https://${opts.alias}`
            if (ndjsonOn && aliasUrl) logger.json({ ok: true, action: 'up', stage: 'aliasSet', provider: 'vercel', aliasUrl })
          }
          if (jsonMode) { logger.jsonPrint({ ok: true, action: 'up' as const, provider: 'vercel' as const, target: envTarget, url: capturedUrl, logsUrl: capturedInspect, aliasUrl, final: true }); return }
          if (capturedUrl) logger.success(`${envTarget === 'prod' ? 'Production' : 'Preview'}: ${capturedUrl}`)
          if (aliasUrl) logger.success(`Aliased: ${aliasUrl}`)
          printDeploySummary({ provider: 'vercel', target: envTarget, url: capturedUrl, logsUrl: capturedInspect })
          return
        }
        
        logger.error(`Unknown provider: ${provider}`)
        process.exitCode = 1
      } catch (err) {
        const msg: string = err instanceof Error ? err.message : String(err)
        if (isJsonMode(opts.json)) {
          logger.jsonPrint({ ok: false, action: 'up' as const, provider, message: msg, final: true })
          throw new Error(msg)
        }
        logger.error(msg)
        process.exitCode = 1
      }
    })
}

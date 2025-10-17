import { Command } from 'commander'
import { logger, isJsonMode } from '../utils/logger'
import { detectNextApp } from '../core/detectors/next'
import { loadProvider } from '../core/provider-system/provider'
import type { DeployInputs } from '../types/deploy-inputs'
import type { DetectionResult } from '../types/detection-result'
import { join, isAbsolute } from 'node:path'
import { readFile } from 'node:fs/promises'
import { fsx } from '../utils/fs'
import { proc, runWithRetry } from '../utils/process'
import { startHeartbeat, type Stopper } from '../utils/progress'
import { spinner } from '../utils/ui'
import { mapProviderError } from '../utils/errors'
import { printDeploySummary } from '../utils/summarize'
import { envSync } from './env'
// duplicate import removed
import { computeRedactors } from '../utils/redaction'
import { resolveAppPath } from '../core/detectors/apps'

interface DeployOptions {
  readonly env?: 'prod' | 'preview'
  readonly project?: string
  readonly org?: string
  readonly dryRun?: boolean
  readonly json?: boolean
  readonly path?: string
  readonly ci?: boolean
  readonly syncEnv?: boolean
  readonly alias?: string
}

/**
 * Register the `deploy` command.
 */
export function registerDeployCommand(program: Command): void {
  program
    .command('deploy')
    .description('Deploy the detected app to a provider')
    .argument('<provider>', 'Target provider: vercel | cloudflare | github')
    .option('--env <env>', 'Environment: prod | preview', 'preview')
    .option('--project <id>', 'Provider project/site ID')
    .option('--org <id>', 'Provider org/team ID')
    .option('--dry-run', 'Do not execute actual deployment')
    .option('--json', 'Output JSON result')
    .option('--path <dir>', 'Path to app directory (for monorepos)')
    .option('--ci', 'CI mode (non-interactive)')
    .option('--sync-env', 'Sync environment variables from a local .env before deploy')
    .option('--alias <domain>', 'After deploy, assign this alias to the deployment (vercel only)')
    .action(async (provider: string, opts: DeployOptions): Promise<void> => {
      const rootCwd: string = process.cwd()
      // Resolve target app path for monorepos when --path is not specified
      let targetCwd: string
      if (opts.path && opts.path.length > 0) {
        targetCwd = isAbsolute(opts.path) ? opts.path : join(rootCwd, opts.path)
      } else {
        const ciMode: boolean = Boolean(opts.ci) || process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true' || process.env.OPD_FORCE_CI === '1' || process.env.OPD_NDJSON === '1' || process.env.OPD_JSON === '1'
        const resolved = await resolveAppPath({ cwd: rootCwd, ci: ciMode })
        targetCwd = resolved.path
        if (process.env.OPD_NDJSON === '1') logger.json({ event: 'app-path', path: targetCwd, candidates: resolved.candidates, provider })
        else if (targetCwd !== rootCwd) logger.note(`Detected app path: ${targetCwd}`)
      }
      try {
        const jsonMode: boolean = isJsonMode(opts.json)
        if (jsonMode) logger.setJsonOnly(true)
        // Enable NDJSON mode when OPD_NDJSON=1 is present
        const ndjsonOn: boolean = process.env.OPD_NDJSON === '1'
        if (ndjsonOn) logger.setNdjson(true)
        // Force CI-friendly env to suppress interactive prompts in child processes
        if (jsonMode || opts.ci === true || ndjsonOn) {
          process.env.OPD_FORCE_CI = '1'
        }
        // Default: provider plugin flow. Use legacy only when OPD_LEGACY=1.
        if (process.env.OPD_LEGACY !== '1') {
          // Dry-run summary (no external side effects)
          if (opts.dryRun === true) {
            if (jsonMode) {
              const canonicalProvider: string = provider === 'github' ? 'github-pages' : (provider === 'cloudflare' ? 'cloudflare-pages' : provider)
              const payload = { provider: canonicalProvider, target: (opts.env === 'prod' ? 'prod' : 'preview'), mode: 'dry-run', hints: [] as string[], final: true }
              logger.jsonPrint(payload)
              try { /* eslint-disable-next-line no-console */ console.log(JSON.stringify(payload)) } catch { /* ignore */ }
              return
            }
            logger.info(`[dry-run] ${provider} deploy (plugins) (cwd=${targetCwd})`)
            return
          }
          const p = await loadProvider(provider)
          if (process.env.OPD_SKIP_VALIDATE !== '1') {
            await p.validateAuth(targetCwd)
          }
          // Optional env sync for first-class providers
          const wantSync: boolean = opts.syncEnv === true || process.env.OPD_SYNC_ENV === '1'
          if (wantSync && provider === 'vercel') {
            const envTarget: 'prod' | 'preview' = opts.env === 'prod' ? 'prod' : 'preview'
            const candidates: readonly string[] = envTarget === 'prod' ? ['.env.production.local', '.env'] : ['.env', '.env.local']
            let chosenFile: string | undefined
            for (const f of candidates) { if (await fsx.exists(join(targetCwd, f))) { chosenFile = f; break } }
            if (chosenFile) {
              logger.section('Environment')
              logger.note(`Syncing ${chosenFile} → ${provider}`)
              try {
                try { const patterns = await computeRedactors({ cwd: targetCwd, envFiles: [chosenFile], includeProcessEnv: true }); if (patterns.length > 0) logger.setRedactors(patterns) } catch { /* ignore */ }
                await envSync({ provider: 'vercel', cwd: targetCwd, file: chosenFile, env: envTarget, yes: true, ci: Boolean(opts.ci), json: false, projectId: opts.project, orgId: opts.org, ignore: [], only: [] })
                logger.success('Environment sync complete')
              } catch (e) { logger.warn(`Env sync skipped: ${(e as Error).message}`) }
            }
          }
          // Always perform a link step so providers can derive or create a project when missing
          const linked = await p.link(targetCwd, { projectId: opts.project, orgId: opts.org })
          const envTarget: 'preview' | 'production' = opts.env === 'prod' ? 'production' : 'preview'
          // Detection hints for publishDir/framework
          let publishDirHint: string | undefined
          let frameworkHint: string | undefined
          try {
            const d = await p.detect(targetCwd)
            publishDirHint = d.publishDir
            frameworkHint = d.framework
          } catch { /* ignore */ }
          const t0: number = Date.now()
          const buildRes = await p.build({ cwd: targetCwd, framework: frameworkHint, envTarget, publishDirHint, noBuild: false })
          const deployRes = await p.deploy({ cwd: targetCwd, envTarget, project: linked, artifactDir: buildRes.artifactDir, alias: opts.alias })
          const durationMs: number = Date.now() - t0
          const canonicalProvider: string = provider === 'github' ? 'github-pages' : (provider === 'cloudflare' ? 'cloudflare-pages' : provider)
          if (jsonMode && !deployRes.ok) {
            const message: string = deployRes.message || 'Deploy failed'
            logger.jsonPrint({ ok: false, action: 'deploy' as const, provider: canonicalProvider, target: (opts.env === 'prod' ? 'prod' : 'preview'), url: deployRes.url, logsUrl: deployRes.logsUrl, projectId: linked.projectId ?? opts.project, durationMs, hints: [] as string[], message, final: true })
            return
          }
          if (jsonMode) {
            logger.jsonPrint({ ok: true, action: 'deploy' as const, provider: canonicalProvider, target: (opts.env === 'prod' ? 'prod' : 'preview'), url: deployRes.url, logsUrl: deployRes.logsUrl, projectId: linked.projectId ?? opts.project, durationMs, hints: [] as string[], final: true })
            return
          }
          if (deployRes.ok) {
            if (deployRes.url) logger.success(`Deployed: ${deployRes.url}`)
            else logger.success('Deployed')
            printDeploySummary({ provider: provider as 'vercel' | 'cloudflare' | 'github', target: (opts.env === 'prod' ? 'prod' : 'preview'), url: deployRes.url, projectId: linked.projectId ?? opts.project, durationMs, logsUrl: deployRes.logsUrl })
          } else {
            const message: string = deployRes.message || 'Deploy failed'
            if (deployRes.logsUrl) logger.info(`Logs: ${deployRes.logsUrl}`)
            throw new Error(message)
          }
          return
        }
        const detection: DetectionResult = await detectNextApp({ cwd: targetCwd })
        // Optional: pre-deploy env sync for single-command UX
        const wantSync: boolean = opts.syncEnv === true || process.env.OPD_SYNC_ENV === '1'
        if (!opts.dryRun && wantSync) {
          const envTarget: 'prod' | 'preview' = opts.env === 'prod' ? 'prod' : 'preview'
          const candidates: readonly string[] = envTarget === 'prod'
            ? ['.env.production.local', '.env']
            : ['.env', '.env.local']
          let chosenFile: string | undefined
          for (const f of candidates) { if (await fsx.exists(join(targetCwd, f))) { chosenFile = f; break } }
          if (chosenFile) {
            logger.section('Environment')
            logger.note(`Syncing ${chosenFile} → ${provider}`)
            try {
              // Strengthen redaction: load secrets from selected env file and process.env
              try { const patterns = await computeRedactors({ cwd: targetCwd, envFiles: [chosenFile], includeProcessEnv: true }); if (patterns.length > 0) logger.setRedactors(patterns) } catch { /* ignore */ }
              await envSync({ provider: 'vercel', cwd: targetCwd, file: chosenFile, env: envTarget, yes: true, ci: Boolean(opts.ci), json: false, projectId: opts.project, orgId: opts.org, ignore: [], only: [] })
              logger.success('Environment sync complete')
            } catch (e) {
              logger.warn(`Env sync skipped: ${(e as Error).message}`)
            }
          } else {
            logger.note('No local .env file found to sync')
          }
        }

        if (provider === 'vercel') {
          const plugin = await loadProvider('vercel')
          await plugin.validateAuth(targetCwd)
          // Choose cwd for Vercel deploy in monorepos:
          // - Prefer target app directory when it is linked (has .vercel/project.json)
          // - Otherwise, if root is linked and target is not, deploy from root
          // - Else, default to target
          const targetLink: string = join(targetCwd, '.vercel', 'project.json')
          const rootLink: string = join(rootCwd, '.vercel', 'project.json')
          const targetIsLinked: boolean = await fsx.exists(targetLink)
          const rootIsLinked: boolean = await fsx.exists(rootLink)
          const runCwd: string = targetIsLinked ? targetCwd : (rootIsLinked && !targetIsLinked ? rootCwd : targetCwd)
          if (runCwd !== targetCwd) logger.info(`Using linked directory for Vercel deploy: ${runCwd}`)
          if (!opts.dryRun) {
            const sp = spinner('Vercel: preparing')
            if (process.env.OPD_NDJSON === '1') logger.json({ event: 'phase', phase: 'prepare', provider: 'vercel', path: runCwd })
            // If deploying from target dir and IDs provided, ensure it's linked
            if (runCwd === targetCwd && (opts.project || opts.org)) {
              const linkFlags: string[] = ['--yes']
              if (opts.project) linkFlags.push(`--project ${opts.project}`)
              if (opts.org) linkFlags.push(`--org ${opts.org}`)
              await proc.run({ cmd: `vercel link ${linkFlags.join(' ')}`, cwd: runCwd })
            }
            // Prefer local build + prebuilt deploy for monorepos or when explicitly requested
            let cmd: string = opts.env === 'prod' ? 'vercel deploy --prod --yes' : 'vercel deploy --yes'
            let usedPrebuilt = false
            try {
              const hasWorkspace: boolean = await fsx.exists(join(rootCwd, 'pnpm-workspace.yaml'))
              const targetHasLock: boolean = await fsx.exists(join(runCwd, 'pnpm-lock.yaml'))
              const wantLocalBuild: boolean = process.env.OPD_LOCAL_BUILD === '1' || (hasWorkspace && !targetHasLock)
              if (wantLocalBuild) {
                sp.update('Vercel: local build')
                const buildCmd: string = 'vercel build'
                const build = await proc.run({ cmd: buildCmd, cwd: runCwd })
                if (!build.ok) { throw new Error(build.stderr.trim() || build.stdout.trim() || 'Vercel local build failed') }
                cmd = opts.env === 'prod' ? 'vercel deploy --prebuilt --prod --yes' : 'vercel deploy --prebuilt --yes'
                usedPrebuilt = true
              }
            } catch { /* fall back to remote build */ }
            const deployTimeout: number = Number.isFinite(Number(process.env.OPD_TIMEOUT_MS)) ? Number(process.env.OPD_TIMEOUT_MS) : 900_000
            const t0: number = Date.now()
            if (process.env.OPD_NDJSON === '1') logger.json({ event: 'phase', phase: 'deploy', provider: 'vercel', command: cmd, cwd: runCwd, prebuilt: usedPrebuilt })
            sp.update('Vercel: deploying')
            const stop: Stopper = startHeartbeat({ label: 'vercel deploy', hint: 'Tip: opendeploy open vercel --path apps/web', intervalMs: process.env.OPD_NDJSON === '1' ? 5000 : 10000 })
            let capturedUrl: string | undefined
            let capturedInspect: string | undefined
            const urlRe = /https?:\/\/[^\s]+vercel\.app/g
            const inspectRe = /https?:\/\/[^\s]*vercel\.com[^\s]*/g
            const controller = proc.spawnStream({
              cmd,
              cwd: runCwd,
              timeoutMs: deployTimeout,
              onStdout: (chunk: string): void => {
                if (process.env.OPD_NDJSON === '1') logger.json({ event: 'vc:stdout', line: chunk })
                const m = chunk.match(urlRe)
                if (!capturedUrl && m && m.length > 0) capturedUrl = m[0]
                if (process.env.OPD_NDJSON !== '1' && process.env.OPD_JSON !== '1') {
                  const t = chunk.replace(/\s+$/,'')
                  if (t.length > 0) logger.info(t)
                }
              },
              onStderr: (chunk: string): void => {
                if (process.env.OPD_NDJSON === '1') logger.json({ event: 'vc:stderr', line: chunk })
                if (!capturedInspect) {
                  const im = chunk.match(inspectRe)
                  if (im && im.length > 0) capturedInspect = im[0]
                }
                // Human-mode phase hints
                if (process.env.OPD_NDJSON !== '1' && process.env.OPD_JSON !== '1') {
                  const s = chunk.toLowerCase()
                  if (s.includes('queued')) sp.update('Vercel: queued')
                  else if (s.includes('building')) sp.update('Vercel: building')
                  else if (s.includes('completing')) sp.update('Vercel: completing')
                }
              }
            })
            const res = await controller.done
            stop()
            const durationMs: number = Date.now() - t0
            if (!res.ok) throw new Error('Vercel deploy failed')
            const url: string | undefined = capturedUrl
            const logsUrl: string | undefined = capturedInspect
            // Fallback: derive Inspect URL if not printed by CLI but we have deployment URL
            let finalLogsUrl: string | undefined = logsUrl
            if (!finalLogsUrl && url) {
              try {
                const insp = await proc.run({ cmd: `vercel inspect ${url}`.trim(), cwd: runCwd })
                const text: string = (insp.stdout || '') + '\n' + (insp.stderr || '')
                const m = text.match(inspectRe)
                if (m && m.length > 0) finalLogsUrl = m[0]
              } catch { /* ignore */ }
            }
            // Try to read projectId from chosen cwd
            let projectId: string | undefined
            try {
              const p = join(runCwd, '.vercel', 'project.json')
              const buf = await readFile(p, 'utf8')
              const js = JSON.parse(buf) as { projectId?: string }
              if (typeof js.projectId === 'string') projectId = js.projectId
            } catch { /* ignore */ }
            // Optional alias step
            let aliasUrl: string | undefined
            if (url && opts.alias) {
              try {
                const al = await proc.run({ cmd: `vercel alias set ${url} ${opts.alias}`.trim(), cwd: runCwd })
                if (al.ok) aliasUrl = `https://${opts.alias}`
              } catch { /* ignore alias errors */ }
            }
            if (opts.json === true || process.env.OPD_NDJSON === '1') {
              logger.json({ url, logsUrl: finalLogsUrl, aliasUrl, projectId, provider: 'vercel', target: (opts.env === 'prod' ? 'prod' : 'preview'), durationMs, final: true })
              return
            }
            sp.succeed(url ? `Vercel: deployed ${url}` : 'Vercel: deployed')
            if (url !== undefined) logger.success(`Deployed: ${url}`)
            if (aliasUrl) logger.success(`Aliased: ${aliasUrl}`)
            printDeploySummary({ provider: 'vercel', target: (opts.env === 'prod' ? 'prod' : 'preview'), url, projectId, durationMs, logsUrl: finalLogsUrl })
            return
          }
          if (opts.dryRun === true) {
            const flags: string = opts.env === 'prod' ? '--prod --yes' : '--yes'
            logger.info(`[dry-run] vercel ${flags} (cwd=${targetCwd})`)
            if (opts.json === true || process.env.OPD_NDJSON === '1') {
              logger.json({ provider: 'vercel', target: (opts.env === 'prod' ? 'prod' : 'preview'), mode: 'dry-run', final: true })
            }
            return
          }
          // legacy adapter-based deploy path removed; streaming deploy above covers Vercel
          return
        }
        // Netlify path removed; use official Netlify CLI instead.
        logger.error(`Unknown provider: ${provider}`)
        process.exitCode = 1
      } catch (err) {
        const raw: string = err instanceof Error ? err.message : String(err)
        const info = mapProviderError(provider, raw)
        // Emit machine-readable error if JSON/NDJSON requested
        if (process.env.OPD_JSON === '1' || process.env.OPD_NDJSON === '1') {
          const canonicalProvider: string = provider === 'github' ? 'github-pages' : (provider === 'cloudflare' ? 'cloudflare-pages' : provider)
          logger.json({ ok: false, command: 'deploy', provider: canonicalProvider, target: opts.env ?? 'preview', path: opts.path, code: info.code, message: info.message, remedy: info.remedy, error: raw, final: true })
        }
        logger.error(`${info.message} (${info.code})`)
        if (info.remedy) logger.info(`Try: ${info.remedy}`)
        const annMode = process.env.OPD_GHA_ANN
        const inCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
        if (inCI && annMode !== 'off') {
          const sev = annMode === 'error' ? 'error' : 'warning'
          // eslint-disable-next-line no-console
          console.log(`::${sev} ::${info.message}${info.remedy ? ` | Try: ${info.remedy}` : ''}`)
        }
        process.exitCode = 1
      }
    })

  // Lightweight: deploy logs
  program
    .command('logs')
    .description('Open or tail provider logs for the last deployment')
    .argument('<provider>', 'Target provider: vercel | cloudflare')
    .option('--env <env>', 'Environment: prod | preview', 'prod')
    .option('--follow', 'Tail runtime logs (best-effort)')
    .option('--path <dir>', 'Path to app directory (for monorepos)')
    .option('--project <id>', 'Vercel project ID or name')
    .option('--org <id>', 'Vercel org/team ID or slug')
    .option('--limit <n>', 'Look back N recent deployments (default: 1)', '1')
    .option('--sha <commit>', 'Prefer deployment matching this commit SHA (prefix allowed)')
    .option('--json', 'Output JSON result')
    .option('--since <duration>', 'Since duration for provider logs (e.g., 1h, 15m)')
    .option('--open', 'Open the Inspect URL in the browser after resolving it')
    .action(async (provider: string, opts: { env?: 'prod' | 'preview'; follow?: boolean; path?: string; project?: string; org?: string; limit?: string; sha?: string; json?: boolean; open?: boolean; since?: string }): Promise<void> => {
      const rootCwd: string = process.cwd()
      const targetCwd: string = opts.path ? (isAbsolute(opts.path) ? opts.path : join(rootCwd, opts.path)) : rootCwd
      try {
        if (opts.json === true) logger.setJsonOnly(true)
        const ndjsonOn: boolean = process.env.OPD_NDJSON === '1'
        if (ndjsonOn) logger.setNdjson(true)
        if (opts.json === true || ndjsonOn) process.env.OPD_FORCE_CI = '1'
        if (provider !== 'vercel' && provider !== 'cloudflare') {
          logger.error(`Unknown provider: ${provider}`)
          process.exitCode = 1
          return
        }
        if (provider === 'cloudflare') {
          const isNd: boolean = process.env.OPD_NDJSON === '1'
          const stepTimeoutV = Number.isFinite(Number(process.env.OPD_TIMEOUT_MS)) ? Number(process.env.OPD_TIMEOUT_MS) : 120_000
          const wranglerPath = join(targetCwd, 'wrangler.toml')
          let projectName: string | undefined
          const hints: string[] = []
          let hadWranglerToml: boolean = false
          try {
            if (await fsx.exists(wranglerPath)) {
              hadWranglerToml = true
              const raw = await (await import('node:fs/promises')).readFile(wranglerPath, 'utf8')
              const m = raw.match(/\bname\s*=\s*"([^"]+)"/)
              if (m && m[1]) projectName = m[1]
            }
          } catch { /* noop */ }
          if (!projectName) {
            const base = targetCwd.replace(/\\/g,'/').split('/').filter(Boolean).pop() || 'site'
            projectName = base.toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/--+/g,'-').replace(/^-+|-+$/g,'')
            if (!hadWranglerToml) hints.push('Add wrangler.toml with name="<project>" or pass --path to point to your Pages app')
          }
          let depUrlCf: string | undefined
          let inspectUrlCf: string | undefined
          let accountId: string | undefined
          try {
            const ls = await runWithRetry({ cmd: `wrangler pages deployments list --project-name ${projectName} --json`, cwd: targetCwd }, { timeoutMs: stepTimeoutV })
            if (ls.ok) {
              try {
                const arr = JSON.parse(ls.stdout) as Array<{ url?: string; id?: string; is_current?: boolean }>
                const chosen = Array.isArray(arr) && arr.length > 0 ? (arr.find(d => (d as any).is_current === true) || arr[0]) : undefined
                if (chosen?.url && typeof chosen.url === 'string') depUrlCf = chosen.url
                try {
                  const who = await runWithRetry({ cmd: 'wrangler whoami', cwd: targetCwd }, { timeoutMs: 60_000 })
                  if (who.ok) {
                    const text = (who.stdout + '\n' + who.stderr).trim()
                    const m = text.match(/account\s*id\s*[:=]\s*([a-z0-9]+)/i)
                    if (m && m[1]) accountId = m[1]
                  }
                } catch { /* ignore */ }
                const depId = (chosen as any).id as string | undefined
                if (accountId && depId) inspectUrlCf = `https://dash.cloudflare.com/${accountId}/pages/view/${projectName}/${depId}`
                else if (accountId) inspectUrlCf = `https://dash.cloudflare.com/${accountId}/pages/view/${projectName}`
              } catch { /* ignore parse */ }
            }
          } catch { /* ignore */ }
          if (!accountId) hints.push('Run: wrangler login')
          if (opts.json === true || isNd) {
            logger.json({ ok: Boolean(depUrlCf || inspectUrlCf), action: 'logs', provider: 'cloudflare', env: opts.env ?? 'prod', url: depUrlCf, inspectUrl: inspectUrlCf, project: projectName, hints, final: true })
            return
          }
          if (inspectUrlCf) logger.success(`Inspect: ${inspectUrlCf}`)
          if (depUrlCf) logger.success(`URL: ${depUrlCf}`)
          if (!inspectUrlCf && !depUrlCf) {
            logger.info('Could not resolve Cloudflare deployment info.')
            for (const h of hints) logger.info(`Hint: ${h}`)
          }
          if (opts.open === true && inspectUrlCf) {
            const opener: string = process.platform === 'win32' ? `start "" "${inspectUrlCf}"` : process.platform === 'darwin' ? `open "${inspectUrlCf}"` : `xdg-open "${inspectUrlCf}"`
            void proc.run({ cmd: opener, cwd: targetCwd })
          }
          return
        }
        const isNdjson: boolean = process.env.OPD_NDJSON === '1'
        // Provider: vercel
        // Pick linked cwd like deploy
        const targetLink: string = join(targetCwd, '.vercel', 'project.json')
        const rootLink: string = join(rootCwd, '.vercel', 'project.json')
        const targetIsLinked: boolean = await fsx.exists(targetLink)
        const rootIsLinked: boolean = await fsx.exists(rootLink)
        const runCwd: string = targetIsLinked ? targetCwd : (rootIsLinked && !targetIsLinked ? rootCwd : targetCwd)
        // Get latest deployment URL for the chosen env
        const n = Math.max(1, parseInt(opts.limit ?? '1', 10) || 1)
        const flags: string[] = ['list', '--json', '-n', String(n)]
        if (opts.env === 'prod') flags.push('--prod')
        if (opts.project) { flags.push('--project', opts.project) }
        if (opts.org) { flags.push('--org', opts.org) }
        const listCmd: string = `vercel ${flags.join(' ')}`
        const stepTimeoutV = Number.isFinite(Number(process.env.OPD_TIMEOUT_MS)) ? Number(process.env.OPD_TIMEOUT_MS) : 120_000
        const ls = await runWithRetry({ cmd: listCmd, cwd: runCwd }, { timeoutMs: stepTimeoutV })
        if (!ls.ok) throw new Error(ls.stderr.trim() || ls.stdout.trim() || 'Failed to list deployments')
        let depUrl: string | undefined
        try {
          const arr = JSON.parse(ls.stdout) as Array<Record<string, unknown>>
          let chosen: Record<string, unknown> | undefined
          if (Array.isArray(arr) && arr.length > 0) {
            if (opts.sha) {
              const needle = opts.sha.toLowerCase()
              chosen = arr.find((it) => JSON.stringify(it).toLowerCase().includes(needle)) as Record<string, unknown> | undefined
            }
            if (!chosen) chosen = arr[0] as Record<string, unknown>
            const urlFrag: unknown = (chosen as { url?: unknown }).url
            if (typeof urlFrag === 'string') depUrl = urlFrag.startsWith('http') ? urlFrag : `https://${urlFrag}`
          }
        } catch {
          const m = ls.stdout.match(/https?:\/\/[^\s]+vercel\.app/)
          if (m) depUrl = m[0]
        }
        if (!depUrl) throw new Error('No recent deployment found')
        // Resolve Inspect URL
        const insp = await runWithRetry({ cmd: `vercel inspect ${depUrl}`, cwd: runCwd }, { timeoutMs: stepTimeoutV })
        if (!insp.ok) throw new Error(insp.stderr.trim() || insp.stdout.trim() || 'Failed to fetch inspect info')
        const inspectRe2 = /https?:\/\/[^\s]*vercel\.com[^\s]*/g
        const im = insp.stdout.match(inspectRe2)
        const inspectUrl: string | undefined = im?.[0]
        const isNdjsonV: boolean = process.env.OPD_NDJSON === '1'
        if (opts.follow === true) {
          // Tail runtime logs via adapter; emit high-level NDJSON events if enabled
          if (isNdjsonV) logger.json({ event: 'logs:start', provider: 'vercel', url: depUrl, inspectUrl })
          const spV = (!isNdjsonV && process.env.OPD_JSON !== '1') ? spinner('Vercel: logs') : null
          try {
            // Logs follow remains implemented via `vercel logs` below; keep existing spawn behavior when follow=false.
            // For follow=true here we continue to use `vercel logs` directly to avoid adapter usage.
            const envFlag = (opts.env === 'prod' ? '--prod' : '')
            const since = opts.since ? ` --since ${opts.since}` : ''
            const follow = ' -f'
            const cmd = `vercel logs ${depUrl}${follow}${since} ${envFlag}`.trim()
            const ctrl = proc.spawnStream({ cmd, cwd: runCwd })
            await ctrl.done
            if (spV) spV.succeed('Vercel: logs end')
            if (isNdjsonV) logger.json({ event: 'logs:end', ok: true })
            if (opts.json === true || isNdjsonV) {
              logger.json({ ok: true, action: 'logs', provider: 'vercel', env: opts.env ?? 'prod', url: depUrl, inspectUrl, follow: true, final: true })
            }
            process.exitCode = 0
          } catch (e) {
            if (spV) spV.fail('Vercel: logs error')
            const errMsg = String(e instanceof Error ? e.message : e)
            if (isNdjsonV) logger.json({ event: 'logs:end', ok: false, error: errMsg })
            if (opts.json === true || isNdjsonV) {
              logger.json({ ok: false, action: 'logs', provider: 'vercel', env: opts.env ?? 'prod', url: depUrl, inspectUrl, follow: true, message: errMsg, final: true })
            }
            process.exitCode = 1
          }
          return
        }
        // Non-follow: print or JSON/NDJSON emit
        if (opts.json === true || isNdjsonV) {
          logger.json({ ok: true, action: 'logs', provider: 'vercel', env: opts.env ?? 'prod', url: depUrl, inspectUrl, project: opts.project, org: opts.org, final: true })
        } else {
          if (inspectUrl) logger.success(`Inspect: ${inspectUrl}`)
          else logger.info('Inspect information printed above.')
        }
        if (opts.open === true && inspectUrl) {
          const opener: string = process.platform === 'win32' ? `start "" "${inspectUrl}"` : process.platform === 'darwin' ? `open "${inspectUrl}"` : `xdg-open "${inspectUrl}"`
          void proc.run({ cmd: opener, cwd: runCwd })
        }
      } catch (err) {
        const raw: string = err instanceof Error ? err.message : String(err)
        const info = mapProviderError(provider, raw)
        if (process.env.OPD_JSON === '1' || process.env.OPD_NDJSON === '1') {
          logger.json({ ok: false, action: 'logs', provider, code: info.code, message: info.message, remedy: info.remedy, error: raw, final: true })
        }
        logger.error(`${info.message} (${info.code})`)
        if (info.remedy) logger.info(`Try: ${info.remedy}`)
        process.exitCode = 1
      }
    })

  // Quick-win: open provider dashboard for project
  program
    .command('open')
    .description('Open the project dashboard on the provider')
    .argument('<provider>', 'Target provider: vercel | github | cloudflare')
    .option('--project <id>', 'Provider project/site ID')
    .option('--org <id>', 'Provider org/team ID (vercel)')
    .option('--path <dir>', 'Path to app directory (for monorepos)')
    .option('--json', 'Emit JSON summary with the chosen URL')
    .action(async (provider: string, opts: { project?: string; org?: string; path?: string; json?: boolean }): Promise<void> => {
      const rootCwd: string = process.cwd()
      const targetCwd: string = opts.path ? join(rootCwd, opts.path) : rootCwd
      try {
        if (provider === 'vercel') {
          // Choose cwd similar to deploy
          const targetLink: string = join(targetCwd, '.vercel', 'project.json')
          const rootLink: string = join(rootCwd, '.vercel', 'project.json')
          const targetIsLinked: boolean = await fsx.exists(targetLink)
          const rootIsLinked: boolean = await fsx.exists(rootLink)
          const runCwd: string = targetIsLinked ? targetCwd : (rootIsLinked && !targetIsLinked ? rootCwd : targetCwd)
          if (opts.project || opts.org) {
            const linkFlags: string[] = ['--yes']
            if (opts.project) linkFlags.push(`--project ${opts.project}`)
            if (opts.org) linkFlags.push(`--org ${opts.org}`)
            await proc.run({ cmd: `vercel link ${linkFlags.join(' ')}`, cwd: runCwd })
          }
          let url: string | undefined
          try {
            const plugin = await loadProvider('vercel')
            url = await (plugin.open({ projectId: opts.project, orgId: opts.org }) as unknown as Promise<string | undefined>)
          } catch { url = undefined }
          // Fallback: generic dashboard
          const targetUrl: string = url || 'https://vercel.com/dashboard'
          if (opts.json) { logger.jsonPrint({ ok: true, action: 'open' as const, provider: 'vercel' as const, url: targetUrl, final: true }); return }
          void (await import('../utils/platform-open')).platformOpen(targetUrl)
          logger.success(`Opened Vercel dashboard: ${targetUrl}`)
          return
        }
        if (provider === 'cloudflare') {
          // Infer project name from wrangler.toml or folder name
          const wranglerPath = join(targetCwd, 'wrangler.toml')
          let projectName: string | undefined
          try {
            if (await fsx.exists(wranglerPath)) {
              const raw = await (await import('node:fs/promises')).readFile(wranglerPath, 'utf8')
              const m = raw.match(/\bname\s*=\s*"([^"]+)"/)
              if (m && m[1]) projectName = m[1]
            }
          } catch { /* ignore */ }
          if (!projectName) {
            const base = targetCwd.replace(/\\/g,'/').split('/').filter(Boolean).pop() || 'site'
            projectName = base.toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/--+/g,'-').replace(/^-+|-+$/g,'')
          }
          // Get account id
          let accountId: string | undefined
          try {
            const who = await runWithRetry({ cmd: 'wrangler whoami', cwd: targetCwd }, { timeoutMs: 60_000 })
            if (who.ok) {
              const text = (who.stdout + '\n' + who.stderr).trim()
              const m = text.match(/account\s*id\s*[:=]\s*([a-z0-9]+)/i)
              if (m && m[1]) accountId = m[1]
            }
          } catch { /* ignore */ }
          if (!accountId) { logger.error('Could not determine Cloudflare account id (run: wrangler login)'); process.exitCode = 1; return }
          const dashUrl = `https://dash.cloudflare.com/${accountId}/pages/view/${projectName}`
          if (opts.json) { logger.jsonPrint({ ok: true, action: 'open' as const, provider: 'cloudflare' as const, url: dashUrl, final: true }); return }
          void (await import('../utils/platform-open')).platformOpen(dashUrl)
          logger.success(`Opened Cloudflare Pages dashboard: ${dashUrl}`)
          return
        }
        if (provider === 'github') {
          // Infer GitHub Pages URL from env or git origin
          const ghEnv: string | undefined = process.env.GITHUB_REPOSITORY
          let owner: string | undefined
          let repo: string | undefined
          if (ghEnv && ghEnv.includes('/')) { const [o, r] = ghEnv.split('/'); owner = o; repo = r }
          if (!owner || !repo) {
            try {
              const origin = await proc.run({ cmd: 'git remote get-url origin', cwd: targetCwd })
              if (origin.ok) {
                const t = origin.stdout.trim()
                const httpsRe = /^https?:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/i
                const sshRe = /^git@github\.com:(.+?)\/(.+?)(?:\.git)?$/i
                const m1 = t.match(httpsRe); const m2 = t.match(sshRe)
                owner = (m1?.[1] || m2?.[1] || '').trim()
                repo = (m1?.[2] || m2?.[2] || '').trim()
              }
            } catch { /* ignore */ }
          }
          if (!owner || !repo) { logger.error('Could not infer GitHub repository (set GITHUB_REPOSITORY or ensure origin remote).'); process.exitCode = 1; return }
          const url: string = `https://github.com/${owner}/${repo}/actions`
          if (opts.json) { logger.jsonPrint({ ok: true, action: 'open' as const, provider: 'github' as const, url, final: true }); return }
          void (await import('../utils/platform-open')).platformOpen(url)
          logger.success(`Opened GitHub: ${url}`)
          return
        }
        // Unknown provider
        logger.error(`Unknown provider: ${provider}`)
        process.exitCode = 1
      } catch (err) {
        const raw: string = err instanceof Error ? err.message : String(err)
        if (process.env.OPD_JSON === '1' || process.env.OPD_NDJSON === '1') {
          logger.json({ ok: false, action: 'open', provider, message: raw, final: true })
        }
        logger.error(raw)
        process.exitCode = 1
      }
    })
  
}

// Vercel alias management: set alias for a deployment
export function registerAliasCommand(program: Command): void {
  program
    .command('alias')
    .description('Manage provider aliases (currently: vercel)')
    .argument('<provider>', 'Target provider: vercel')
    .option('--set <domain>', 'Assign alias domain to the deployment (vercel)')
    .option('--deployment <idOrUrl>', 'Deployment id or URL to alias (vercel)')
    .option('--project <id>', 'Vercel project ID or name')
    .option('--org <id>', 'Vercel org/team ID or slug')
    .option('--path <dir>', 'Path to app directory (for monorepos)')
    .option('--json', 'Output JSON result')
    .action(async (provider: string, opts: { set?: string; deployment?: string; project?: string; org?: string; path?: string; json?: boolean }): Promise<void> => {
      const rootCwd: string = process.cwd()
      const targetCwd: string = opts.path ? join(rootCwd, opts.path) : rootCwd
      try {
        if (opts.json === true) logger.setJsonOnly(true)
        const ndjsonOn: boolean = process.env.OPD_NDJSON === '1'
        if (ndjsonOn) logger.setNdjson(true)
        if (opts.json === true || ndjsonOn) process.env.OPD_FORCE_CI = '1'
        if (provider !== 'vercel') { logger.error(`Unknown provider: ${provider}`); process.exitCode = 1; return }
        const aliasDomain: string | undefined = opts.set
        const idOrUrl: string | undefined = opts.deployment
        if (!aliasDomain || !idOrUrl) { logger.error('Missing --set <domain> or --deployment <idOrUrl>'); process.exitCode = 1; return }
        // Choose cwd similar to deploy for vercel
        const targetLink: string = join(targetCwd, '.vercel', 'project.json')
        const rootLink: string = join(rootCwd, '.vercel', 'project.json')
        const targetIsLinked: boolean = await fsx.exists(targetLink)
        const rootIsLinked: boolean = await fsx.exists(rootLink)
        const runCwd: string = targetIsLinked ? targetCwd : (rootIsLinked && !targetIsLinked ? rootCwd : targetCwd)
        if (runCwd === targetCwd && (opts.project || opts.org)) {
          const linkFlags: string[] = ['--yes']
          if (opts.project) linkFlags.push(`--project ${opts.project}`)
          if (opts.org) linkFlags.push(`--org ${opts.org}`)
          await proc.run({ cmd: `vercel link ${linkFlags.join(' ')}`, cwd: runCwd })
        }
        const cmd: string = `vercel alias set ${idOrUrl} ${aliasDomain}`
        const res = await runWithRetry({ cmd, cwd: runCwd }, { timeoutMs: 120_000 })
        if (!res.ok) throw new Error(res.stderr.trim() || res.stdout.trim() || 'Alias command failed')
        if (opts.json === true || ndjsonOn) { logger.json({ ok: true, action: 'alias', provider: 'vercel', domain: aliasDomain, deployment: idOrUrl, final: true }); return }
        logger.success(`Alias set: ${aliasDomain} → ${idOrUrl}`)
      } catch (err) {
        const raw: string = err instanceof Error ? err.message : String(err)
        if (process.env.OPD_JSON === '1' || process.env.OPD_NDJSON === '1') { logger.json({ ok: false, action: 'alias', provider, message: raw, final: true }) }
        logger.error(raw)
        process.exitCode = 1
      }
    })

}

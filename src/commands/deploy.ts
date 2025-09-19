import { Command } from 'commander'
import { logger } from '../utils/logger'
import { detectNextApp } from '../core/detectors/next'
import { VercelAdapter } from '../providers/vercel/adapter'
import { NetlifyAdapter } from '../providers/netlify/adapter'
import type { DeployInputs } from '../types/deploy-inputs'
import type { DetectionResult } from '../types/detection-result'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { fsx } from '../utils/fs'
import { proc } from '../utils/process'
import { startHeartbeat, type Stopper } from '../utils/progress'
import { spinner } from '../utils/ui'
import { mapProviderError } from '../utils/errors'
import { printDeploySummary } from '../utils/summarize'
import { envSync } from './env'
import { computeRedactors } from '../utils/redaction'

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
    .argument('<provider>', 'Target provider: vercel | netlify')
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
      const targetCwd: string = opts.path ? join(rootCwd, opts.path) : rootCwd
      try {
        if (opts.json === true) logger.setJsonOnly(true)
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
              await envSync({ provider: provider === 'netlify' ? 'netlify' : 'vercel', cwd: targetCwd, file: chosenFile, env: envTarget, yes: true, ci: Boolean(opts.ci), json: false, projectId: opts.project, orgId: opts.org, ignore: [], only: [] })
              logger.success('Environment sync complete')
            } catch (e) {
              logger.warn(`Env sync skipped: ${(e as Error).message}`)
            }
          } else {
            logger.note('No local .env file found to sync')
          }
        }
        if (provider === 'vercel') {
          const adapter = new VercelAdapter()
          await adapter.validateAuth()
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
            const cmd: string = opts.env === 'prod' ? 'vercel deploy --prod --yes' : 'vercel deploy --yes'
            const t0: number = Date.now()
            if (process.env.OPD_NDJSON === '1') logger.json({ event: 'phase', phase: 'deploy', provider: 'vercel', command: cmd, cwd: runCwd })
            sp.update('Vercel: deploying')
            const stop: Stopper = startHeartbeat({ label: 'vercel deploy', hint: 'Tip: opendeploy open vercel --path apps/web', intervalMs: process.env.OPD_NDJSON === '1' ? 5000 : 10000 })
            let capturedUrl: string | undefined
            let capturedInspect: string | undefined
            const urlRe = /https?:\/\/[^\s]+vercel\.app/g
            const inspectRe = /https?:\/\/[^\s]*vercel\.com[^\s]*/g
            const controller = proc.spawnStream({
              cmd,
              cwd: runCwd,
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
          const inputs: DeployInputs = {
            provider: 'vercel',
            detection,
            env: (opts.env === 'prod' ? 'prod' : 'preview'),
            dryRun: Boolean(opts.dryRun),
            projectId: opts.project,
            orgId: opts.org,
            envVars: {}
          }
          const result = await adapter.deploy(inputs)
          if (opts.json === true) {
            logger.json(result)
            return
          }
          logger.success(`Deployed: ${result.url}`)
          if (result.logsUrl !== undefined) logger.info(`Inspect: ${result.logsUrl}`)
          return
        }
        if (provider === 'netlify') {
          if (opts.dryRun === true) {
            logger.info('[dry-run] netlify deploy --build (target inferred by --env)')
            if (opts.json === true || process.env.OPD_NDJSON === '1') {
              logger.json({ provider: 'netlify', target: (opts.env === 'prod' ? 'prod' : 'preview'), mode: 'dry-run', final: true })
            }
            return
          }
          const adapter = new NetlifyAdapter()
          await adapter.validateAuth()
          // Ensure netlify.toml exists (idempotent)
          if (process.env.OPD_NDJSON === '1') logger.json({ event: 'phase', phase: 'generate-config', provider: 'netlify', path: targetCwd })
          await adapter.generateConfig({ detection, overwrite: false })
          const siteFlag: string = opts.project ? ` --site ${opts.project}` : ''
          const prodFlag: string = (opts.env === 'prod' ? ' --prod' : '')
          const cmdNl: string = `netlify deploy --build${prodFlag}${siteFlag}`
          if (process.env.OPD_NDJSON === '1') logger.json({ event: 'phase', phase: 'deploy', provider: 'netlify', command: cmdNl, cwd: targetCwd, site: opts.project })
          const sp2 = spinner('Netlify: deploying')
          const stop2: Stopper = startHeartbeat({ label: 'netlify deploy', hint: 'Tip: opendeploy open netlify --project <siteId>', intervalMs: process.env.OPD_NDJSON === '1' ? 5000 : 10000 })
          let nlUrl: string | undefined
          let nlLogsUrl: string | undefined
          const urlReNl = /https?:\/\/[^\s]+\.netlify\.app\b/g
          const logsReNl = /https?:\/\/[^\s]*netlify\.com[^\s]*/g
          const t0nl: number = Date.now()
          const controllerNl = proc.spawnStream({
            cmd: cmdNl,
            cwd: targetCwd,
            onStdout: (chunk: string): void => {
              if (process.env.OPD_NDJSON === '1') logger.json({ event: 'nl:stdout', line: chunk })
              const m = chunk.match(urlReNl)
              if (!nlUrl && m && m.length > 0) nlUrl = m[0]
              if (!nlLogsUrl) {
                const lm = chunk.match(logsReNl)
                if (lm && lm.length > 0) nlLogsUrl = lm[0]
              }
              if (process.env.OPD_NDJSON !== '1' && process.env.OPD_JSON !== '1') {
                const t = chunk.replace(/\s+$/, '')
                if (t.length > 0) logger.info(t)
              }
            },
            onStderr: (chunk: string): void => {
              if (process.env.OPD_NDJSON === '1') logger.json({ event: 'nl:stderr', line: chunk })
              if (!nlLogsUrl) {
                const lm = chunk.match(logsReNl)
                if (lm && lm.length > 0) nlLogsUrl = lm[0]
              }
              if (process.env.OPD_NDJSON !== '1' && process.env.OPD_JSON !== '1') {
                const s = chunk.toLowerCase()
                if (s.includes('building') || s.includes('build')) sp2.update('Netlify: building')
                else if (s.includes('deploying') || s.includes('upload')) sp2.update('Netlify: deploying')
                else if (s.includes('success') || s.includes('live')) sp2.update('Netlify: completing')
              }
            }
          })
          const resNl = await controllerNl.done
          stop2()
          const durationMsNl: number = Date.now() - t0nl
          if (!resNl.ok) throw new Error('Netlify deploy failed')
          if (!nlUrl) throw new Error('Netlify deploy succeeded but URL not found in output')
          if (opts.json === true || process.env.OPD_NDJSON === '1') { logger.json({ url: nlUrl, logsUrl: nlLogsUrl, projectId: opts.project, provider: 'netlify', target: (opts.env === 'prod' ? 'prod' : 'preview'), durationMs: durationMsNl, final: true }); return }
          sp2.succeed(`Netlify: deployed ${nlUrl}`)
          logger.success(`Deployed: ${nlUrl}`)
          printDeploySummary({ provider: 'netlify', target: (opts.env === 'prod' ? 'prod' : 'preview'), url: nlUrl, projectId: opts.project, durationMs: durationMsNl, logsUrl: nlLogsUrl })
          return
        }
        logger.error(`Unknown provider: ${provider}`)
        process.exitCode = 1
      } catch (err) {
        const raw: string = err instanceof Error ? err.message : String(err)
        const info = mapProviderError(provider, raw)
        // Emit machine-readable error if JSON/NDJSON requested
        if (process.env.OPD_JSON === '1' || process.env.OPD_NDJSON === '1') {
          logger.json({ ok: false, command: 'deploy', provider, target: opts.env ?? 'preview', path: opts.path, code: info.code, message: info.message, remedy: info.remedy, error: raw, final: true })
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
    .argument('<provider>', 'Target provider: vercel | netlify')
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
      const targetCwd: string = opts.path ? join(rootCwd, opts.path) : rootCwd
      try {
        if (opts.json === true) logger.setJsonOnly(true)
        if (provider !== 'vercel' && provider !== 'netlify') {
          logger.error(`Logs not implemented for provider: ${provider}`)
          process.exitCode = 1
          return
        }
        const isNdjson: boolean = process.env.OPD_NDJSON === '1'
        if (provider === 'netlify') {
          // Resolve site ID
          const runCwdNl: string = targetCwd
          let siteId: string | undefined = opts.project
          if (!siteId) {
            try {
              const state = await fsx.readJson<{ siteId?: string }>(join(runCwdNl, '.netlify', 'state.json'))
              if (state && typeof state.siteId === 'string') siteId = state.siteId
            } catch { /* ignore */ }
          }
          if (!siteId) throw new Error('Netlify site not resolved. Provide --project <siteId> or run inside a linked directory.')
          // List recent deploys
          const n: number = Math.max(1, parseInt(opts.limit ?? '1', 10) || 1)
          const ls = await proc.run({ cmd: `netlify api listSiteDeploys --data '{"site_id":"${siteId}","per_page":${n}}'`, cwd: runCwdNl })
          if (!ls.ok) throw new Error(ls.stderr.trim() || ls.stdout.trim() || 'Failed to list Netlify deploys')
          type NlDeploy = { id?: string; state?: string; created_at?: string; commit_ref?: string | null }
          let chosen: NlDeploy | undefined
          try {
            const arr = JSON.parse(ls.stdout) as NlDeploy[]
            if (Array.isArray(arr) && arr.length > 0) {
              if (opts.sha) {
                const needle = opts.sha.toLowerCase()
                chosen = arr.find(d => (d.commit_ref ?? '').toLowerCase().includes(needle))
              }
              if (!chosen) chosen = arr[0]
            }
          } catch { /* ignore */ }
          if (!chosen || !chosen.id) throw new Error('No recent Netlify deployment found')
          // Resolve site name for dashboard URL
          let siteName: string | undefined
          try {
            const siteRes = await proc.run({ cmd: `netlify api getSite --data '{"site_id":"${siteId}"}'`, cwd: runCwdNl })
            if (siteRes.ok) {
              const js = JSON.parse(siteRes.stdout) as { name?: string }
              if (typeof js.name === 'string') siteName = js.name
            }
          } catch { /* ignore */ }
          const dashboardUrl: string | undefined = siteName ? `https://app.netlify.com/sites/${siteName}/deploys/${chosen.id}` : undefined
          if (opts.follow === true) {
            if (isNdjson) logger.json({ event: 'logs:start', provider: 'netlify', deployId: chosen.id, siteId, dashboardUrl })
            // Poll deploy status until ready/error
            const start = Date.now()
            const spNl = (!isNdjson && process.env.OPD_JSON !== '1') ? spinner('Netlify: waiting for deploy') : null
            let attempt = 0
            // eslint-disable-next-line no-constant-condition
            while (true) {
              const st = await proc.run({ cmd: `netlify api getDeploy --data '{"deploy_id":"${chosen.id}"}'`, cwd: runCwdNl })
              if (!st.ok) break
              try {
                const js = JSON.parse(st.stdout) as { state?: string }
                const state: string = js.state ?? 'unknown'
                if (isNdjson) logger.json({ event: 'nl:deploy:status', state })
                else {
                  const s = state.toLowerCase()
                  if (spNl) {
                    if (s.includes('new') || s.includes('enqueued') || s.includes('processing')) spNl.update('Netlify: queued')
                    else if (s.includes('building') || s.includes('uploading') || s.includes('prepared')) spNl.update('Netlify: building')
                    else if (s.includes('ready')) spNl.update('Netlify: ready')
                    else if (s.includes('error') || s.includes('failed') || s.includes('canceled')) spNl.update('Netlify: error')
                    else spNl.update(`Netlify: ${state}`)
                  } else {
                    logger.info(`Netlify deploy state: ${state}`)
                  }
                }
                if (state === 'ready' || state === 'error' || state === 'failed' || state === 'canceled') {
                  if (spNl) {
                    if (state === 'ready') spNl.succeed('Netlify: ready')
                    else spNl.fail(`Netlify: ${state}`)
                  }
                  if (isNdjson) logger.json({ event: 'logs:end', ok: state === 'ready', durationMs: Date.now() - start, final: true })
                  process.exitCode = state === 'ready' ? 0 : 1
                  return
                }
              } catch { /* ignore */ }
              // Exponential backoff with jitter (base 3s, grow 1.5x, cap 15s, ±20% jitter)
              attempt += 1
              const base = Math.min(15000, Math.round(3000 * Math.pow(1.5, attempt)))
              const jitter = Math.round(base * (Math.random() * 0.4 - 0.2))
              const sleep = Math.max(1000, base + jitter)
              if (isNdjson) logger.json({ event: 'nl:backoff', ms: sleep })
              await new Promise(r => setTimeout(r, sleep))
            }
            if (spNl) spNl.fail('Netlify: polling failed')
            if (isNdjson) logger.json({ event: 'logs:end', ok: false, final: true })
            process.exitCode = 1
            return
          }
          // Non-follow: print or JSON/NDJSON emit and optionally open dashboard
          if (opts.json === true || isNdjson) {
            logger.json({ ok: true, command: 'logs', provider: 'netlify', env: opts.env ?? 'prod', deployId: chosen.id, siteId, dashboardUrl, final: true })
          } else {
            if (dashboardUrl) logger.success(`Deploy Dashboard: ${dashboardUrl}`)
            else logger.info('Deploy information printed above.')
          }
          if (opts.open === true && dashboardUrl) {
            const opener: string = process.platform === 'win32' ? `start "" "${dashboardUrl}"` : process.platform === 'darwin' ? `open "${dashboardUrl}"` : `xdg-open "${dashboardUrl}"`
            void proc.run({ cmd: opener, cwd: runCwdNl })
          }
          return
        }
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
        const ls = await proc.run({ cmd: listCmd, cwd: runCwd })
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
        const insp = await proc.run({ cmd: `vercel inspect ${depUrl}`, cwd: runCwd })
        if (!insp.ok) throw new Error(insp.stderr.trim() || insp.stdout.trim() || 'Failed to fetch inspect info')
        const inspectRe2 = /https?:\/\/[^\s]*vercel\.com[^\s]*/g
        const im = insp.stdout.match(inspectRe2)
        const inspectUrl: string | undefined = im?.[0]
        const isNdjsonV: boolean = process.env.OPD_NDJSON === '1'
        if (opts.follow === true) {
          // Tail runtime logs via adapter; emit high-level NDJSON events if enabled
          if (isNdjsonV) logger.json({ event: 'logs:start', provider: 'vercel', url: depUrl, inspectUrl })
          const spV = (!isNdjsonV && process.env.OPD_JSON !== '1') ? spinner('Vercel: logs') : null
          const adapter = new VercelAdapter()
          try {
            await adapter.logs({ env: (opts.env === 'prod' ? 'prod' : 'preview'), projectId: opts.project, orgId: opts.org, cwd: runCwd, follow: true, since: opts.since })
            if (spV) spV.succeed('Vercel: logs end')
            if (isNdjsonV) logger.json({ event: 'logs:end', ok: true, final: true })
            process.exitCode = 0
          } catch (e) {
            if (spV) spV.fail('Vercel: logs error')
            if (isNdjsonV) logger.json({ event: 'logs:end', ok: false, error: String(e instanceof Error ? e.message : e), final: true })
            process.exitCode = 1
          }
          return
        }
        // Non-follow: print or JSON/NDJSON emit
        if (opts.json === true || isNdjsonV) {
          logger.json({ ok: true, command: 'logs', provider: 'vercel', env: opts.env ?? 'prod', url: depUrl, inspectUrl, project: opts.project, org: opts.org, final: true })
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
          logger.json({ ok: false, command: 'logs', provider, code: info.code, message: info.message, remedy: info.remedy, error: raw, final: true })
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
    .argument('<provider>', 'Target provider: vercel | netlify')
    .option('--project <id>', 'Provider project/site ID')
    .option('--org <id>', 'Provider org/team ID (vercel)')
    .option('--path <dir>', 'Path to app directory (for monorepos)')
    .action(async (provider: string, opts: { project?: string; org?: string; path?: string }): Promise<void> => {
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
          const adapter = new VercelAdapter()
          await adapter.open(opts.project)
          logger.success('Opened Vercel dashboard')
          return
        }
        if (provider === 'netlify') {
          const adapter = new NetlifyAdapter()
          await adapter.open(opts.project)
          logger.success('Opened Netlify dashboard')
          return
        }
        logger.error(`Unknown provider: ${provider}`)
        process.exitCode = 1
      } catch (err) {
        const raw: string = err instanceof Error ? err.message : String(err)
        const info = mapProviderError(provider, raw)
        if (process.env.OPD_JSON === '1' || process.env.OPD_NDJSON === '1') {
          logger.json({ ok: false, command: 'logs', provider, code: info.code, message: info.message, remedy: info.remedy, error: raw, final: true })
        }
        logger.error(`${info.message} (${info.code})`)
        if (info.remedy) logger.info(`Try: ${info.remedy}`)
        process.exitCode = 1
      }
    })
    
}

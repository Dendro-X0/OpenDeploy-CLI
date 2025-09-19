import { Command } from 'commander'
import { join } from 'node:path'
import { logger } from '../utils/logger'
import { detectNextApp } from '../core/detectors/next'
import { fsx } from '../utils/fs'
import type { DeployPlan, DeployStep } from '../types/deploy-plan'

interface ExplainOptions {
  readonly env?: 'prod' | 'preview'
  readonly path?: string
  readonly json?: boolean
  readonly ci?: boolean
  readonly project?: string
  readonly org?: string
  readonly syncEnv?: boolean
}

export function registerExplainCommand(program: Command): void {
  program
    .command('explain')
    .description('Show what will happen for a deploy, without executing anything')
    .argument('<provider>', 'Target provider: vercel | netlify')
    .option('--env <env>', 'Environment: prod | preview', 'preview')
    .option('--path <dir>', 'Path to app directory (for monorepos)')
    .option('--json', 'Output JSON plan')
    .option('--ci', 'CI mode (assume strict guards)')
    .option('--project <id>', 'Provider project/site ID')
    .option('--org <id>', 'Provider org/team ID (Vercel)')
    .option('--sync-env', 'Plan an environment sync prior to deploy')
    .action(async (provider: string, opts: ExplainOptions): Promise<void> => {
      const rootCwd: string = process.cwd()
      const targetCwd: string = opts.path ? join(rootCwd, opts.path) : rootCwd
      try {
        if (opts.json === true) logger.setJsonOnly(true)
        if (provider !== 'vercel' && provider !== 'netlify') {
          logger.error(`Unknown provider: ${provider}`)
          process.exitCode = 1
          return
        }
        const detection = await detectNextApp({ cwd: targetCwd })
        // Choose run cwd (same heuristic as deploy for vercel)
        let runCwd = targetCwd
        if (provider === 'vercel') {
          const targetLink = join(targetCwd, '.vercel', 'project.json')
          const rootLink = join(rootCwd, '.vercel', 'project.json')
          const targetIsLinked = await fsx.exists(targetLink)
          const rootIsLinked = await fsx.exists(rootLink)
          runCwd = targetIsLinked ? targetCwd : (rootIsLinked ? rootCwd : targetCwd)
        }
        // Suggest env file
        const target: 'prod' | 'preview' = opts.env === 'prod' ? 'prod' : 'preview'
        const candidates = target === 'prod' ? ['.env.production.local', '.env'] : ['.env', '.env.local']
        let envFile: string | undefined
        for (const f of candidates) { if (await fsx.exists(join(runCwd, f))) { envFile = f; break } }
        const planSteps: DeployStep[] = []
        planSteps.push({ id: 'detect', title: 'Detect Next.js app and project metadata', kind: 'detect' })
        planSteps.push({ id: 'link', title: provider === 'vercel' ? 'Ensure Vercel link (project/org)' : 'Ensure Netlify link (site)', kind: 'link' })
        const wantSync = opts.syncEnv === true || Boolean(envFile)
        if (wantSync) {
          planSteps.push({ id: 'env', title: `Sync environment from ${envFile ?? 'local .env'} (optimized writes)`, kind: 'env' })
        }
        planSteps.push({ id: 'deploy', title: provider === 'vercel' ? `vercel deploy (${target === 'prod' ? 'production' : 'preview'})` : `netlify deploy --build${target === 'prod' ? ' --prod' : ''}` , kind: 'deploy' })
        const plan: DeployPlan = {
          provider,
          target,
          cwd: runCwd,
          steps: planSteps,
          envSummary: {
            plannedSync: wantSync,
            file: envFile,
            strictGuards: opts.ci ? ['fail-on-add', 'fail-on-remove'] : [],
          },
        }
        if (opts.json === true) { logger.json({ ok: true, plan, final: true }); return }
        logger.section('Plan')
        logger.note(`${provider} | ${target} | cwd=${runCwd}`)
        for (const s of plan.steps) logger.info(`• ${s.title}`)
        if (plan.envSummary.plannedSync) logger.info(`Env: from ${plan.envSummary.file ?? 'local .env'} (optimized writes)`)
        if (plan.envSummary.strictGuards.length > 0) logger.info(`Strict: ${plan.envSummary.strictGuards.join(', ')}`)
      } catch (err) {
        const msg: string = err instanceof Error ? err.message : String(err)
        if (opts.json === true) logger.json({ ok: false, message: msg, final: true })
        logger.error(msg)
        process.exitCode = 1
      }
    })
}

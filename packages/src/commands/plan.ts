import { Command } from 'commander'
import { join, isAbsolute } from 'node:path'
import { loadProvider } from '../core/provider-system/provider'
import { logger, isJsonMode } from '../utils/logger'

interface PlanOptions {
  readonly env?: 'prod' | 'preview'
  readonly project?: string
  readonly org?: string
  readonly path?: string
  readonly json?: boolean
}

export function registerPlanCommand(program: Command): void {
  program
    .command('plan')
    .description('Compute a provider-aware build and deploy plan (does not execute)')
    .argument('<provider>', 'Target provider: vercel | netlify | cloudflare | github')
    .option('--env <env>', 'Environment: prod | preview', 'preview')
    .option('--project <id>', 'Provider project/site identifier (name or ID)')
    .option('--org <id>', 'Provider org/team ID or slug')
    .option('--path <dir>', 'Path to app directory (for monorepos)')
    .option('--json', 'Output JSON (recommended for CI)')
    .action(async (provider: string, opts: PlanOptions): Promise<void> => {
      const rootCwd: string = process.cwd()
      const targetCwd: string = opts.path ? (isAbsolute(opts.path) ? opts.path : join(rootCwd, opts.path)) : rootCwd
      try {
        const jsonMode: boolean = isJsonMode(opts.json)
        if (jsonMode) logger.setJsonOnly(true)
        const p = await loadProvider(provider)
        const caps = p.getCapabilities()
        const envTarget: 'preview' | 'production' = opts.env === 'prod' ? 'production' : 'preview'
        let publishDir: string | undefined
        let framework: string | undefined
        try {
          const d = await p.detect(targetCwd)
          publishDir = d.publishDir
          framework = d.framework
        } catch { /* ignore */ }
        // Heuristic command suggestions per provider
        const cmdPlan: string[] = []
        if (provider === 'netlify') {
          const ctx = envTarget === 'production' ? 'production' : 'deploy-preview'
          cmdPlan.push(`netlify build --context ${ctx}`)
          cmdPlan.push(`netlify deploy --no-build${envTarget === 'production' ? ' --prod' : ''}${publishDir ? ` --dir ${publishDir}` : ''}${opts.project ? ` --site ${opts.project}` : ''}`.trim())
        } else if (provider === 'vercel') {
          cmdPlan.push(envTarget === 'production' ? 'vercel deploy --prod --yes' : 'vercel deploy --yes')
          if (opts.project) cmdPlan.unshift(`vercel link --yes${opts.project ? ` --project ${opts.project}` : ''}${opts.org ? ` --org ${opts.org}` : ''}`.trim())
        } else if (provider === 'cloudflare') {
          // Framework-aware: Astro → dist, SvelteKit → build, Next → out (requires static export or next-on-pages)
          const fw = (framework || '').toLowerCase()
          let dir = publishDir
          if (!dir) {
            if (fw === 'astro') dir = 'dist'
            else if (fw === 'sveltekit') dir = 'build'
            else if (fw === 'next') dir = 'out'
            else dir = 'dist'
          }
          if (fw === 'next') cmdPlan.push('# Next.js on Cloudflare Pages requires static export or next-on-pages for SSR.')
          cmdPlan.push(`wrangler pages deploy ${dir}${opts.project ? ` --project-name ${opts.project}` : ''}`.trim())
        } else if (provider === 'github') {
          // Framework-aware: Astro → dist, SvelteKit → build, Next → out (static export)
          const fw = (framework || '').toLowerCase()
          if (fw === 'astro') {
            cmdPlan.push('gh-pages -d dist')
          } else if (fw === 'sveltekit') {
            cmdPlan.push('gh-pages -d build')
          } else if (fw === 'next') {
            cmdPlan.push('# Next.js on GitHub Pages requires static export (next.config.js: output: "export").')
            cmdPlan.push('next export && gh-pages -d out')
          } else {
            const dir = publishDir ?? 'dist'
            cmdPlan.push(`gh-pages -d ${dir}`)
          }
        } else {
          cmdPlan.push(`# unknown provider: ${provider}`)
        }
        const plan = {
          ok: true,
          action: 'plan' as const,
          provider,
          capabilities: caps,
          target: envTarget,
          cwd: targetCwd,
          framework,
          publishDir,
          cmdPlan,
          final: true
        }
        logger.jsonPrint(plan)
      } catch (err) {
        const msg: string = err instanceof Error ? err.message : String(err)
        if (isJsonMode(opts.json)) logger.json({ ok: false, action: 'plan', provider, message: msg, final: true })
        logger.error(msg)
        process.exitCode = 1
      }
    })
}

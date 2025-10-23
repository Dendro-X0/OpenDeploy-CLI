import { Command } from 'commander'
import { logger } from '../utils/logger'
import { platformOpen } from '../utils/platform-open'

interface OpenOptions {
  readonly url?: string
  readonly json?: boolean
}

/** Pick a sensible default dashboard URL per provider. */
function defaultDashboard(provider: 'vercel' | 'cloudflare' | 'github'): string {
  if (provider === 'vercel') return 'https://vercel.com/dashboard'
  if (provider === 'cloudflare') return 'https://dash.cloudflare.com'
  return process.env.GITHUB_REPOSITORY ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions` : 'https://github.com'
}

/** Choose the best URL when multiple are available. */
function chooseBestUrl(urls: readonly string[]): string | undefined {
  const score = (u: string): number => {
    const s = u.toLowerCase()
    if (s.includes('vercel.com') && s.includes('/deployments')) return 100
    if (s.includes('vercel.com') && s.includes('/inspections')) return 95
    if (s.includes('vercel.com')) return 90
    if (s.includes('cloudflare') && (s.includes('pages') || s.includes('workers'))) return 80
    if (s.includes('pages.dev')) return 70
    if (s.includes('github.com') && s.includes('/actions')) return 60
    return 10
  }
  if (urls.length === 0) return undefined
  return [...urls].sort((a, b) => score(b) - score(a))[0]
}

/**
 * Register `open` command that opens provider dashboards or specific URLs.
 */
export function registerOpenCommand(program: Command): void {
  program
    .command('open')
    .description('Open provider dashboard or a given URL in the default browser')
    .argument('[provider]', 'Target provider: vercel | cloudflare | github')
    .option('--url <url>', 'Specific URL to open (overrides provider default)')
    .option('--json', 'Emit JSON summary')
    .action(async (providerArg: string | undefined, opts: OpenOptions): Promise<void> => {
      const normalized: 'vercel' | 'cloudflare' | 'github' | undefined = providerArg === 'vercel' ? 'vercel' : (providerArg === 'cloudflare' ? 'cloudflare' : (providerArg === 'github' ? 'github' : undefined))
      // If no provider and no URL: show a brief help
      if (!normalized && !opts.url) {
        const msg = 'Usage: opd open <vercel|cloudflare|github> [--url <link>]' 
        if (opts.json) logger.jsonPrint({ ok: false, action: 'open' as const, message: msg, final: true })
        else logger.info(msg)
        return
      }
      const candidates: string[] = []
      if (typeof opts.url === 'string' && opts.url.length > 0) candidates.push(opts.url)
      if (normalized) candidates.push(defaultDashboard(normalized))
      const target: string | undefined = chooseBestUrl(candidates)
      if (!target) {
        const msg = 'No URL to open'
        if (opts.json) logger.jsonPrint({ ok: false, action: 'open' as const, provider: normalized, message: msg, final: true })
        else logger.error(msg)
        return
      }
      const res = await platformOpen(target)
      const ok: boolean = res.ok
      if (opts.json) {
        logger.jsonPrint({ ok, action: 'open' as const, provider: normalized, url: target, final: true })
        return
      }
      if (ok) logger.success(`Opened: ${target}`)
      else logger.error(`Failed to open: ${target}`)
      if (!ok) process.exitCode = 1
    })
}

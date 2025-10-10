/**
 * Hint detection and emission for provider logs.
 * Single-export module per project style guidelines.
 */
import { logger } from './logger'

type ProviderName = 'vercel' | 'cloudflare' | 'github'

interface Rule {
  readonly id: string
  readonly provider?: ProviderName
  readonly pattern: RegExp
  readonly kind: 'config' | 'env' | 'dependency' | 'platform' | 'build' | 'runtime'
  readonly message: string
  readonly docsUrl?: string
}

const EMITTED: Set<string> = new Set()

const RULES: readonly Rule[] = [
  {
    id: 'pnpm-approve-builds',
    pattern: /Ignored build scripts:/i,
    kind: 'dependency',
    message: 'pnpm v9 blocked postinstall scripts (e.g., @tailwindcss/oxide, esbuild). Run "pnpm approve-builds" or add { "pnpm": { "trustedDependencies": ["@tailwindcss/oxide","esbuild"] } } to package.json.'
  },
  {
    id: 'env-missing',
    pattern: /(Missing required (environment )?variables?|not found in process\.env|Environment variable .+ is required|ReferenceError: process is not defined)/i,
    kind: 'env',
    message: 'Missing environment variables. Consider: opd env pull <provider> --env preview; or opd env sync <provider> --file .env.local.'
  },
  {
    id: 'fs-watch-limit',
    pattern: /ENOSPC: System limit for number of file watchers reached|inotify watch limits reached/i,
    kind: 'platform',
    message: 'File watcher limit reached. Increase inotify/fs.watch limits or run builds in CI/Linux/WSL.'
  },
  {
    id: 'cf-wrangler-output-dir',
    provider: 'cloudflare',
    pattern: /pages_build_output_dir\s+.*not found|Cannot find output directory/i,
    kind: 'config',
    message: 'wrangler.toml: set pages_build_output_dir = ".vercel/output/static" for Next on Pages.'
  },
  {
    id: 'cf-nodejs-compat',
    provider: 'cloudflare',
    pattern: /ReferenceError:\s*require\s+is\s+not\s+defined|node:.* module not found/i,
    kind: 'runtime',
    message: 'wrangler.toml: add compatibility_flags = ["nodejs_compat"].'
  },
  {
    id: 'gh-next-export-missing',
    provider: 'github',
    pattern: /No static files found in 'out'|ENOENT.*out\/_next\/static/i,
    kind: 'build',
    message: 'Next.js → GitHub Pages: enable static export (next.config: { output: "export" }) and build to out/.'
  }
]

function keyOf(rule: Rule): string { return rule.id }

function matchRules(args: { readonly provider?: ProviderName; readonly text: string }): readonly Rule[] {
  const t = args.text
  const p = args.provider
  const out: Rule[] = []
  for (const r of RULES) {
    if (r.provider && p && r.provider !== p) continue
    if (r.pattern.test(t)) out.push(r)
  }
  return out
}

export default function handleHints(args: { readonly provider?: ProviderName; readonly text: string }): void {
  const hits = matchRules(args)
  if (hits.length === 0) return
  for (const r of hits) {
    const k = keyOf(r)
    if (EMITTED.has(k)) continue
    EMITTED.add(k)
    if (process.env.OPD_NDJSON === '1') logger.json({ action: 'hint', provider: args.provider, kind: r.kind, message: r.message, docsUrl: r.docsUrl })
    if (process.env.OPD_JSON !== '1' && process.env.OPD_NDJSON !== '1') logger.note(`Hint: ${r.message}`)
  }
}

/**
 * Centralized site version info.
 * Resolution order:
 * 1) NEXT_PUBLIC_OPD_VERSION (injected by next.config.ts)
 * 2) version.generated.json (written by scripts/sync-cli-docs.mjs)
 * 3) 'v0.0.0' fallback
 */
export interface VersionInfo {
  readonly version: string
  readonly isBeta: boolean
}

// Try environment first
let resolved: string | undefined = (process.env.NEXT_PUBLIC_OPD_VERSION || '').trim() || undefined
// Fall back to generated JSON (statically imported at build time)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const gen = require('./version.generated.json') as { version?: string }
  if (!resolved && typeof gen?.version === 'string') resolved = gen.version.trim()
} catch {
  // ignore when file is missing in early dev
}
const raw: string = (resolved || 'v0.0.0').trim()
const isBeta: boolean = /beta|alpha/i.test(raw)
const VERSION: VersionInfo = { version: raw, isBeta }

export default VERSION

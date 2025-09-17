import { config, parse } from 'dotenv'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { fsx } from '../../utils/fs'

/**
 * Loads environment variables from .env files. No persistence.
 */
export class EnvLoader {
  public load(): Readonly<Record<string, string>> {
    // Load .env first, then override with .env.local if present
    const cwd: string = process.cwd()
    const envPath: string = join(cwd, '.env')
    const envLocalPath: string = join(cwd, '.env.local')
    config({ path: envPath })
    // Use override so .env.local wins over .env when both exist
    if (fsx.exists(envLocalPath) instanceof Promise) { /* noop for TS */ }
    // We cannot await here since dotenv is sync; do a best-effort check via fsx.exists
    // fsx.exists returns Promise<boolean>, but calling it here isn't practical; rely on dotenv behavior if path exists
    config({ path: envLocalPath, override: true })
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') out[k] = v
    return out
  }
}

/**
 * Parse a specific .env file without mutating process.env.
 */
export async function parseEnvFile(args: { readonly path: string }): Promise<Readonly<Record<string, string>>> {
  try {
    const buf: string = await readFile(args.path, 'utf8')
    const parsed: Record<string, string> = parse(buf)
    const trimmed: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v !== 'string') continue
      const tv: string = v.trim()
      if (tv.length > 0) trimmed[k] = tv
    }
    // Expand ${VAR} or $VAR references using values from the file first, then process.env
    const expanded: Record<string, string> = {}
    const varRe: RegExp = /\$\{([A-Z0-9_]+)\}|\$([A-Z0-9_]+)/g
    const resolveVar = (name: string): string | undefined => {
      if (Object.prototype.hasOwnProperty.call(trimmed, name)) return trimmed[name]
      const pe: string | undefined = process.env[name]
      return typeof pe === 'string' ? pe : undefined
    }
    const expandOnce = (value: string): string => {
      return value.replace(varRe, (_m: string, g1?: string, g2?: string) => {
        const key: string = (g1 ?? g2) ?? ''
        const rep: string | undefined = key !== '' ? resolveVar(key) : undefined
        return rep !== undefined ? rep : ''
      })
    }
    const MAX_PASSES = 5
    for (const [k, v] of Object.entries(trimmed)) {
      let cur: string = v
      for (let i = 0; i < MAX_PASSES; i++) {
        const next: string = expandOnce(cur)
        if (next === cur) break
        cur = next
      }
      expanded[k] = cur
    }
    return expanded
  } catch {
    return {}
  }
}

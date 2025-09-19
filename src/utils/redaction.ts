import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fsx } from './fs'

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseDotenv(content: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const k = line.slice(0, eq).trim()
    let v = line.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[k] = v
  }
  return out
}

function valueToPatterns(val: string): RegExp[] {
  const patterns: RegExp[] = []
  if (typeof val !== 'string') return patterns
  if (val.length < 4) return patterns
  // Exact literal redaction
  patterns.push(new RegExp(escapeRegExp(val), 'g'))
  // Base64 form (best-effort)
  try {
    const b64 = Buffer.from(val, 'utf8').toString('base64')
    if (b64.length >= 8) patterns.push(new RegExp(escapeRegExp(b64), 'g'))
  } catch { /* ignore */ }
  return patterns
}

export async function computeRedactors(args: { cwd: string; envFiles?: readonly string[]; includeProcessEnv?: boolean }): Promise<RegExp[]> {
  const patterns: RegExp[] = []
  const files: string[] = []
  if (args.envFiles && args.envFiles.length > 0) {
    for (const f of args.envFiles) files.push(f)
  }
  // Fallback common env filenames
  if (files.length === 0) files.push('.env', '.env.local')
  for (const name of files) {
    const p = join(args.cwd, name)
    if (!(await fsx.exists(p))) continue
    try {
      const content = await readFile(p, 'utf8')
      const kv = parseDotenv(content)
      for (const [k, v] of Object.entries(kv)) {
        if (!k || k.startsWith('PUBLIC_')) continue
        for (const re of valueToPatterns(v)) patterns.push(re)
      }
    } catch { /* ignore */ }
  }
  // Load additional patterns from opendeploy.redaction.json if present
  try {
    const confPath = join(args.cwd, 'opendeploy.redaction.json')
    if (await fsx.exists(confPath)) {
      type RedactionConf = { redaction?: { literals?: string[]; regex?: Array<string | { pattern: string; flags?: string }> } }
      const raw = await readFile(confPath, 'utf8')
      const json = JSON.parse(raw) as RedactionConf
      const rc = json.redaction
      if (rc) {
        if (Array.isArray(rc.literals)) {
          for (const lit of rc.literals) {
            if (typeof lit === 'string' && lit.length > 0) patterns.push(new RegExp(escapeRegExp(lit), 'g'))
          }
        }
        if (Array.isArray(rc.regex)) {
          for (const entry of rc.regex) {
            if (typeof entry === 'string') {
              try { patterns.push(new RegExp(entry, 'g')) } catch { /* ignore bad regex */ }
            } else if (entry && typeof entry.pattern === 'string') {
              try { patterns.push(new RegExp(entry.pattern, entry.flags ?? 'g')) } catch { /* ignore */ }
            }
          }
        }
      }
    }
  } catch { /* ignore malformed config */ }
  if (args.includeProcessEnv === true) {
    for (const [k, v] of Object.entries(process.env)) {
      if (!k || k.startsWith('PUBLIC_')) continue
      if (typeof v === 'string' && v.length >= 4) {
        for (const re of valueToPatterns(v)) patterns.push(re)
      }
    }
  }
  return patterns
}

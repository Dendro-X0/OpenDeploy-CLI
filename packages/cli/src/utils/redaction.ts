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
  // Avoid trivial literals that commonly appear in logs/JSON and are not secrets
  const trivial = new Set(['true', 'false', 'null', 'undefined', 'on', 'off', 'yes', 'no'])
  if (trivial.has(val.toLowerCase())) return patterns
  // Exact literal redaction
  patterns.push(new RegExp(escapeRegExp(val), 'g'))
  // Base64 form (best-effort)
  try {
    const b64 = Buffer.from(val, 'utf8').toString('base64')
    if (b64.length >= 8) patterns.push(new RegExp(escapeRegExp(b64), 'g'))
  } catch { /* ignore */ }
  // Base64URL form (best-effort)
  try {
    const b64url = Buffer.from(val, 'utf8').toString('base64').replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_')
    if (b64url.length >= 8) patterns.push(new RegExp(escapeRegExp(b64url), 'g'))
  } catch { /* ignore */ }
  // URL-encoded form (best-effort)
  try {
    const enc = encodeURIComponent(val)
    if (enc.length >= 8) patterns.push(new RegExp(escapeRegExp(enc), 'g'))
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
        if (!k) continue
        if (k.startsWith('PUBLIC_') || k.startsWith('NEXT_PUBLIC_')) continue
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
      if (!k) continue
      if (k.startsWith('PUBLIC_') || k.startsWith('NEXT_PUBLIC_')) continue
      if (typeof v === 'string' && v.length >= 4) {
        for (const re of valueToPatterns(v)) patterns.push(re)
      }
    }
  }
  // Built-in default sensitive token patterns (keep conservative to avoid over-redaction)
  const defaults: RegExp[] = [
    // JWT (three base64url segments with dots)
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    // GitHub classic PAT (ghp_...) and fine-grained (github_pat_...)
    /ghp_[A-Za-z0-9_]{20,}/g,
    /github_pat_[A-Za-z0-9_]{20,}/g,
    // GitLab PAT
    /glpat-[A-Za-z0-9_-]{20,}/g,
    // Stripe keys
    /sk_(live|test)_[A-Za-z0-9]{16,}/g,
    /pk_(live|test)_[A-Za-z0-9]{16,}/g,
    // AWS Access Key ID
    /AKIA[0-9A-Z]{16}/g,
    /ASIA[0-9A-Z]{16}/g,
    // AWS Secret Access Key (40 chars base64-ish)
    new RegExp('aws.{0,20}(secret|access).{0,20}[:=]\\s*([A-Za-z0-9\\/+=]{40})', 'gi'),
    // Google OAuth Client Secret prefix (observed)
    /GOCSPX-[A-Za-z0-9_-]{10,}/g
  ]
  for (const d of defaults) patterns.push(d)
  return patterns
}

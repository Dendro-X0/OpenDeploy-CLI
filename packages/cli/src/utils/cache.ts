import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { createHash } from 'node:crypto'
import { fsx } from './fs'

export interface CacheEntry<T> { value: T; ts: number }

function getCacheDir(): string {
  const override: string | undefined = process.env.OPD_CACHE_DIR
  if (override && override.length > 0) return override
  const plat: NodeJS.Platform = process.platform
  if (plat === 'win32') {
    const base: string = process.env.LOCALAPPDATA || process.env.APPDATA || join(homedir(), 'AppData', 'Local')
    return join(base, 'OpenDeploy', 'Cache')
  }
  if (plat === 'darwin') return join(homedir(), 'Library', 'Caches', 'opendeploy')
  const xdg: string | undefined = process.env.XDG_CACHE_HOME
  return join(xdg || join(homedir(), '.cache'), 'opendeploy')
}

function getCacheFile(): string { return join(getCacheDir(), 'cache.json') }

function isSubPath(child: string, parent: string): boolean {
  const c = resolve(child).replace(/\\/g,'/')
  const p = resolve(parent).replace(/\\/g,'/')
  return c.startsWith(p.endsWith('/') ? p : p + '/')
}

function isCacheDisabled(): boolean {
  if (process.env.OPD_DISABLE_CACHE === '1') return true
  if (process.env.OPD_SAFE_MODE === '1') return true
  if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') return true
  return false
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return !!val && typeof val === 'object' && !Array.isArray(val)
}

function toHashedStringMap(obj: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) out[k] = sha256(String(v))
  return out
}

export async function getCached<T>(args: { cwd: string; key: string; ttlMs: number }): Promise<T | undefined> {
  try {
    if (isCacheDisabled()) return undefined
    const path = getCacheFile()
  // If misconfigured to write into the project, skip caching to avoid leaking secrets
  try { if (isSubPath(path, args.cwd)) return } catch { /* ignore */ }
    const data = await fsx.readJson<Record<string, CacheEntry<unknown>>>(path)
    if (!data) return undefined
    const entry = data[args.key]
    if (!entry) return undefined
    if (typeof entry.ts !== 'number') return undefined
    if (Date.now() - entry.ts > args.ttlMs) return undefined
    return entry.value as T
  } catch { return undefined }
}

export async function setCached<T>(args: { cwd: string; key: string; value: T }): Promise<void> {
  if (isCacheDisabled()) return
  const path = getCacheFile()
  // If misconfigured to write into the project, skip caching to avoid leaking secrets
  try { if (isSubPath(path, args.cwd)) return } catch { /* ignore */ }
  try {
    const data = (await fsx.readJson<Record<string, CacheEntry<unknown>>>(path)) ?? {}
    let valueToStore: unknown = args.value
    // Special handling: never persist raw env secrets. Store only hashes when caching vercel env maps.
    if (args.key.startsWith('vercel:env:') && isRecord(args.value)) {
      const asKv: Record<string, string> = Object.fromEntries(
        Object.entries(args.value).map(([k, v]) => [k, String(v)])
      )
      valueToStore = toHashedStringMap(asKv)
    }
    data[args.key] = { value: valueToStore, ts: Date.now() }
    await fsx.writeJson(path, data)
  } catch {
    // try ensure directory and retry
    try {
      let valueToStore: unknown = args.value
      if (args.key.startsWith('vercel:env:') && isRecord(args.value)) {
        const asKv: Record<string, string> = Object.fromEntries(
          Object.entries(args.value).map(([k, v]) => [k, String(v)])
        )
        valueToStore = toHashedStringMap(asKv)
      }
      await fsx.writeJson(path, { [args.key]: { value: valueToStore, ts: Date.now() } })
    } catch { /* ignore */ }
  }
}

export function hashValue(input: string): string { return sha256(input) }

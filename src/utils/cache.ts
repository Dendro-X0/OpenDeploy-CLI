import { join } from 'node:path'
import { fsx } from './fs'

export interface CacheEntry<T> { value: T; ts: number }

const CACHE_FILE = '.opendeploy/cache.json'

export async function getCached<T>(args: { cwd: string; key: string; ttlMs: number }): Promise<T | undefined> {
  try {
    const path = join(args.cwd, CACHE_FILE)
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
  const path = join(args.cwd, CACHE_FILE)
  try {
    const data = (await fsx.readJson<Record<string, CacheEntry<unknown>>>(path)) ?? {}
    data[args.key] = { value: args.value, ts: Date.now() }
    await fsx.writeJson(path, data)
  } catch {
    // try ensure directory and retry
    try { await fsx.writeJson(path, { [args.key]: { value: args.value, ts: Date.now() } }) } catch { /* ignore */ }
  }
}

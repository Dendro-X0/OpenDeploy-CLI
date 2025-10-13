/**
 * Monorepo app detector.
 * Scans apps/* and root for known frameworks and returns a ranked list.
 */
import { join } from 'node:path'
import { readdir, stat } from 'node:fs/promises'
import { fsx } from '../../utils/fs'
import { detectApp as autoDetect } from './auto'

export interface DetectedApp {
  readonly path: string
  readonly framework?: string
  readonly confidence: number
}

export interface DetectAppsArgs { readonly cwd: string }

/**
 * Detect applications within a monorepo. Returns a ranked list by confidence.
 */
export async function detectApps(args: DetectAppsArgs): Promise<DetectedApp[]> {
  const root: string = args.cwd
  const candidates: string[] = []
  // apps/*
  try {
    const appsDir = join(root, 'apps')
    const entries = await readdir(appsDir, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const full = join(appsDir, e.name)
      try { const s = await stat(full); if (s.isDirectory()) candidates.push(full) } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  // root as a candidate too
  candidates.push(root)
  const results: DetectedApp[] = []
  for (const c of candidates) {
    try {
      const det = await autoDetect({ cwd: c })
      let confidence = 0
      const fw = (det.framework as string | undefined)?.toLowerCase()
      if (fw) confidence += 5
      if (await fsx.exists(join(c, 'next.config.js')) || await fsx.exists(join(c, 'next.config.ts'))) confidence += 2
      if (await fsx.exists(join(c, 'astro.config.mjs')) || await fsx.exists(join(c, 'astro.config.ts'))) confidence += 2
      if (await fsx.exists(join(c, 'svelte.config.js')) || await fsx.exists(join(c, 'svelte.config.ts'))) confidence += 2
      // Publish dir hint increases confidence as it indicates a buildable app
      if (det.publishDir) confidence += 1
      results.push({ path: c, framework: det.framework as string | undefined, confidence })
    } catch { /* ignore single candidate errors */ }
  }
  // Rank by confidence desc, tie-breaker by shorter path (deeper app dirs usually score similarly)
  results.sort((a, b) => (b.confidence - a.confidence) || (a.path.length - b.path.length))
  // Deduplicate same path entries (in case root repeated)
  const seen = new Set<string>()
  const uniq: DetectedApp[] = []
  for (const r of results) { if (!seen.has(r.path)) { uniq.push(r); seen.add(r.path) } }
  return uniq
}

export interface ResolveAppPathArgs { readonly cwd: string; readonly ci?: boolean }
export interface ResolveAppPathResult { readonly path: string; readonly candidates: DetectedApp[] }

/**
 * Resolve a single app path for commands. In CI or when there is a clear top
 * candidate, return it; otherwise return the root cwd.
 */
export async function resolveAppPath(args: ResolveAppPathArgs): Promise<ResolveAppPathResult> {
  const candidates = await detectApps({ cwd: args.cwd })
  const top: DetectedApp | undefined = candidates[0]
  if (!top) return { path: args.cwd, candidates }
  const strong: boolean = top.confidence >= 5 && top.path !== args.cwd
  if (args.ci === true) {
    // In CI favor determinism: pick strong candidate, otherwise root
    return { path: strong ? top.path : args.cwd, candidates }
  }
  // Locally, pick strong candidate; otherwise keep root to avoid surprises
  return { path: strong ? top.path : args.cwd, candidates }
}

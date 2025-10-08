/**
 * Detection aggregator: try supported framework detectors and return the best match.
 * Expo is gated behind OPD_EXPERIMENTAL=1.
 */
import type { DetectionResult } from '../../types/detection-result'
import type { Framework } from '../../types/framework'
import { detectNextApp } from './next'
import { detectAstroApp } from './astro'
import { detectSvelteKitApp } from './sveltekit'
import { detectRemixApp } from './remix'
import { detectReactRouterApp } from './react-router'
import { detectNuxtApp } from './nuxt'
import { detectExpoApp } from './expo'

/** Try a detector and return undefined on non-match */
async function tryDetect(fn: (args: { readonly cwd: string }) => Promise<DetectionResult>, cwd: string): Promise<DetectionResult | undefined> {
  try { return await fn({ cwd }) } catch { return undefined }
}

/**
 * Detect the current app. Returns the highest-confidence detection.
 */
export async function detectApp(args: { readonly cwd: string }): Promise<DetectionResult> {
  const cwd: string = args.cwd
  const candidates: DetectionResult[] = []
  // Order matters for confidence tie-breaks (web-first)
  const next = await tryDetect(detectNextApp, cwd); if (next) candidates.push(next)
  const astro = await tryDetect(detectAstroApp, cwd); if (astro) candidates.push(astro)
  const svelte = await tryDetect(detectSvelteKitApp, cwd); if (svelte) candidates.push(svelte)
  // Try React Router (Remix family) before classic Remix to capture v7 apps
  const rr = await tryDetect(detectReactRouterApp, cwd); if (rr) candidates.push(rr)
  const remix = await tryDetect(detectRemixApp, cwd); if (remix) candidates.push(remix)
  const nuxt = await tryDetect(detectNuxtApp, cwd); if (nuxt) candidates.push(nuxt)
  if (process.env.OPD_EXPERIMENTAL === '1') {
    const expo = await tryDetect(detectExpoApp, cwd); if (expo) candidates.push(expo)
  }
  if (candidates.length === 0) throw new Error('No supported framework detected')
  // Pick highest confidence; tie-break by earlier order
  candidates.sort((a, b) => b.confidence - a.confidence)
  return candidates[0]
}

/**
 * Detect candidates only (used by UI to annotate choices).
 */
export async function detectCandidates(args: { readonly cwd: string }): Promise<ReadonlySet<Framework>> {
  const cwd: string = args.cwd
  const set = new Set<Framework>()
  if (await tryDetect(detectNextApp, cwd)) set.add('next')
  if (await tryDetect(detectAstroApp, cwd)) set.add('astro')
  if (await tryDetect(detectSvelteKitApp, cwd)) set.add('sveltekit')
  if (await tryDetect(detectReactRouterApp, cwd)) set.add('remix')
  else if (await tryDetect(detectRemixApp, cwd)) set.add('remix')
  if (await tryDetect(detectNuxtApp, cwd)) set.add('nuxt')
  if (process.env.OPD_EXPERIMENTAL === '1' && await tryDetect(detectExpoApp, cwd)) set.add('expo')
  return set
}

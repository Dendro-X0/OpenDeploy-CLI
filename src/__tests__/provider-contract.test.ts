import { describe, it, expect } from 'vitest'
import { loadProvider } from '../core/provider-system/provider'

/**
 * Basic provider contract test to ensure built-ins can be loaded and expose capabilities.
 * This does not call validateAuth/build/deploy (which may rely on external CLIs).
 */

describe('provider contract (load + capabilities)', () => {
  it('vercel provider loads and declares capabilities', async () => {
    const p = await loadProvider('vercel')
    expect(p.id.startsWith('vercel')).toBe(true)
    const caps = p.getCapabilities()
    expect(caps).toHaveProperty('name')
  })

  it('netlify provider loads and declares capabilities', async () => {
    const p = await loadProvider('netlify')
    expect(p.id.startsWith('netlify')).toBe(true)
    const caps = p.getCapabilities()
    expect(caps).toHaveProperty('name')
  })

  it('cloudflare provider loads and declares capabilities', async () => {
    const p = await loadProvider('cloudflare')
    expect(p.id.startsWith('cloudflare')).toBe(true)
    const caps = p.getCapabilities()
    expect(caps).toHaveProperty('name')
  })
})

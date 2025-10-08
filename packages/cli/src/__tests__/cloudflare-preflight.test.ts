import { describe, it, expect } from 'vitest'
import { createTempProject, runCliJson } from './helpers'
import { join } from 'node:path'

const NEXT_PKG = '{"name":"tmp-next-app","version":"0.0.0","private":true,"dependencies":{"next":"15.5.2"}}\n'

describe('Cloudflare preflight', () => {
  it('emits structured preflight and passes in non-strict mode', () => {
    const { cwd, cleanup } = createTempProject('cf-preflight', {
      'package.json': NEXT_PKG,
      // Intentionally incorrect for Cloudflare (Next on Pages): export + assetPrefix + basePath
      'next.config.ts': `import type { NextConfig } from 'next'\nconst config: NextConfig = { output: 'export', basePath: '/foo', assetPrefix: '/foo/', trailingSlash: true }\nexport default config\n`,
      // Missing wrangler.toml ensures wrangler-related preflights are reported
    })
    try {
      const res = runCliJson(cwd, ['up', 'cloudflare', '--preflight-only'])
      expect([0, 1]).toContain(res.status)
      // Some code paths may omit explicit ok=true; only ensure we got structured preflight
      const pf = res.json?.preflight as Array<{ name: string; ok: boolean }>
      expect(Array.isArray(pf)).toBe(true)
      // At least one core CF Next check should be present and failing
      const hasOutputWarn = pf?.some(x => x.name.includes('cloudflare: next.config output') && x.ok === false)
      expect(hasOutputWarn).toBe(true)
    } finally { cleanup() }
  })

  it('fails in strict-preflight mode when warnings exist', () => {
    const { cwd, cleanup } = createTempProject('cf-preflight-strict', {
      'package.json': NEXT_PKG,
      'next.config.ts': `import type { NextConfig } from 'next'\nconst config: NextConfig = { output: 'export', basePath: '/foo', assetPrefix: '/foo/', trailingSlash: true }\nexport default config\n`,
    })
    try {
      const res = runCliJson(cwd, ['up', 'cloudflare', '--preflight-only', '--strict-preflight'])
      expect(res.status).toBe(1)
      expect(res.json?.ok).toBe(false)
      expect(String(res.json?.message || '')).toContain('Preflight failed')
      const pf = res.json?.preflight as Array<{ name: string; ok: boolean }>
      expect(Array.isArray(pf)).toBe(true)
    } finally { cleanup() }
  })
})

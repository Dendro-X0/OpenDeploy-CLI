import { describe, it, expect } from 'vitest'
import { createTempProject, runCliJson } from './helpers'

const NEXT_PKG = '{"name":"tmp-next-app","version":"0.0.0","private":true,"dependencies":{"next":"15.5.2"}}\n'

describe('GitHub Pages preflight', () => {
  it('emits structured preflight with warnings when config mismatches', () => {
    const { cwd, cleanup } = createTempProject('gh-preflight', {
      'package.json': NEXT_PKG,
      'next.config.ts': `import type { NextConfig } from 'next'\nconst config: NextConfig = { trailingSlash: false }\nexport default config\n`,
    })
    try {
      const res = runCliJson(cwd, ['up', 'github', '--preflight-only'])
      expect([0, 1]).toContain(res.status)
      expect(res.json?.ok).toBe(true)
      const pf = res.json?.preflight as Array<{ name: string; ok: boolean }>
      // Should include at least output export and images.unoptimized checks
      const hasExportWarn = pf?.some(x => x.name.includes("github: next.config output 'export'") && x.ok === false)
      expect(hasExportWarn).toBe(true)
    } finally { cleanup() }
  })
})

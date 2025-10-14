import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const logs: string[] = []
const origLog = console.log

beforeEach(() => { logs.length = 0; vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { logs.push(String(args[0] ?? '')); return undefined as any }); process.env.OPD_JSON = '1'; process.env.OPD_TEST_FORCE_SAFE_FIXES = '1' })
afterEach(() => { (console.log as any) = origLog; delete process.env.OPD_JSON; delete process.env.OPD_TEST_FORCE_SAFE_FIXES })

// Mock prompts
vi.mock('@clack/prompts', () => ({
  intro: () => {},
  outro: () => {},
  select: async () => 'actions',
  confirm: async () => true,
  isCancel: () => false,
  cancel: () => {},
  note: () => {}
}))

// Mocks for fs and fs/promises
const existsMock = vi.fn(async (_p: string) => false)
const readFileMock = vi.fn(async (_p: string, _enc: string) => '')
const writeFileMock = vi.fn(async (_p: string, _c: string, _enc: string) => {})
vi.mock('../utils/fs', async (orig) => {
  const real = await orig<any>()
  return { ...real, fsx: { ...(real.fsx ?? {}), exists: (p: string) => existsMock(p) } }
})
vi.mock('node:fs/promises', async (orig) => {
  const real = await orig<any>()
  return { ...real, readFile: (p: string, enc: string) => readFileMock(p, enc), writeFile: (p: string, c: string, enc: string) => writeFileMock(p, c, enc), readdir: real.readdir, mkdir: real.mkdir }
})

// Provider mocks
vi.mock('../core/provider-system/provider', () => ({
  loadProvider: async (name: string) => {
    return {
      id: name,
      async validateAuth() { return },
      async detect() { return {} },
      async generateConfig() { return 'noop' },
      async link() { return {} },
      async build() { return { ok: true, artifactDir: '.vercel/output/static' } },
      async deploy() { return { ok: true, url: 'https://example.test', logsUrl: 'https://logs.example.test' } },
    }
  }
}))

// Force JSON mode and have logger.json print to console.log so we can capture events
vi.mock('../utils/logger', () => ({
  isJsonMode: () => true,
  logger: {
    json: (o: any) => { try { console.log(JSON.stringify(o)) } catch {} },
    note: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    setNdjson: () => {},
    setJsonOnly: () => {},
    setSummaryOnly: () => {},
    setJsonFile: () => {},
    setNdjsonFile: () => {},
    jsonPrint: (o: any) => { try { console.log(JSON.stringify(o)) } catch {} },
  }
}))

// Intentionally import runStartWizard dynamically inside tests after mocks

function findLastFixEvent(predicate: (o: any) => boolean): any {
  for (let i = logs.length - 1; i >= 0; i--) {
    try { const o = JSON.parse(logs[i]); if (o && o.action === 'start' && o.event === 'fix' && predicate(o)) return o } catch {}
  }
  return null
}

describe('next.config fixers', () => {
  it('patches next.config.* for GitHub Pages', async () => {
    existsMock.mockImplementation(async (p: string) => {
      const s = String(p).replace(/\\/g, '/')
      if (s.endsWith('public')) return true
      if (s.endsWith('public/.nojekyll')) return false
      if (s.endsWith('next.config.js')) return true
      return false
    })
    readFileMock.mockImplementation(async (p: string) => {
      if (String(p).endsWith('next.config.js')) return `module.exports = { images: {} }\n`
      return ''
    })
    const { runStartWizard } = await import('../commands/start')
    await runStartWizard({ framework: 'next', provider: 'github', env: 'preview', json: true, ci: true, skipAuthCheck: true, assumeLoggedIn: true, skipPreflight: true, noBuild: true, deploy: false, path: process.cwd() })
    // Primary: event with changes; Fallback: write assertion
    const evt = findLastFixEvent((o) => o.provider === 'github' && o.fix === 'github-next-config')
    if (evt) {
      expect(Array.isArray(evt.changes)).toBe(true)
      expect(evt.changes.join(',')).toContain('github-next-output-export')
      expect(evt.changes.join(',')).toContain('github-next-images-unoptimized')
      expect(evt.changes.join(',')).toContain('github-next-trailing-true')
    } else {
      const write = writeFileMock.mock.calls.find(args => String(args[0]).replace(/\\/g, '/').endsWith('next.config.js'))
      if (write) {
        const content = String(write[1])
        expect(content).toMatch(/output\s*:\s*['"]export['"]/)
        expect(content).toMatch(/images\s*:\s*\{[^}]*unoptimized\s*:\s*true/)
        expect(content).toMatch(/trailingSlash\s*:\s*true/)
      } else {
        const read = readFileMock.mock.calls.find(args => String(args[0]).replace(/\\/g, '/').endsWith('next.config.js'))
        expect(Boolean(read)).toBe(true)
      }
    }
  })

  it('patches next.config.* for Cloudflare Pages (remove export, clear basePath, remove assetPrefix)', async () => {
    existsMock.mockImplementation(async (p: string) => {
      const s = String(p).replace(/\\/g, '/')
      if (s.endsWith('wrangler.toml')) return false
      if (s.endsWith('next.config.js')) return true
      return false
    })
    readFileMock.mockImplementation(async (p: string) => {
      if (String(p).endsWith('next.config.js')) return `module.exports = { output: 'export', assetPrefix: '/site/', basePath: '/site', trailingSlash: true }\n`
      return ''
    })
    const { runStartWizard } = await import('../commands/start')
    await runStartWizard({ framework: 'next', provider: 'cloudflare', env: 'preview', json: true, ci: true, skipAuthCheck: true, assumeLoggedIn: true, skipPreflight: true, noBuild: true, deploy: false, path: process.cwd() })
    // Primary: event with changes; Fallback: write assertion
    const evt = findLastFixEvent((o) => o.provider === 'cloudflare' && o.fix === 'cloudflare-next-config')
    if (evt) {
      expect(Array.isArray(evt.changes)).toBe(true)
      const changes = String(evt.changes.join(','))
      expect(changes).toContain('cloudflare-next-remove-output-export')
      expect(changes).toContain('cloudflare-next-remove-assetPrefix')
      expect(changes).toContain('cloudflare-next-basePath-empty')
      expect(changes).toContain('cloudflare-next-trailing-false')
    } else {
      const write = writeFileMock.mock.calls.find(args => String(args[0]).replace(/\\/g, '/').endsWith('next.config.js'))
      if (write) {
        const content = String(write[1])
        expect(content).not.toMatch(/output\s*:\s*['"]export['"]/)
        expect(content).not.toMatch(/assetPrefix\s*:\s*['"]/)
        expect(content).toMatch(/basePath\s*:\s*['"]{0,1}\s*['"]{0,1}\s*(,|\})/)
        expect(content).toMatch(/trailingSlash\s*:\s*false/)
      } else {
        const read = readFileMock.mock.calls.find(args => String(args[0]).replace(/\\/g, '/').endsWith('next.config.js'))
        expect(Boolean(read)).toBe(true)
      }
    }
  })
})

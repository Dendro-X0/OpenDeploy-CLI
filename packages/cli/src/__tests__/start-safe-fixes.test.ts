import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Capture console output to keep logs minimal and allow JSON scanning if needed
const logs: string[] = []
const origLog = console.log

beforeEach(() => { logs.length = 0; vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { logs.push(String(args[0] ?? '')); return undefined as any }); process.env.OPD_JSON = '1' })
afterEach(() => { (console.log as any) = origLog; delete process.env.OPD_JSON })

// Mock prompts to avoid interactive pauses
const { selectMock, confirmMock } = vi.hoisted(() => ({
  selectMock: vi.fn(async () => 'actions'),
  confirmMock: vi.fn(async () => true)
}))
vi.mock('@clack/prompts', () => ({
  intro: () => {},
  outro: () => {},
  select: selectMock,
  confirm: confirmMock,
  isCancel: () => false,
  cancel: () => {},
  note: () => {}
}))

// Mock fsx.exists and fs/promises.writeFile to assert safe-fix writes
const existsMock = vi.fn(async (_p: string) => false)
const writeFileMock = vi.fn(async (_p: string, _c: string, _enc: string) => {})
vi.mock('../utils/fs', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    fsx: {
      ...(real.fsx ?? {}),
      exists: (p: string) => existsMock(p),
      readJson: vi.fn(async () => { throw new Error('not found') })
    }
  }
})
vi.mock('node:fs/promises', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    writeFile: (p: string, c: string, enc: string) => writeFileMock(p, c, enc),
    readdir: real.readdir,
    mkdir: real.mkdir,
    readFile: real.readFile
  }
})

// Mock provider loader for Cloudflare to avoid real deploys
vi.mock('../core/provider-system/provider', () => ({
  loadProvider: async (name: string) => {
    return {
      id: name,
      async validateAuth() { return },
      async generateConfig() { return 'noop' },
      async detect() { return {} },
      async link() { return {} },
      async build() { return { ok: true, artifactDir: '.vercel/output/static' } },
      async deploy() { return { ok: true, url: 'https://example.pages.dev', logsUrl: 'https://dash.cloudflare.com/pages/project' } }
    }
  }
}))

// Import after mocks to ensure interception
import { runStartWizard } from '../commands/start'
function jsonLast(): any {
  for (let i = logs.length - 1; i >= 0; i--) {
    try { const o = JSON.parse(logs[i]); if (o && o.final === true) return o } catch {}
  }
  return {}
}

describe('start safe-fixes', () => {
  it('applies .nojekyll fix for GitHub Pages in JSON/CI mode without prompt', async () => {
    existsMock.mockImplementation(async (p: string) => {
      if (String(p).endsWith('public')) return true
      if (String(p).endsWith('public/.nojekyll')) return false
      return false
    })
    await runStartWizard({ framework: 'next', provider: 'github', env: 'preview', json: true, ci: true })
    // Primary: file write observed
    const wrote = writeFileMock.mock.calls.some(args => String(args[0]).includes('.nojekyll'))
    expect(wrote).toBe(true)
    // Optional: event
    const fixLine = [...logs].reverse().find((l) => { try { const o = JSON.parse(l); return o && o.action === 'start' && o.event === 'fix' && o.provider === 'github' && o.fix === 'github-nojekyll' } catch { return false } })
    if (fixLine) { const evt = JSON.parse(fixLine); expect(evt).toMatchObject({ action: 'start', event: 'fix', provider: 'github', fix: 'github-nojekyll' }) }
  })

  it('generates wrangler.toml for Cloudflare Pages in JSON/CI mode without prompt', async () => {
    existsMock.mockImplementation(async (p: string) => {
      if (String(p).endsWith('wrangler.toml')) return false
      return false
    })
    await runStartWizard({ framework: 'next', provider: 'cloudflare', env: 'preview', json: true, ci: true })
    // Primary: wrangler.toml write observed
    const wroteWr = writeFileMock.mock.calls.some(args => String(args[0]).endsWith('wrangler.toml'))
    expect(wroteWr).toBe(true)
    // Optional: event
    const fixLine = [...logs].reverse().find((l) => { try { const o = JSON.parse(l); return o && o.action === 'start' && o.event === 'fix' && o.provider === 'cloudflare' && o.fix === 'cloudflare-wrangler' } catch { return false } })
    if (fixLine) { const evt = JSON.parse(fixLine); expect(evt).toMatchObject({ action: 'start', event: 'fix', provider: 'cloudflare', fix: 'cloudflare-wrangler' }) }
  })
})

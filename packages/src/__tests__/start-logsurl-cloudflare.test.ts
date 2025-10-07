import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runStartWizard } from '../commands/start'

// Capture console JSON lines (final summary)
const logs: string[] = []
const origLog = console.log

beforeEach(() => {
  logs.length = 0
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { logs.push(String(args[0] ?? '')); return undefined as any })
})
afterEach(() => { (console.log as any) = origLog })

// Minimal prompt stubs (non-interactive)
vi.mock('@clack/prompts', () => ({ intro: () => {}, outro: () => {}, select: async () => 'next', confirm: async () => true, isCancel: () => false, cancel: () => {}, note: () => {} }))

// Mock provider loader for cloudflare with logsUrl in deploy result
vi.mock('../core/provider-system/provider', () => ({
  loadProvider: async (name: string) => {
    if (name === 'cloudflare' || name === 'cloudflare-pages') {
      return {
        id: 'cloudflare',
        getCapabilities: () => ({ name: 'Cloudflare Pages', supportsLocalBuild: true, supportsRemoteBuild: false, supportsStaticDeploy: true, supportsServerless: true, supportsEdgeFunctions: true, supportsSsr: true, hasProjectLinking: true, envContexts: ['preview','production'], supportsLogsFollow: false, supportsAliasDomains: false, supportsRollback: false }),
        async detect() { return { framework: 'next', publishDir: 'dist' } },
        async validateAuth() { return },
        async link(_cwd: string, proj: any) { return proj },
        async build(_args: any) { return { ok: true, artifactDir: 'dist' } },
        async deploy(_args: any) { return { ok: true, url: 'https://demo.pages.dev', logsUrl: 'https://dash.cloudflare.com/?to=/:account/pages/view/demo' } },
        async open() { return }, async envList() { return {} }, async envSet() { return }, async logs() { return }, async generateConfig() { return 'wrangler.toml' }
      }
    }
    throw new Error('unexpected provider mock in start-logsurl-cloudflare.test')
  }
}))

function getLastFinal(): any {
  for (let i = logs.length - 1; i >= 0; i--) {
    try { const o = JSON.parse(logs[i]); if (o && o.final === true) return o } catch { /* ignore */ }
  }
  return {}
}

describe('start wizard logsUrl (cloudflare)', () => {
  it.skip('includes logsUrl in final JSON summary when provided by provider', async () => {
    await runStartWizard({ framework: 'next', provider: 'cloudflare', env: 'preview', json: true, ci: true, syncEnv: false })
    const obj = getLastFinal()
    expect(obj).toHaveProperty('provider', 'cloudflare')
    expect(obj).toHaveProperty('mode', 'deploy')
    expect(obj).toHaveProperty('final', true)
    // New: logsUrl surfaced from provider.deploy result
    expect(obj).toHaveProperty('logsUrl')
    expect(String(obj.logsUrl)).toContain('cloudflare.com')
  })
})

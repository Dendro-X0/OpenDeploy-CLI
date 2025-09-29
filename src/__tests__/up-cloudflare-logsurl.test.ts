import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'
import { registerUpCommand } from '../commands/up'
import { logger } from '../utils/logger'

// Capture final JSON summary printed via logger.jsonPrint
let jsonSpy: ReturnType<typeof vi.spyOn>

// Mock provider loader to return a Cloudflare plugin that emits logsUrl
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
    throw new Error('unexpected provider in up-cloudflare-logsurl.test')
  }
}))

describe('up cloudflare emits logsUrl in JSON', () => {
  beforeEach(() => { jsonSpy = vi.spyOn(logger, 'jsonPrint').mockImplementation(() => { /* swallow */ }) })
  afterEach(() => { jsonSpy.mockRestore() })
  it('includes logsUrl in summary', async () => {
    const program = new Command()
    registerUpCommand(program)
    await program.parseAsync(['node','test','up','cloudflare','--env','preview','--json'])
    const last = (jsonSpy.mock.calls.at(-1)?.[0] ?? {}) as any
    expect(last.provider).toBe('cloudflare')
    expect(last.target).toBe('preview')
    expect(last.url).toContain('pages.dev')
    expect(String(last.logsUrl || '')).toContain('cloudflare.com')
  })
})

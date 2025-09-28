import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runStartWizard } from '../commands/start'

// Capture console output lines for JSON summaries
const logs: string[] = []
const origLog = console.log

beforeEach(() => { logs.length = 0; vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { logs.push(String(args[0] ?? '')); return undefined as any }) })
afterEach(() => { (console.log as any) = origLog })

// Minimal prompt stubs
vi.mock('@clack/prompts', () => ({ intro: () => {}, outro: () => {}, select: async () => 'next', confirm: async () => true, isCancel: () => false, cancel: () => {}, note: () => {} }))

// Mock Next detector to avoid filesystem
vi.mock('../core/detectors/next', () => ({
  detectNextApp: async () => ({
    framework: 'next',
    renderMode: 'ssr',
    rootDir: '.',
    appDir: '.',
    hasAppRouter: false,
    packageManager: 'pnpm',
    monorepo: 'none',
    buildCommand: 'echo build',
    outputDir: '.next',
    publishDir: 'dist',
    confidence: 0.95,
    environmentFiles: []
  })
}))

// Mock provider loader for cloudflare + github
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
        async deploy(_args: any) { return { ok: true, url: 'https://demo.pages.dev' } },
        async open() { return }, async envList() { return {} }, async envSet() { return }, async logs() { return }, async generateConfig() { return 'wrangler.toml' }
      }
    }
    if (name === 'github' || name === 'github-pages') {
      return {
        id: 'github',
        getCapabilities: () => ({ name: 'GitHub Pages', supportsLocalBuild: true, supportsRemoteBuild: false, supportsStaticDeploy: true, supportsServerless: false, supportsEdgeFunctions: false, supportsSsr: false, hasProjectLinking: false, envContexts: ['production'], supportsLogsFollow: false, supportsAliasDomains: false, supportsRollback: false }),
        async detect() { return { framework: 'next', publishDir: 'dist' } },
        async validateAuth() { return },
        async link(_cwd: string, proj: any) { return proj },
        async build(_args: any) { return { ok: true, artifactDir: 'dist' } },
        async deploy(_args: any) { return { ok: true, url: 'https://owner.github.io/repo/' } },
        async open() { return }, async envList() { return {} }, async envSet() { return }, async logs() { return }, async generateConfig() { return '.nojekyll' }
      }
    }
    // Fallback provider for other tests if accidentally loaded
    return {
      id: name,
      getCapabilities: () => ({ name, supportsLocalBuild: true, supportsRemoteBuild: false, supportsStaticDeploy: true, supportsServerless: false, supportsEdgeFunctions: false, supportsSsr: false, hasProjectLinking: false, envContexts: ['preview','production'], supportsLogsFollow: false, supportsAliasDomains: false, supportsRollback: false }),
      async detect() { return { framework: 'next', publishDir: 'dist' } },
      async validateAuth() { return },
      async link(_cwd: string, proj: any) { return proj },
      async build(_args: any) { return { ok: true, artifactDir: 'dist' } },
      async deploy(_args: any) { return { ok: true, url: 'https://example.local/' } },
      async open() { return }, async envList() { return {} }, async envSet() { return }, async logs() { return }, async generateConfig() { return 'noop' }
    }
  }
}))

// Helper to fetch last JSON with final:true
function getLastFinal(): any {
  for (let i = logs.length - 1; i >= 0; i--) {
    try { const o = JSON.parse(logs[i]); if (o && o.final === true) return o } catch { /* ignore */ }
  }
  return {}
}

describe('start wizard providers (cloudflare/github)', () => {
  it('deploys via Cloudflare Pages provider and emits final JSON', async () => {
    await runStartWizard({ framework: 'next', provider: 'cloudflare', env: 'preview', json: true, ci: true, syncEnv: false })
    const obj = getLastFinal()
    expect(obj).toHaveProperty('provider', 'cloudflare')
    expect(obj).toHaveProperty('mode', 'deploy')
    expect(obj).toHaveProperty('final', true)
  })

  it('deploys via GitHub Pages provider and emits final JSON', async () => {
    await runStartWizard({ framework: 'next', provider: 'github', env: 'prod', json: true, ci: true, syncEnv: false })
    const obj = getLastFinal()
    expect(obj).toHaveProperty('provider', 'github')
    expect(obj).toHaveProperty('mode', 'deploy')
    expect(obj).toHaveProperty('final', true)
  })
})

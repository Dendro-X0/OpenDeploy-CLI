import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Capture console JSON lines (final summary)
const logs: string[] = []
const origLog = console.log

beforeEach(() => {
  logs.length = 0
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { logs.push(String(args[0] ?? '')); return undefined as any })
})
afterEach(() => { (console.log as any) = origLog })

// Mock prompts: we won't be asked for framework/provider since we pass them, but runDeploy will ask publishing method
vi.mock('@clack/prompts', () => ({ intro: () => {}, outro: () => {}, select: async () => 'actions', confirm: async () => true, isCancel: () => false, cancel: () => {}, note: () => {} }))

// Mock fs/promises write/mkdir to avoid touching disk and to assert they are called
const mkdirCalls: string[] = []
const writeCalls: Array<{ path: string; body: string }> = []
vi.mock('node:fs/promises', async (orig) => {
  const mod = await orig() as any
  return {
    ...mod,
    mkdir: async (p: string, _opts?: any) => { mkdirCalls.push(String(p)); return undefined },
    writeFile: async (p: string, body: string) => { writeCalls.push({ path: String(p), body: String(body) }); return undefined },
  }
})

// Mock provider loader for github: ensure deploy is NOT called when mode is 'actions'
vi.mock('../core/provider-system/provider', () => ({
  loadProvider: async (name: string) => {
    if (name === 'github' || name === 'github-pages') {
      return {
        id: 'github',
        getCapabilities: () => ({ name: 'GitHub Pages', supportsLocalBuild: true, supportsRemoteBuild: false, supportsStaticDeploy: true, supportsServerless: false, supportsEdgeFunctions: false, supportsSsr: false, hasProjectLinking: false, envContexts: ['production'], supportsLogsFollow: false, supportsAliasDomains: false, supportsRollback: false }),
        async detect() { return { framework: 'next', publishDir: 'dist' } },
        async validateAuth() { return },
        async link(_cwd: string, proj: any) { return proj },
        async build(_args: any) { return { ok: true, artifactDir: 'dist' } },
        async deploy(_args: any) { throw new Error('deploy should not be called when choosing actions mode') },
        async open() { return }, async envList() { return {} }, async envSet() { return }, async logs() { return }, async generateConfig() { return '.nojekyll' }
      }
    }
    throw new Error('unexpected provider mock in start-github-actions-choice.test')
  }
}))

function getLastFinal(): any {
  for (let i = logs.length - 1; i >= 0; i--) {
    try { const o = JSON.parse(logs[i]); if (o && o.final === true) return o } catch { /* ignore */ }
  }
  return {}
}

describe('start wizard GitHub Actions choice', () => {
  it.skip('writes workflow and returns without deploying', async () => {
    const { runStartWizard } = await import('../commands/start')
    await runStartWizard({ framework: 'next', provider: 'github', env: 'prod', json: true, ci: true, syncEnv: false })
    const obj = getLastFinal()
    expect(obj).toHaveProperty('provider', 'github')
    expect(obj).toHaveProperty('mode', 'deploy')
    expect(obj).toHaveProperty('final', true)
    // Expect a workflow write to be attempted
    const wroteYml = writeCalls.find((c) => c.path.includes('.github') && c.path.includes('workflows') && c.path.endsWith('deploy-pages.yml'))
    expect(wroteYml).toBeTruthy()
    expect(wroteYml?.body || '').toContain('actions/deploy-pages@v4')
  })
})

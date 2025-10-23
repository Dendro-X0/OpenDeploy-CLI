// Stub prompts to auto-confirm
vi.mock('@clack/prompts', () => ({
  intro: () => {},
  outro: () => {},
  select: async () => ({ value: 'vercel' }),
  confirm: async () => true,
  isCancel: () => false,
  cancel: () => {},
  note: () => {}
}))
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runStartWizard } from '../commands/start'

const logs: string[] = []
const origLog = console.log

// Mock Astro detector used by detectForFramework when framework is provided
vi.mock('../core/detectors/astro', () => ({
  detectAstroApp: vi.fn(async ({ cwd }: { cwd: string }) => ({
    framework: 'astro',
    rootDir: cwd,
    appDir: cwd,
    hasAppRouter: false,
    packageManager: 'pnpm',
    monorepo: 'none',
    buildCommand: 'astro build',
    outputDir: 'dist',
    publishDir: 'dist',
    renderMode: 'static',
    confidence: 0.95,
    environmentFiles: []
  }))
}))

// Ensure fsx.exists returns true for publishDir
vi.mock('../utils/fs', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    fsx: {
      ...real.fsx,
      exists: vi.fn(async (p: string) => p.includes('dist') ? true : true)
    }
  }
})

// Mock node:fs/promises readdir to simulate output in publishDir
vi.mock('node:fs/promises', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    readdir: vi.fn(async (_p: string) => ['index.html'])
  }
})

// Mock process runner: build succeeds
vi.mock('../utils/process', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    proc: {
      ...real.proc,
      run: vi.fn(async (args: { cmd: string }) => {
        if (args.cmd === 'astro build') {
          return { ok: true, exitCode: 0, stdout: 'built', stderr: '' }
        }
        // No Netlify deploy is executed in start wizard for netlify (prepare-only)
        return { ok: true, exitCode: 0, stdout: '', stderr: '' }
      })
    }
  }
})

beforeEach(() => { logs.length = 0; vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { logs.push(String(args[0] ?? '')); return undefined as any }) })
afterEach(() => { (console.log as any) = origLog; vi.clearAllMocks() })

describe('start preflight (vercel)', () => {
  it('runs build preflight and validates publishDir output', async () => {
    await runStartWizard({ framework: 'astro', provider: 'vercel', env: 'preview', json: false, ci: false, syncEnv: false })
    const found = logs.find((l) => l.includes('Build validated'))
    expect(found).toBeTruthy()
  })

  it('emits provider in dry-run summary JSON', async () => {
    await runStartWizard({ env: 'preview', dryRun: true, json: true, ci: true })
    const line = logs.find((l) => l.includes('"final": true')) ?? '{}'
    const obj = JSON.parse(line)
    expect(['vercel']).toContain(obj.provider)
  })
})

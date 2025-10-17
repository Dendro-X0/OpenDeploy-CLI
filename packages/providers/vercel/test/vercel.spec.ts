/**
 * Provider tests for @opendeploy/provider-vercel
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, mkdir, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Avoid resolving real @opendeploy/core NodeProcessRunner at runtime
vi.mock('@opendeploy/core', () => ({
  NodeProcessRunner: class {}
}))

import { VercelProvider } from '../src/index'

/** Minimal shape compatible with ProcessRunner. */
interface TestProcessRunner {
  exec(bin: string, args: readonly string[], opts?: { readonly cwd?: string; readonly timeoutMs?: number }): Promise<{ ok: boolean; code: number | null; stdout: string; stderr: string }>
  spawn?: unknown
  resolve?: (bin: string, opts?: { cwd?: string }) => Promise<string | undefined>
}

/** In-memory stubbed runner with programmable results. */
class FakeRunner implements TestProcessRunner {
  public readonly calls: Array<{ readonly bin: string; readonly args: string[]; readonly cwd?: string }> = []
  private readonly handlers: Array<(bin: string, args: readonly string[], cwd?: string) => { ok: boolean; stdout?: string; stderr?: string }> = []

  add(handler: (bin: string, args: readonly string[], cwd?: string) => { ok: boolean; stdout?: string; stderr?: string }): void {
    this.handlers.push(handler)
  }

  async exec(bin: string, args: readonly string[], opts?: { readonly cwd?: string }): Promise<{ ok: boolean; code: number | null; stdout: string; stderr: string }>{
    this.calls.push({ bin, args: [...args], cwd: opts?.cwd })
    for (const h of this.handlers) {
      const r = h(bin, args, opts?.cwd)
      if (typeof r?.ok === 'boolean') {
        return { ok: r.ok, code: r.ok ? 0 : 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
      }
    }
    return { ok: false, code: 1, stdout: '', stderr: `unhandled exec: ${bin} ${args.join(' ')}` }
  }
}

let tmpRoot: string

beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), 'opd-vc-'))
})

afterEach(async () => {
  try { await rm(tmpRoot, { recursive: true, force: true }) } catch { /* ignore */ }
})

describe('VercelProvider.build', () => {
  it('resolves artifactDir to existing dist', async () => {
    const dist = join(tmpRoot, 'dist')
    await mkdir(dist, { recursive: true })
    const runner = new FakeRunner()
    const p = new VercelProvider(runner as unknown as any)
    const res = await p.build({ cwd: tmpRoot, noBuild: true })
    expect(res.ok).toBe(true)
    expect(res.artifactDir).toBe(dist)
  })
})

describe('VercelProvider.deploy', () => {
  it('uses --prebuilt when artifact exists and extracts url/logsUrl', async () => {
    const artifact = join(tmpRoot, 'dist')
    await mkdir(artifact, { recursive: true })
    const runner = new FakeRunner()
    // Simulate vercel deploy output containing url + inspect
    runner.add((bin, args) => bin === 'vercel' && args[0] === 'deploy' ? { ok: true, stdout: 'https://app-123.vercel.app\nInspect: https://vercel.com/acct/app/inspections/xyz' } : ({} as any))
    const p = new VercelProvider(runner as unknown as any)
    const res = await p.deploy({ cwd: tmpRoot, artifactDir: artifact, env: 'production' })
    expect(res.ok).toBe(true)
    expect(res.url?.includes('vercel.app')).toBe(true)
    expect(res.logsUrl?.includes('vercel.com')).toBe(true)
    const call = runner.calls.find(c => c.bin === 'vercel' && c.args[0] === 'deploy')
    expect(call?.args.includes('--prebuilt')).toBe(true)
  })

  it('returns ok:false and forwards message when deploy fails', async () => {
    const artifact = join(tmpRoot, 'dist')
    await mkdir(artifact, { recursive: true })
    const runner = new FakeRunner()
    runner.add((bin, args) => bin === 'vercel' && args[0] === 'deploy' ? { ok: false, stderr: 'Link your project' } : ({} as any))
    const p = new VercelProvider(runner as unknown as any)
    const res = await p.deploy({ cwd: tmpRoot, artifactDir: artifact, env: 'preview' })
    expect(res.ok).toBe(false)
    expect(res.message).toContain('Link your project')
  })
})

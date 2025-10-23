/**
 * Provider tests for @opendeploy/provider-cloudflare-pages
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Avoid resolving real @opendeploy/core NodeProcessRunner at runtime
vi.mock('@opendeploy/core', () => ({
  NodeProcessRunner: class {}
}))

import { CloudflarePagesProvider } from '../src/index'

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
  tmpRoot = await mkdtemp(join(tmpdir(), 'opd-cfp-'))
})

afterEach(async () => {
  try { await rm(tmpRoot, { recursive: true, force: true }) } catch { /* ignore */ }
})

describe('CloudflarePagesProvider.build', () => {
  it('resolves artifactDir to existing .vercel/output/static', async () => {
    const out = join(tmpRoot, '.vercel', 'output', 'static')
    await mkdir(out, { recursive: true })
    const runner = new FakeRunner()
    const p = new CloudflarePagesProvider(runner as unknown as any)
    const res = await p.build({ cwd: tmpRoot, noBuild: true })
    expect(res.ok).toBe(true)
    expect(res.artifactDir).toBe(out)
  })
})

describe('CloudflarePagesProvider.deploy', () => {
  it('uses wrangler pages deploy and honors wrangler.toml name', async () => {
    const artifact = join(tmpRoot, '.vercel', 'output', 'static')
    await mkdir(artifact, { recursive: true })
    await writeFile(join(tmpRoot, 'wrangler.toml'), 'name = "my-docs"\n', 'utf8')
    const runner = new FakeRunner()
    runner.add((bin, args) => bin === 'wrangler' && args[0] === 'pages' && args[1] === 'deploy' && args[2] === artifact && args.includes('--project-name') && args.includes('my-docs') ? { ok: true } : ({} as any))
    const p = new CloudflarePagesProvider(runner as unknown as any)
    const res = await p.deploy({ cwd: tmpRoot, artifactDir: artifact, env: 'production' })
    expect(res.ok).toBe(true)
    expect(res.url).toBe('https://my-docs.pages.dev')
  })

  it('infers project slug from cwd when wrangler.toml is missing', async () => {
    const artifact = join(tmpRoot, 'dist')
    await mkdir(artifact, { recursive: true })
    const runner = new FakeRunner()
    runner.add((bin, args) => bin === 'wrangler' && args[0] === 'pages' && args[1] === 'deploy' && args[2] === artifact && args.includes('--project-name') ? { ok: true } : ({} as any))
    const p = new CloudflarePagesProvider(runner as unknown as any)
    const res = await p.deploy({ cwd: tmpRoot, artifactDir: artifact, env: 'production' })
    // Slug is derived from tmpRoot base; just assert endsWith
    expect(res.ok).toBe(true)
    expect(res.url?.endsWith('.pages.dev')).toBe(true)
  })

  it('returns ok:false and forwards message when wrangler deploy fails', async () => {
    const artifact = join(tmpRoot, 'dist')
    await mkdir(artifact, { recursive: true })
    const runner = new FakeRunner()
    runner.add((bin, args) => bin === 'wrangler' && args[0] === 'pages' ? { ok: false, stderr: 'API token invalid' } : ({} as any))
    const p = new CloudflarePagesProvider(runner as unknown as any)
    const res = await p.deploy({ cwd: tmpRoot, artifactDir: artifact, env: 'production' })
    expect(res.ok).toBe(false)
    expect(res.message).toContain('API token invalid')
  })
})

describe('CloudflarePagesProvider.generateConfig', () => {
  it('writes wrangler.toml with Next on Pages defaults', async () => {
    const runner = new FakeRunner()
    const p = new CloudflarePagesProvider(runner as unknown as any)
    const path = await p.generateConfig({ detection: {}, cwd: tmpRoot, overwrite: true })
    const s = await stat(path)
    expect(s.isFile()).toBe(true)
  })
})

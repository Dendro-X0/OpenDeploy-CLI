/**
 * Provider tests for @opendeploy/provider-github-pages
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Avoid resolving real @opendeploy/core NodeProcessRunner at runtime
vi.mock('@opendeploy/core', () => ({
  NodeProcessRunner: class {}
}))

import { GithubPagesProvider } from '../src/index'

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
  tmpRoot = await mkdtemp(join(tmpdir(), 'opd-ghp-'))
})

afterEach(async () => {
  try { await rm(tmpRoot, { recursive: true, force: true }) } catch { /* ignore */ }
})

describe('GithubPagesProvider.build', () => {
  it('resolves artifactDir to existing dist', async () => {
    const dist = join(tmpRoot, 'dist')
    await mkdir(dist, { recursive: true })
    const runner = new FakeRunner()
    const p = new GithubPagesProvider(runner as unknown as any)
    const res = await p.build({ cwd: tmpRoot, noBuild: true })
    expect(res.ok).toBe(true)
    expect(res.artifactDir).toBe(dist)
  })
})

describe('GithubPagesProvider.deploy', () => {
  it('falls back to npx gh-pages and infers URL from git remote; writes .nojekyll', async () => {
    const artifact = join(tmpRoot, 'dist')
    await mkdir(artifact, { recursive: true })
    const runner = new FakeRunner()
    // Simulate direct gh-pages not available
    runner.add((bin, args) => bin === 'gh-pages' && args[0] === '--help' ? { ok: false } : ({} as any))
    // npx -y gh-pages --help works
    runner.add((bin, args) => bin === 'npx' && args.join(' ') === '-y gh-pages --help' ? { ok: true } : ({} as any))
    // actual deploy call
    runner.add((bin, args) => bin === 'npx' && args[0] === '-y' && args[1] === 'gh-pages' && args.includes('-d') && args.includes(artifact) ? { ok: true } : ({} as any))
    // git remote get-url origin
    runner.add((bin, args) => bin === 'git' && args[0] === 'remote' && args[1] === 'get-url' && args[2] === 'origin' ? { ok: true, stdout: 'https://github.com/owner/repo.git' } : ({} as any))

    const p = new GithubPagesProvider(runner as unknown as any)
    const res = await p.deploy({ cwd: tmpRoot, artifactDir: artifact, env: 'production' })
    expect(res.ok).toBe(true)
    expect(res.url).toBe('https://owner.github.io/repo/')
    // .nojekyll should exist
    const marker = join(artifact, '.nojekyll')
    const s = await stat(marker)
    expect(s.isFile()).toBe(true)
  })

  it('prefers direct gh-pages when available', async () => {
    const artifact = join(tmpRoot, 'dist')
    await mkdir(artifact, { recursive: true })
    const runner = new FakeRunner()
    runner.add((bin, args) => bin === 'gh-pages' && args[0] === '--help' ? { ok: true } : ({} as any))
    runner.add((bin, args) => bin === 'gh-pages' && args.includes('-d') && args.includes(artifact) ? { ok: true } : ({} as any))
    runner.add((bin, args) => bin === 'git' && args[0] === 'remote' ? { ok: true, stdout: 'git@github.com:owner/repo.git' } : ({} as any))

    const p = new GithubPagesProvider(runner as unknown as any)
    const res = await p.deploy({ cwd: tmpRoot, artifactDir: artifact, env: 'production' })
    expect(res.ok).toBe(true)
    // ensure we used direct gh-pages for the deploy call
    const deployCall = runner.calls.find(c => c.args.includes('-d') && c.args.includes(artifact))
    expect(deployCall?.bin).toBe('gh-pages')
  })
})

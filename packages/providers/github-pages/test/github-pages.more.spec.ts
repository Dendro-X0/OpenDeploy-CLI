import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GithubPagesProvider } from '../src/index'

interface TestProcessRunner {
  exec(bin: string, args: readonly string[], opts?: { readonly cwd?: string; readonly timeoutMs?: number }): Promise<{ ok: boolean; code: number | null; stdout: string; stderr: string }>
}

class FakeRunner implements TestProcessRunner {
  public readonly calls: Array<{ readonly bin: string; readonly args: string[]; readonly cwd?: string }> = []
  private readonly handlers: Array<(bin: string, args: readonly string[], cwd?: string) => { ok: boolean; stdout?: string; stderr?: string }> = []
  add(handler: (bin: string, args: readonly string[], cwd?: string) => { ok: boolean; stdout?: string; stderr?: string }): void { this.handlers.push(handler) }
  async exec(bin: string, args: readonly string[], opts?: { readonly cwd?: string }): Promise<{ ok: boolean; code: number | null; stdout: string; stderr: string }>{
    this.calls.push({ bin, args: [...args], cwd: opts?.cwd })
    for (const h of this.handlers) {
      const r = h(bin, args, opts?.cwd)
      if (typeof r?.ok === 'boolean') return { ok: r.ok, code: r.ok ? 0 : 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
    }
    return { ok: false, code: 1, stdout: '', stderr: `unhandled exec: ${bin} ${args.join(' ')}` }
  }
}

let cwd: string
beforeEach(async () => { cwd = await mkdtemp(join(tmpdir(), 'opd-ghp-')) })
afterEach(async () => { try { await rm(cwd, { recursive: true, force: true }) } catch {} })

describe('GithubPagesProvider.build with publishDirHint', () => {
  it('returns hint path even if directory does not exist', async () => {
    const p = new GithubPagesProvider(new FakeRunner() as unknown as any)
    const res = await p.build({ cwd, publishDirHint: 'custom-dist', noBuild: true })
    expect(res.ok).toBe(true)
    expect(res.artifactDir).toBe(join(cwd, 'custom-dist'))
  })
})

describe('GithubPagesProvider.build artifact precedence', () => {
  it('prefers dist > build > out > public when multiple exist', async () => {
    const p = new GithubPagesProvider(new FakeRunner() as unknown as any)
    // Create build and public first
    await (await import('node:fs/promises')).mkdir(join(cwd, 'build'), { recursive: true })
    await (await import('node:fs/promises')).mkdir(join(cwd, 'public'), { recursive: true })
    let r = await p.build({ cwd, noBuild: true })
    expect(r.ok).toBe(true)
    expect(r.artifactDir).toBe(join(cwd, 'build'))
    // Now add dist and ensure it takes precedence
    await (await import('node:fs/promises')).mkdir(join(cwd, 'dist'), { recursive: true })
    r = await p.build({ cwd, noBuild: true })
    expect(r.ok).toBe(true)
    expect(r.artifactDir).toBe(join(cwd, 'dist'))
  })
})

describe('GithubPagesProvider.deploy failures and url inference', () => {
  it('returns ok:false and forwards message when gh-pages fails', async () => {
    const r = new FakeRunner()
    // Try direct gh-pages first (ok, so we will attempt deploy via gh-pages)
    r.add((bin, args) => bin === 'gh-pages' && args[0] === '--help' ? { ok: true } : ({} as any))
    // Simulate deploy call failing
    r.add((bin, args) => bin === 'gh-pages' && args.includes('-d') ? { ok: false, stderr: 'boom' } : ({} as any))
    const p = new GithubPagesProvider(r as unknown as any)
    const res = await p.deploy({ cwd, artifactDir: join(cwd, 'dist'), env: 'production' })
    expect(res.ok).toBe(false)
    expect(res.message).toContain('boom')
  })

  it('succeeds without URL if git remote is unavailable', async () => {
    const r = new FakeRunner()
    // Direct gh-pages available and deploy ok
    r.add((bin, args) => bin === 'gh-pages' && args[0] === '--help' ? { ok: true } : ({} as any))
    r.add((bin, args) => bin === 'gh-pages' && args.includes('-d') ? { ok: true } : ({} as any))
    // No handler for git means parse will fail; provider should still return ok
    const p = new GithubPagesProvider(r as unknown as any)
    const res = await p.deploy({ cwd, artifactDir: join(cwd, 'dist'), env: 'production' })
    expect(res.ok).toBe(true)
    expect(res.url).toBeUndefined()
  })
})

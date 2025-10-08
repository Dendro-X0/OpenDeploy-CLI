import { describe, it, expect } from 'vitest'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

function runCli(args: readonly string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const exe = process.platform === 'win32' ? 'node.exe' : 'node'
    const entry = join(process.cwd(), 'dist', 'index.js')
    if (!existsSync(entry)) {
      // Skip if not built
      return resolve({ stdout: '', stderr: 'dist/index.js missing; build first', code: 0 })
    }
    // Prefer virtual provider for hermetic CLI smoke unless explicitly disabled
    if (!process.env.OPD_PROVIDER_MODE) process.env.OPD_PROVIDER_MODE = 'virtual'
    const child = execFile(exe, [entry, ...args], { cwd, env: process.env as any }, (err, stdout, stderr) => {
      let code = 0
      if (err) {
        const ec: unknown = (err as any).code
        if (typeof ec === 'number' && Number.isFinite(ec)) code = ec
        else if (typeof ec === 'string' && /^\d+$/.test(ec)) code = Number(ec)
        else code = 1
      }
      resolve({ stdout: String(stdout), stderr: String(stderr), code })
    })
    child.on('error', () => resolve({ stdout: '', stderr: 'spawn error', code: 1 }))
  })
}

function parseJsonLines(text: string): unknown[] {
  const out: unknown[] = []
  const lines = text.split(/\r?\n/)
  for (const ln of lines) {
    const s = ln.trim()
    if (!s) continue
    try { out.push(JSON.parse(s)) } catch { /* ignore non-JSON lines */ }
  }
  return out
}

// Use repository root as a safe cwd for dry-run CLI smoke tests
const PROJECT1 = process.cwd()

const SKIP_IN_CI = process.env.CI === '1'

(SKIP_IN_CI ? describe.skip : describe)('CLI smoke', () => {
  it('up vercel dry-run NDJSON emits final summary', async () => {
    const res = await runCli(['up', 'vercel', '--env', 'preview', '--ndjson', '--dry-run'], PROJECT1)
    expect(res.code).toBe(0)
    const objs = parseJsonLines(res.stdout)
    const final = objs.find((o) => typeof o === 'object' && o !== null && (o as any).final === true) as any
    expect(final).toBeTruthy()
    expect(final.action).toBe('up')
    expect(final.provider).toBe('vercel')
    expect(final.target).toBe('preview')
  })

  it('promote vercel dry-run with --from url emits cmdPlan and alias', async () => {
    const res = await runCli(['promote', 'vercel', '--alias', 'example.com', '--from', 'https://preview.vercel.app', '--dry-run', '--json'], PROJECT1)
    expect(res.code).toBe(0)
    const objs = parseJsonLines(res.stdout)
    const obj = objs.find((o) => typeof o === 'object' && o !== null && (o as any).final === true) as any
    expect(obj).toBeTruthy()
    expect(obj.provider).toBe('vercel')
    expect(Array.isArray(obj.cmdPlan)).toBe(true)
    expect(obj.alias).toBe('https://example.com')
  }, 20000)

  it('rollback vercel dry-run with --to ref reflects in cmdPlan', async () => {
    const res = await runCli(['rollback', 'vercel', '--alias', 'example.com', '--to', 'abc123', '--dry-run', '--json'], PROJECT1)
    expect(res.code).toBe(0)
    const objs = parseJsonLines(res.stdout)
    const obj = objs.find((o) => typeof o === 'object' && o !== null && (o as any).final === true) as any
    expect(obj).toBeTruthy()
    expect(obj.provider).toBe('vercel')
    const plan: string[] = obj.cmdPlan
    expect(plan.some((l: string) => l.includes('vercel alias set abc123 example.com'))).toBe(true)
  }, 20000)
})

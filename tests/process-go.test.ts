import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { goSpawnStream } from '../src/utils/process-go'

function ensureString(v: unknown): v is string { return typeof v === 'string' && v.length >= 0 }

describe('go sidecar shim', () => {
  it('streams events and resolves done via fake sidecar', async () => {
    const fakeBin: string = join(process.cwd(), 'scripts', 'fake-opd-go.mjs')
    process.env.OPD_GO_BIN = fakeBin
    const stdout: string[] = []
    const stderr: string[] = []
    const ctrl = goSpawnStream({
      cmd: 'node -v',
      cwd: process.cwd(),
      onStdout: (d: string): void => { if (ensureString(d)) stdout.push(d) },
      onStderr: (d: string): void => { if (ensureString(d)) stderr.push(d) },
    })
    const res = await ctrl.done
    expect(res.ok).toBe(true)
    expect(typeof res.exitCode).toBe('number')
    expect(res.exitCode).toBe(0)
    expect(stdout.join('')).toContain('fake: start node -v')
  }, 10000)
})

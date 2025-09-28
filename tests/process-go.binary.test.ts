import { describe, it, expect } from 'vitest'
import { goSpawnStream } from '../src/utils/process-go'

const hasBin: boolean = typeof process.env.OPD_GO_BIN === 'string' && process.env.OPD_GO_BIN.length > 0

describe('go sidecar binary', () => {
  (hasBin ? it : it.skip)('runs node -v through real sidecar', async () => {
    const out: string[] = []
    const err: string[] = []
    const ctrl = goSpawnStream({
      cmd: 'node -v',
      cwd: process.cwd(),
      onStdout: (d: string): void => { out.push(d) },
      onStderr: (d: string): void => { err.push(d) }
    })
    const res = await ctrl.done
    expect(res.ok).toBe(true)
    expect(res.exitCode).toBe(0)
    expect(out.join('')).toMatch(/v\d+\.\d+\.\d+/)
  }, 10000)
})

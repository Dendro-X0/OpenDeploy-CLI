import { describe, it, expect } from 'vitest'
import { NodeProcessRunner } from '../src/process/runner.ts'

const nodeBin = process.execPath

describe('NodeProcessRunner.exec redaction', () => {
  it('redacts sensitive tokens in stdout and stderr via redactors option', async () => {
    const r = new NodeProcessRunner()
    const secret = 'ABC123SECRET'
    const script = 'console.log("token:' + secret + '"); console.error("ERR:' + secret + '")'
    const res = await r.exec(nodeBin, ['-e', script], { timeoutMs: 1000, redactors: [new RegExp(secret, 'g')] })
    expect(res.ok).toBe(true)
    expect(res.stdout).not.toContain(secret)
    expect(res.stderr).not.toContain(secret)
    expect(res.stdout).toContain('token:***')
    expect(res.stderr).toContain('ERR:***')
  })
})

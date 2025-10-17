import { describe, it, expect } from 'vitest'
import { NodeProcessRunner } from '../src/process/runner.ts'

const nodeBin = process.execPath

describe('NodeProcessRunner.exec', () => {
  it('runs a simple program and captures stdout', async () => {
    const r = new NodeProcessRunner()
    const res = await r.exec(nodeBin, ['-e', 'process.stdout.write("ok")'], { timeoutMs: 2000 })
    expect(res.ok).toBe(true)
    expect(res.stdout).toBe('ok')
  })

  it('times out long-running process', async () => {
    const r = new NodeProcessRunner()
    const res = await r.exec(nodeBin, ['-e', 'setTimeout(()=>{}, 2000)'], { timeoutMs: 100 })
    expect(res.ok).toBe(false)
  })
})

describe('NodeProcessRunner.spawn', () => {
  it('enforces idle timeout', async () => {
    const r = new NodeProcessRunner()
    const ctl = r.spawn(nodeBin, ['-e', 'console.log("tick"); setTimeout(()=>console.log("late"), 1000)'], { idleTimeoutMs: 200 })
    const res = await ctl.done
    expect(res.ok).toBe(false)
  })

  it('cancels a running process', async () => {
    const r = new NodeProcessRunner()
    const ctl = r.spawn(nodeBin, ['-e', 'setTimeout(()=>{}, 5000)'])
    setTimeout(() => ctl.cancel('test'), 100)
    const res = await ctl.done
    expect(res.ok).toBe(false)
    expect(res.stderr).toContain('cancelled: test')
  })
})

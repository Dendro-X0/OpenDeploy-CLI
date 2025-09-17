import { describe, it, expect, vi } from 'vitest'
import * as link from '../providers/vercel/link'
import * as processUtil from '../utils/process'

// We'll spy on proc.run to ensure vercel link flags are passed.

describe('ensureLinked', () => {
  it('passes project and org flags when provided', async () => {
    const spy = vi.spyOn(processUtil.proc, 'run').mockResolvedValue({ ok: true, exitCode: 0, stdout: 'already linked', stderr: '' })
    await link.ensureLinked({ cwd: 'x', projectId: 'P', orgId: 'O' })
    const call = spy.mock.calls[0]?.[0]
    expect(call?.cmd).toContain('vercel link')
    expect(call?.cmd).toContain('--project P')
    expect(call?.cmd).toContain('--org O')
    spy.mockRestore()
  })

  it('succeeds when already linked', async () => {
    const spy = vi.spyOn(processUtil.proc, 'run').mockResolvedValue({ ok: false, exitCode: 1, stdout: 'Already linked', stderr: '' })
    await expect(link.ensureLinked({ cwd: 'x' })).resolves.toBeUndefined()
    spy.mockRestore()
  })
})

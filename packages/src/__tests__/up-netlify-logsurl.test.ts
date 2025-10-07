import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'
import { registerUpCommand } from '../commands/up'
import { logger } from '../utils/logger'
// Helpers are imported lazily inside vi.mock factories to avoid hoist issues

const calls: string[] = []
let logSpy: ReturnType<typeof vi.spyOn>

// Avoid env sync side effects and adapter writes (use lazy import in factory)
vi.mock('../commands/env', async () => {
  const h = await import('../../tests/helpers/mocks')
  return h.envNoopMock()
})

// Ensure netlify process calls are mocked deterministically
vi.mock('../utils/process', async (orig) => {
  const real = await orig<any>()
  const h = await import('../../tests/helpers/mocks')
  return h.makeProcessMockNetlify(real, { deployUrl: 'https://sveltekit-mini-015941.netlify.app', siteName: 'sveltekit-mini-015941', deployId: 'dep_abc' })
})

// (duplicate utils/process mock removed)

describe('up netlify emits logsUrl in JSON', () => {
  beforeEach(() => { calls.length = 0; logSpy = vi.spyOn(logger, 'jsonPrint').mockImplementation(() => { /* swallow */ }) })
  afterEach(() => { logSpy.mockRestore() })
  it('includes logsUrl in summary', async () => {
    const program = new Command()
    registerUpCommand(program)
    await program.parseAsync(['node','test','up','netlify','--env','prod','--project','site_123','--json'])
    const last = (logSpy.mock.calls.at(-1)?.[0] ?? {}) as any
    expect(last.provider).toBe('netlify')
    expect(last.target).toBe('prod')
    expect(last.url).toContain('netlify.app')
    expect(last.logsUrl).toContain('app.netlify.com/sites/sveltekit-mini-015941/deploys/dep_abc')
  })
})

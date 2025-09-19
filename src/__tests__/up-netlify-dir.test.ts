import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

const logs: string[] = []
const origLog = console.log

// Avoid env sync side effects and adapter writes
vi.mock('../commands/env', async () => {
  const h = await import('../../tests/helpers/mocks')
  return h.envNoopMock()
})

vi.mock('../providers/netlify/adapter', async () => {
  const h = await import('../../tests/helpers/mocks')
  return h.netlifyAdapterNoopMock()
})

// We rely on --dry-run, so no need to mock process deploy calls here
vi.mock('../core/detectors/auto', async () => {
  const h = await import('../../tests/helpers/mocks')
  return h.detectorMockRemixBuildClient()
})

// (removed duplicate process mock)

import { registerUpCommand } from '../commands/up'

beforeEach(() => { logs.length = 0; vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { logs.push(String(args[0] ?? '')); return undefined as any }) })
afterEach(() => { (console.log as any) = origLog; vi.clearAllMocks() })

describe('up netlify --dir inference', () => {
  it('passes --dir from detection.publishDir to netlify deploy', async () => {
    const program = new Command()
    registerUpCommand(program)
    await program.parseAsync(['node', 'test', 'up', 'netlify', '--env', 'preview', '--json', '--project', 'site_123', '--dry-run'])
    const line = logs.find((l) => l.includes('"final": true')) ?? '{}'
    const obj = JSON.parse(line)
    expect(obj).toMatchObject({ provider: 'netlify', target: 'preview', final: true })
    const cmd = String((obj.cmdPlan?.[0]) ?? '')
    expect(cmd).toContain('--dir build/client')
  })
})

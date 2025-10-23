import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { runStartWizard } from '../commands/start'

// Capture console output (NDJSON lines emitted by logger.json)
const lines: string[] = []
const origLog = console.log

beforeEach(() => { lines.length = 0; /* eslint-disable no-console */ (console.log as any) = ((...args: unknown[]) => { lines.push(String(args[0] ?? '')); return undefined as any }) as any })
afterEach(() => { /* eslint-disable no-console */ (console.log as any) = origLog })

describe('NDJSON schema stability', () => {
  it('emits required fields for provider deploy summary and never leaks raw secrets', async () => {
    const prevNd = process.env.OPD_NDJSON
    process.env.OPD_NDJSON = '1'
    try {
      // Dry run start wizard to emit NDJSON summary objects
      await runStartWizard({ framework: 'next', provider: 'vercel', env: 'preview', dryRun: true, ci: true, json: false, syncEnv: false })
      const objects = lines.filter((l) => l.trim().startsWith('{')).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean) as Array<Record<string, unknown>>
      // Pick last summary entry
      const last = objects[objects.length - 1] as Record<string, unknown>
      expect(typeof last).toBe('object')
      // Required keys in final summaries
      expect(last.final === true || last.event === 'done').toBeTruthy()
      // Ensure url/logsUrl keys when present have string values
      if (last.url !== undefined) expect(typeof last.url).toBe('string')
      if (last.logsUrl !== undefined) expect(typeof last.logsUrl).toBe('string')
      // No obvious raw secret literals (best-effort guard)
      const joined = lines.join('\n')
      expect(joined.includes('SECRET_')).toBe(false)
    } finally {
      if (prevNd === undefined) delete process.env.OPD_NDJSON; else process.env.OPD_NDJSON = prevNd
    }
  })
})

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { logger } from '../utils/logger'
import { tmpdir } from 'node:os'
import { readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'

const SECRET = 'secret123'

let origLog: typeof console.log
let origError: typeof console.error

function resetLogger(): void {
  logger.setJsonOnly(false)
  logger.setNoEmoji(true)
  logger.setLevel('info' as any)
  logger.setTimestamps(false)
  logger.setSummaryOnly(false)
  logger.setNdjson(false)
  logger.setJsonCompact(false)
  logger.setRedactors([])
}

describe('logger redaction vs JSON', () => {
  beforeEach(() => {
    origLog = console.log
    origError = console.error
    resetLogger()
  })
  afterEach(() => {
    console.log = origLog
    console.error = origError
    resetLogger()
  })

  it('redacts secrets in human logs', () => {
    const lines: string[] = []
    console.log = ((...args: unknown[]) => { lines.push(String(args[0])) }) as any
    logger.setRedactors([SECRET])
    logger.info(`Value=${SECRET}`)
    expect(lines.join('\n')).not.toContain(SECRET)
    expect(lines.join('\n')).toContain('******')
  })

  it('redacts JSON console output', () => {
    const lines: string[] = []
    console.log = ((...args: unknown[]) => { lines.push(String(args[0])) }) as any
    logger.setRedactors([SECRET])
    logger.json({ token: SECRET })
    const out = lines.join('\n')
    expect(out).not.toContain(SECRET)
    expect(out).toContain('******')
  })

  it('redacts NDJSON file sink', async () => {
    const lines: string[] = []
    console.log = ((...args: unknown[]) => { lines.push(String(args[0])) }) as any
    const p = join(tmpdir(), `opendeploy-test-${Date.now()}.ndjson`)
    try {
      logger.setRedactors([SECRET])
      logger.setNdjson(true)
      logger.setNdjsonFile(p)
      logger.json({ token: SECRET, final: true })
      // wait for async file sink
      await waitForFile(p)
      const content = await readFile(p, 'utf8')
      expect(content).not.toContain(SECRET)
      expect(content).toContain('******')
    } finally {
      await rm(p, { force: true })
      logger.setNdjson(false)
      logger.setNdjsonFile('')
    }
  })

  it('redacts JSON file sink', async () => {
    const p = join(tmpdir(), `opendeploy-test-${Date.now()}.json`)
    try {
      logger.setRedactors([SECRET])
      logger.setJsonFile(p)
      logger.json({ token: SECRET, final: true })
      await waitForFile(p)
      const content = await readFile(p, 'utf8')
      expect(content).not.toContain(SECRET)
      expect(content).toContain('******')
    } finally {
      await rm(p, { force: true })
      logger.setJsonFile('')
    }
  })

async function waitForFile(path: string, tries = 10, delayMs = 50): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try { await stat(path); return } catch { /* ignore */ }
    await new Promise(r => setTimeout(r, delayMs))
  }
}
})

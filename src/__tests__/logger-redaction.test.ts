import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { logger } from '../utils/logger'

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

  it('does not redact JSON output', () => {
    const lines: string[] = []
    console.log = ((...args: unknown[]) => { lines.push(String(args[0])) }) as any
    // Emit JSON directly
    logger.json({ token: SECRET })
    const out = lines.join('\n')
    expect(out).toContain(SECRET)
  })
})

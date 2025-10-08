import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from '../utils/logger'
import { setColorMode } from '../utils/colors'

/**
 * Ensure colored/emoji output can be toggled and is ANSI-safe.
 */
describe('logger colors and icons', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    errSpy.mockRestore()
  })

  it('prints green success with emoji when enabled', () => {
    setColorMode('always')
    logger.setNoEmoji(false)
    logger.success('All good')
    const out = (logSpy.mock.calls[0]?.[0] as string) || ''
    expect(out).toContain('\u001b[') // ANSI present
    expect(out).toContain('✓')        // emoji present
  })

  it('prints ASCII ok when --no-emoji', () => {
    setColorMode('always')
    logger.setNoEmoji(true)
    logger.success('All good')
    const out = (logSpy.mock.calls[0]?.[0] as string) || ''
    expect(out).toContain('\u001b[') // still colored
    expect(out).toContain('[ok]')     // ascii instead of emoji
    expect(out).not.toContain('✓')
  })

  it('suppresses ANSI when color mode is never', () => {
    setColorMode('never')
    logger.setNoEmoji(false)
    logger.error('Boom')
    const out = (errSpy.mock.calls[0]?.[0] as string) || ''
    expect(out).not.toContain('\u001b[')
  })
})

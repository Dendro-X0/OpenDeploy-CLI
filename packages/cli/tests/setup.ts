import { afterEach, beforeEach, vi } from 'vitest'

// If replay fixtures are provided, force deterministic test environment
(() => {
  // Auto-detect default replay file when not explicitly set
  if (!process.env.OPD_REPLAY_FIXTURES) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('node:fs') as typeof import('node:fs')
      if (fs.existsSync('./.artifacts/proc.ndjson')) {
        process.env.OPD_REPLAY_FIXTURES = './.artifacts/proc.ndjson'
      }
    } catch { /* ignore */ }
  }
  const hasReplay: boolean = typeof process.env.OPD_REPLAY_FIXTURES === 'string' && process.env.OPD_REPLAY_FIXTURES.length > 0
  if (hasReplay) {
    process.env.OPD_TEST_NO_SPAWN = '0' // ensure provider code paths run; replay will intercept proc
    process.env.OPD_FORCE_CI = '1' // normalize provider CLI behavior
    process.env.FORCE_COLOR = '0'
    process.env.TERM = process.env.TERM ?? 'dumb'
    process.env.TZ = process.env.TZ ?? 'UTC'
    process.env.LC_ALL = process.env.LC_ALL ?? 'C'
  }
})()

// Silence noisy console output during tests unless explicitly asserted
beforeEach(() => {
  // You can selectively stub console methods as needed. Keep info; silence debug.
  vi.spyOn(console, 'debug').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

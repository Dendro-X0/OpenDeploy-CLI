import { afterEach, beforeEach, vi } from 'vitest'

// Silence noisy console output during tests unless explicitly asserted
beforeEach(() => {
  // You can selectively stub console methods as needed. Keep info; silence debug.
  vi.spyOn(console, 'debug').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

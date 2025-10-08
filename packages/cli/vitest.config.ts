import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 20000,
    hookTimeout: 20000,
    setupFiles: ['tests/setup.ts'],
    env: {
      // Force deterministic deploy path in providers during CI tests.
      // Allow developers to override locally by exporting OPD_TEST_NO_SPAWN.
      OPD_TEST_NO_SPAWN: process.env.OPD_TEST_NO_SPAWN ?? '1'
    }
    // Keep default threads/isolation; adjust if needed for CI
  },
})

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 20000,
    hookTimeout: 20000,
    setupFiles: ['tests/setup.ts'],
    // Keep default threads/isolation; adjust if needed for CI
  },
})

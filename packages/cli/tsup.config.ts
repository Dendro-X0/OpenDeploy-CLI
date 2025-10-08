import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node18',
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: false,
  minify: false,
  dts: false,
  banner: { js: '#!/usr/bin/env node' }
})

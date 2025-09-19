import type { Framework } from './framework'
import type { MonorepoTool } from './monorepo-tool'
import type { PackageManager } from './package-manager'

export interface DetectionResult {
  readonly framework: Framework
  readonly rootDir: string
  readonly appDir: string
  readonly hasAppRouter: boolean
  readonly packageManager: PackageManager
  readonly monorepo: MonorepoTool
  readonly buildCommand: string
  readonly outputDir: string
  /** Directory to publish for static hosts (e.g., Netlify). Optional when SSR-by-default. */
  readonly publishDir?: string
  /** Render mode inferred from project defaults. */
  readonly renderMode: 'static' | 'ssr' | 'hybrid'
  /** Confidence score [0..1] for this detection. */
  readonly confidence: number
  readonly environmentFiles: readonly string[]
}

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
  readonly environmentFiles: readonly string[]
}

/**
 * Deploy plan types for `explain` command.
 * These are intentionally minimal and provider-agnostic.
 */

export type DeployTarget = "preview" | "prod"

export interface DeployStep {
  readonly id: string
  readonly title: string
  readonly kind: "detect" | "link" | "env" | "deploy" | "post"
  readonly estimatedMs?: number
}

export interface EnvSummary {
  readonly plannedSync: boolean
  readonly file?: string
  readonly strictGuards: readonly string[]
}

export interface DeployPlan {
  readonly provider: "vercel" | "netlify"
  readonly target: DeployTarget
  readonly cwd: string
  readonly steps: readonly DeployStep[]
  readonly envSummary: EnvSummary
}

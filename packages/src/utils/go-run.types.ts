export interface GoRunStreamArgs {
  readonly cmd: string
  readonly cwd?: string
  readonly env?: Readonly<Record<string, string>>
  readonly onStdout?: (chunk: string) => void
  readonly onStderr?: (chunk: string) => void
  readonly timeoutSeconds?: number
  readonly idleTimeoutSeconds?: number
}

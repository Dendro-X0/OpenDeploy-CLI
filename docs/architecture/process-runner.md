# ProcessRunner Design (Phase 2)

Goal: a single, robust cross-platform process execution layer for providers and CLI commands. Eliminates shell-string bugs, handles Windows `.cmd` shims, supports timeouts and cancellation, and yields structured output/events.

## Requirements

- Arg-array execution by default; shell only when explicitly required.
- Cross-platform binary resolution:
  - Direct command on POSIX.
  - `.cmd` shim resolution on Windows (e.g., `vercel.cmd`, `wrangler.cmd`).
  - Optional `where`/`which` probes and fallbacks (`npx`, `pnpm dlx`).
- Timeouts: whole-process timeout and idle timeout.
- Streaming callbacks for stdout/stderr with backpressure protection.
- Cancellation via AbortController.
- Redaction hooks for secrets in logs.
- Deterministic exit object `{ ok, code, stdout, stderr }` for simple calls.

## TypeScript interface (draft)

```ts
export interface ExecResult {
  readonly ok: boolean
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
}

export interface SpawnCtl {
  readonly done: Promise<ExecResult>
  cancel(reason?: string): void
}

export interface ExecOptions {
  readonly cwd?: string
  readonly env?: NodeJS.ProcessEnv
  readonly timeoutMs?: number
  readonly idleTimeoutMs?: number
  readonly redactors?: readonly RegExp[]
}

export interface SpawnOptions extends ExecOptions {
  readonly onStdout?: (chunk: string) => void
  readonly onStderr?: (chunk: string) => void
}

export interface ProcessRunner {
  exec(bin: string, args: readonly string[], opts?: ExecOptions): Promise<ExecResult>
  spawn(bin: string, args: readonly string[], opts?: SpawnOptions): SpawnCtl
  resolve(bin: string, opts?: { cwd?: string }): Promise<string | undefined>
}
```

## Resolution strategy

1) If `OPD_<BIN>_BIN` env override is set, try it first.
2) Try direct name (`bin`), then Windows `.cmd` variant.
3) On Windows, probe `where <bin>.cmd` then `where <bin>`; choose first valid path.
4) Fallbacks: `pnpm dlx <bin>`, `npx -y <bin>`; ensure we pass bin and args separately to avoid quoting problems.

## Notes

- Providers will pass `['pages','deploy',dir,'--project-name',name]` instead of an interpolated command string.
- Redactors applied to chunks in callbacks for logging safety.
- For long-running tasks, prefer `spawn()` with `done` Promise.

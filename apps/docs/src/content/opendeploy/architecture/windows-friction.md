# Windows Friction Analysis (Phase 1)

This document enumerates current Windows-specific pitfalls observed in the repo and how vNext should avoid them.

## Process & shell invocation

- Quoting/Spaces in paths
  - Risk: commands like `gh-pages -d <dir>` without quoting may fail if `dir` contains spaces.
  - vNext: always quote path args and prefer `spawn` with argument arrays instead of shell concatenation.

- Binary resolution differences
  - Some CLIs have `.cmd` shims on Windows (`vercel.cmd`, `wrangler.cmd`, `pnpm.cmd`). `doctor.ts` handles this pattern already; standardize it in a `ProcessRunner`.

- `where` vs `which`
  - Provider uses `where gh-pages(.cmd)` on Windows and `npx -y` fallback.
  - vNext: centralize resolution logic with platform-specific lookups and explicit error messages when missing.

- CRLF vs LF
  - Parsing stdout content, especially JSON lines: ensure `\r?\n` splits and trim.

## Env/Tooling

- Node/pnpm version drift
  - Root pins `pnpm@10.16.1` in `packageManager` and engine `>=18` in CLI; recommend Node 20.x in runbook.
  - vNext: add a `tools:check` script that prints versions and fails early when unsupported.

- `npx` vs `pnpm dlx`
  - Mixed usage; prefer a single consistent runner (recommend `pnpm dlx` when pnpm is present), with Windows `.cmd` handling.

## Filesystem specifics

- Case sensitivity differences
  - Avoid case-sensitive path assumptions.

- Newline and encoding in generated files
  - Ensure UTF-8 and newline normalization for generated YAML/JSON; tests should ignore newline type.

## VSCode extension packaging

- `vsce` repo-wide Git scan is slow/error-prone in a monorepo.
  - Staging packer script avoids scanning and packs only extension files — keep this pattern.

## Recommendations for vNext

- Introduce `ProcessRunner` abstraction with:
  - Cross-platform binary resolution (`.cmd` on Windows), `PATH` lookup fallbacks, and clear missing-tool errors.
  - Arg-array execution (no shell) by default; shell enabled only when necessary.
  - Timeouts, idle timeouts, and cancellation support.
- Quote all filesystem paths passed to external tools; reject invalid/nonexistent paths before invocation with actionable hints.
- Provide a single place to define external tool preferences (`npx` vs `pnpm dlx`) and surface the chosen command in verbose logs.

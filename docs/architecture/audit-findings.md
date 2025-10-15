# Audit Findings (Phase 1)

This document records issues and complexities discovered during the initial audit to inform vNext decisions.

## Structural

- __Provider sprawl__: Multiple providers at varying maturity (GitHub Pages, Cloudflare, Vercel) increase surface area before MVP.
- __Mixed provider systems__: Provider code exists under `src/core/provider-system/providers/*` (e.g., GitHub Pages) while other provider bits may live elsewhere. vNext should unify under a single `packages/providers/*` layout.
- __Extension coupling__: UI occasionally assumes provider semantics (e.g., auth toasts). vNext should keep UI provider-agnostic and bind strictly to events.

## Events & outputs

- __Inconsistent event fields__: `phase` vs `stage` vs `event`. vNext must standardize to `phase` (see `core-contract.md`).
- __Hints variability__: Strings vs objects. vNext will enforce structured `{ code, message, action? }`.
- __Final summary__: Not consistently present or complete in every command. vNext requires exactly one `final: true` summary per command with `ok` set.

## Windows/platform

- __Path quoting__: Shell string concatenation risks failure with spaces in paths (e.g., gh-pages `-d <dir>`). Prefer arg arrays and quoting.
- __Binary resolution__: Need consistent handling of `.cmd` shims (`vercel.cmd`, `wrangler.cmd`, `pnpm.cmd`). Centralize in a `ProcessRunner`.

## Packaging/tooling

- __VSCE scan__: Repo-wide scan is brittle; staging mitigates this and should be kept.
- __Toolchain drift__: Pin Node/pnpm and add a `tools:check` script to fail early.

## Documentation/onboarding

- __Quick Start gaps__: Lacked a one-page, Windows-first runbook. Added under `docs/runbooks/`.
- __Smoke tests__: Absent. Added a draft plan under `docs/runbooks/smoke-tests.md`.

## Recommended archive/defer list (candidate)

- Defer Cloudflare/Vercel providers for vNext MVP; keep code but hide from CLI help and extension UI.
- Archive binary build scripts (`pkg`) until Node-only MVP is stable on Windows.
- Park complex CI workflows not needed for MVP.

# ADR 0001 — MVP Freeze and Stabilization Plan

Status: Proposed (during project pause)
Date: 2025-10-15

## Context

The project attempted to ship a broad scope (CLI + multi-provider + VSCode extension + monorepo tooling) in parallel. Windows-specific friction, packaging complexity, and lack of a frozen, validated MVP led to instability and stalled release.

## Decision

Freeze scope for the first post-pause release (vNext MVP) to:

- Providers: GitHub Pages only (`github-pages`).
- Features: Plan, Doctor, Generate GH Pages workflow.
- Extension: Control Panel to run Plan/Doctor and generate GH Pages workflow; Summary panel; JSON toggle.
- Distribution: Node-only CLI (no binary packaging). VSIX via staged packer (no Marketplace yet).

## Rationale

- Minimizes risk and surfaces a useful, demoable workflow quickly.
- Eliminates cross-platform toolchain variance for non-MVP providers/builders.
- Establishes a stable events/summary contract before broadening scope.

## Implementation Outline

1) Core contract (`docs/architecture/core-contract.md`)
   - Provider interface in `packages/core` (new).
   - Canonical event/summary/hint types.

2) Providers
   - Extract `github-pages` from current provider code; ensure Plan/Doctor/Deploy paths use arg-array process execution and quote paths.
   - Normalize provider id to `github-pages`.

3) CLI (Node-only)
   - Wire providers through `core` interfaces.
   - Emit NDJSON events (`phase`) and a single final JSON summary per command.
   - Add `tools:check` and a Windows-first smoke test (Plan/Doctor on a tiny static sample).

4) Extension (VSIX only)
   - Bind to events/summaries only (no provider logic).
   - Keep logsUrl handling but prefer the summary’s logsUrl; scraping is fallback for older CLIs.
   - Document `stage:pack` VSIX flow and smoke test.

5) Docs
   - Windows-first Quick Start and Troubleshooting.
   - Provider docs for GitHub Pages; Cloudflare/Vercel deferred.

## Consequences

- Cloudflare and Vercel support is deferred to post-MVP.
- Binary packaging is deferred to post-MVP.
- CI workflows simplified initially; more coverage added after MVP is stable.

## Acceptance Criteria

- On a clean Windows machine:
  - `node packages/cli/dist/index.js plan github --json --path <sample>` returns `{ ok: true, final: true }`.
  - `node packages/cli/dist/index.js doctor --json --path <sample>` returns `{ ok: true, final: true }`.
  - Extension VSIX installs, Control Panel runs Plan/Doctor, renders hints, and offers a single "Open logs" link.
- Final JSON summaries include a canonical `provider` id and, when available, a `logsUrl`.

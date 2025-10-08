# OpenDeploy CLI v1.0.0 (GA)

## Highlights

- Wizard (start)
  - Vercel: end-to-end deploy in-wizard with readable logs; emits `url` and `logsUrl`.
  - Netlify: prepare-only by default; optional `--deploy` with `--no-build` to deploy prebuilt artifacts; prints recommended commands and includes `logsUrl`.
  - Deterministic JSON summaries: `action: "start"`, `mode`, `cwd`, provider specifics (`publishDir`, `recommend`, `siteId/siteName`), `ciChecklist`, and `final: true`.
  - NDJSON progress with cross-provider `event:"logs"` when a dashboard/inspect URL is available.

- Deploy & Env
  - `up` (one-command env sync + deploy) for Vercel and Netlify with NDJSON and retries/timeout knobs.
  - Env workflows: pull, diff, sync, validate with strict flags (`--fail-on-add/remove`) and profile builtins.
  - Idempotent config generation: minimal `vercel.json` / `netlify.toml` based on detection.

- CI ergonomics
  - `--gha` preset, file sinks (`--json-file`, `--ndjson-file`), timestamps, compact JSON, and GitHub annotations.
  - Stable, documented JSON/NDJSON response shapes across commands.

- Docs
  - Repository docs updated; Docs Site content aligned (Overview, Commands → start, Recipes → Wizard Quick Examples, Response Shapes).

## Known Limitations

- Remix/React Router v7 SSR requires adapters; static deploys are supported out of the box.
- Expo deploys are out-of-scope for 1.0; env workflows are supported.

## Upgrading

- No breaking flags. Replace any earlier pre-release with `v1.0.0` and consult the Docs Site for start/up usage and CI response shapes.

## Thanks

- Thanks to everyone who tested the wizard flows and CI outputs and provided feedback.

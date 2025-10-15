# Smoke Tests (Phase 1)

Status: research draft. These are minimal end-to-end checks that must pass on a clean Windows machine before resuming development.

## Test A — CLI: Plan + Doctor (static sample)

- Preconditions:
  - Node 20.x, pnpm installed.
- Steps:
  1) `pnpm -C packages/cli install`
  2) `pnpm -C packages/cli build`
  3) Create `examples/static/dist/index.html` with "hello" (or use an existing minimal artifact).
  4) From repo root:
     - `node packages/cli/dist/index.js plan github --json --path packages/cli/examples/static`
     - `node packages/cli/dist/index.js doctor --json --path packages/cli/examples/static`
- Expected:
  - Both commands exit with code 0.
  - Final JSON summary contains `{ ok: true, final: true }`.
  - Hints may be present but not fatal in non-strict mode.

## Test B — Extension: Panel Plan + Doctor (VSIX)

- Preconditions:
  - VS Code >= 1.80.
  - VSIX packaged: `pnpm -C apps/extension stage:pack`.
- Steps:
  1) Install VSIX: Extensions → … → Install from VSIX.
  2) Open repo root in VS Code.
  3) Command Palette → `OpenDeploy: Control Panel`.
  4) Select app path: `packages/cli/examples/static`.
  5) Click `Plan` and `Doctor`.
- Expected:
  - Output channel shows `[result] success` for each.
  - Panel renders top hints (if any) and offers "Open logs" link when available.

## Test C — GH Pages workflow generation

- Steps:
  1) CLI: `node packages/cli/dist/index.js generate github --json`
  2) Extension Panel: choose template and click "Generate GH Pages workflow".
- Expected:
  - Workflow YAML created under `.github/workflows/`.
  - For inline template: contains `actions/upload-pages-artifact@v3` and `actions/deploy-pages@v4`.

## Notes

- For Windows path issues, prefer paths without spaces during smoke tests.
- If git origin is not set, some GH Pages features will warn; smoke tests should not rely on remote.

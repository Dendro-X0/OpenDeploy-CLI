# VSCode Extension Runbook (Phase 1)

Status: research draft. This documents how to build, package, install, and smoke test the extension on a clean Windows machine.

## Toolchain

- Node: 20.x
- pnpm: pinned in root `package.json`
- VS Code: >= 1.80 (extension engines target)

## Build

```powershell
# From repo root
pnpm -C apps/extension install
pnpm -C apps/extension build
```

Output: `apps/extension/dist/extension.js`

## Package (local VSIX)

We avoid repo-wide `vsce` Git scanning by staging only the extension files.

```powershell
pnpm -C apps/extension stage:pack
# VSIX at: apps/extension/.stage/opendeploy-vscode.vsix
```

## Install VSIX

- In VS Code: Extensions view → … menu → "Install from VSIX…" → choose the VSIX above.
- Or CLI:

```powershell
code --install-extension "e:\\Codebase\\my-workspace\\OpenDeploy CLI\\apps\\extension\\.stage\\opendeploy-vscode.vsix"
```

If reinstalling often, bump `version` in `apps/extension/package.json` or uninstall the existing extension before installing.

## Smoke test

1) Open the repo in VS Code (or any workspace with a simple app in `apps/` or `packages/`).
2) Command Palette → `OpenDeploy: Control Panel` (or `Ctrl+Alt+U` / `Cmd+Alt+U`).
3) Pick an app (the selection is remembered per workspace).
4) Click `Plan` and `Doctor`.
5) Verify:
   - The Output Channel prints a final `[result] success|failed` line.
   - A single logs URL is printed and the notification proposes "Open logs".
   - The panel shows top 5 hints after Doctor.

## Known issues (current repo)

- Providers other than GitHub Pages may not be reliable; vNext will freeze scope.
- If no apps are detected, ensure you have an `apps/*` or `packages/*` directory with a project, or set `opendeploy.defaultPath`.
- VSIX reinstallation requires version bumps or uninstalling the previous build.

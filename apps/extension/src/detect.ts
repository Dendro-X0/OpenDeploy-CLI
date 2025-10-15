import * as vscode from 'vscode'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { getSettings, Settings } from './config'

async function dirExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

export interface ProjectCandidate { readonly label: string; readonly fsPath: string }

export async function listProjectCandidates(rootFsPath: string): Promise<ReadonlyArray<ProjectCandidate>> {
  const out: Array<{ label: string; fsPath: string }> = []
  const buckets: readonly string[] = ['apps', 'packages']
  for (const b of buckets) {
    const base = path.join(rootFsPath, b)
    if (!(await dirExists(base))) continue
    try {
      const names = await fs.readdir(base)
      for (const name of names) {
        const dir = path.join(base, name)
        const pkg = path.join(dir, 'package.json')
        if (await dirExists(pkg)) out.push({ label: `${b}/${name}`, fsPath: dir })
      }
    } catch { /* ignore */ }
  }
  return out
}

export async function pickTargetPath(settings?: Settings): Promise<string> {
  const cfg = settings ?? getSettings()
  const folders = vscode.workspace.workspaceFolders
  if (!folders || folders.length === 0) {
    throw new Error('No workspace folder is open')
  }
  const root = folders[0].uri.fsPath
  // Use configured defaultPath if present and exists
  if (cfg.defaultPath && cfg.defaultPath.trim().length > 0) {
    const abs = vscode.Uri.joinPath(folders[0].uri, cfg.defaultPath).fsPath
    if (await dirExists(abs)) return abs
  }
  // Prefer monorepo project selection when multiple candidates exist
  const candidates = await listProjectCandidates(root)
  if (candidates.length === 1) return candidates[0].fsPath
  if (candidates.length > 1) {
    const pick = await vscode.window.showQuickPick(
      candidates.map(c => ({ label: c.label, description: c.fsPath })),
      { title: 'Select app for OpenDeploy' }
    )
    if (pick && pick.description) return pick.description
  }
  // Fall back to folder selection when multiple workspace folders are open
  if (folders.length === 1) return root
  const picked = await vscode.window.showQuickPick(
    folders.map((f: vscode.WorkspaceFolder) => ({ label: f.name, description: f.uri.fsPath })),
    { title: 'Select project folder for OpenDeploy' }
  )
  if (!picked) throw new Error('No folder selected')
  return picked.description ?? root
}

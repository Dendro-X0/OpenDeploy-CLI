import * as vscode from 'vscode'

export type Runner = 'npm' | 'docker'

export interface Settings {
  readonly runner: Runner
  readonly npmBinary: string
  readonly dockerImage: string
  readonly defaultPath: string
  readonly preferJson: boolean
}

export function getSettings(): Settings {
  const cfg = vscode.workspace.getConfiguration('opendeploy')
  const runner = (cfg.get<string>('runner', 'npm') === 'docker') ? 'docker' : 'npm'
  const npmBinary = cfg.get<string>('npmBinary', 'npx opendeploy@latest')
  const dockerImage = cfg.get<string>('dockerImage', 'ghcr.io/dendro-x0/opd:latest')
  const defaultPath = cfg.get<string>('defaultPath', '')
  const preferJson = cfg.get<boolean>('preferJson', true)
  return { runner, npmBinary, dockerImage, defaultPath, preferJson }
}

export async function togglePreferJson(): Promise<boolean> {
  const cfg = vscode.workspace.getConfiguration('opendeploy')
  const current = cfg.get<boolean>('preferJson', true)
  const next = !current
  await cfg.update('preferJson', next, vscode.ConfigurationTarget.Global)
  return next
}

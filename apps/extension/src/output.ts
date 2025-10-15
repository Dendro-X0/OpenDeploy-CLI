import * as vscode from 'vscode'

let chan: vscode.OutputChannel | undefined

export function getOutput(): vscode.OutputChannel {
  if (!chan) chan = vscode.window.createOutputChannel('OpenDeploy')
  return chan
}

export function printStatus(text: string): void {
  const out = getOutput()
  out.appendLine(`[status] ${text}`)
}

export function printJsonSummary(obj: unknown): void {
  try {
    const any = obj as Record<string, unknown>
    const phase = String(any.phase ?? any.status ?? 'done')
    const provider = String(any.provider ?? '')
    const app = String(any.app ?? any.project ?? '')
    const parts: string[] = []
    if (provider) parts.push(provider)
    if (app) parts.push(app)
    parts.push(phase)
    printStatus(parts.filter(Boolean).join(' · '))
  } catch {
    /* ignore */
  }
}

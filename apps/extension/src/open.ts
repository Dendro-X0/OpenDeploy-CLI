import * as vscode from 'vscode'
import { getSettings } from './config'
import { runOpenDeploy } from './run'

export type ProviderId = 'vercel' | 'cloudflare' | 'github'

/** Open the provider dashboard via CLI (uses opd open <provider> --json), then opens the returned URL. */
export async function openProviderDashboard(provider: ProviderId): Promise<void> {
  const cfg = getSettings()
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd()
  let targetUrl: string | undefined
  await runOpenDeploy({
    args: ['open', provider, '--json'],
    settings: cfg,
    cwd,
    onJson: (obj: unknown) => {
      const js = obj as { action?: string; url?: string }
      if (js && js.action === 'open' && typeof js.url === 'string' && js.url.length > 0) {
        targetUrl = js.url
      }
    }
  })
  if (targetUrl) {
    await vscode.env.openExternal(vscode.Uri.parse(targetUrl))
  } else {
    // Fallback generic dashboards
    const fallback: Record<ProviderId, string> = {
      vercel: 'https://vercel.com/dashboard',
      cloudflare: 'https://dash.cloudflare.com',
      github: 'https://github.com'
    }
    const url = fallback[provider]
    await vscode.env.openExternal(vscode.Uri.parse(url))
  }
}

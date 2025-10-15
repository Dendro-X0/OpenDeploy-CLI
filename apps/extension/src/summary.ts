import * as vscode from 'vscode'
import { getOutput } from './output'

let panel: vscode.WebviewPanel | undefined

export async function openSummaryPanel(): Promise<void> {
  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      'opendeploySummary',
      'OpenDeploy Summary',
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    )
    panel.onDidDispose(() => { panel = undefined })
  }
  const html = `<!DOCTYPE html>
  <html lang="en">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body{font-family:var(--vscode-font-family);padding:12px;color:var(--vscode-foreground);background:var(--vscode-editor-background)}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#444;color:#fff;margin-right:6px}
    .ok{background:#2e7d32}.warn{background:#f9a825}.err{background:#c62828}
    pre{white-space:pre-wrap;word-break:break-word}
  </style></head>
  <body>
    <h2>OpenDeploy Summary</h2>
    <div id="summary">Waiting for output...</div>
    <script>
      const vscode = acquireVsCodeApi();
      window.addEventListener('message', (ev) => {
        const data = ev.data || {};
        const el = document.getElementById('summary');
        if (data.type === 'summary') {
          const s = data.payload || {};
          const cls = s.ok ? 'ok' : (s.warn ? 'warn' : 'err');
          let html = '<span class="badge ' + cls + '">' + (s.phase || 'done') + '</span>';
          if (s.provider) html += '<span class="badge">' + s.provider + '</span>';
          if (s.app) html += '<span class="badge">' + s.app + '</span>';
          if (s.message) html += '<pre>' + s.message + '</pre>';
          el.innerHTML = html;
        }
      });
    </script>
  </body>
  </html>`
  panel.webview.html = html
}

export function postSummary(payload: unknown): void {
  if (!panel) return
  panel.webview.postMessage({ type: 'summary', payload })
}

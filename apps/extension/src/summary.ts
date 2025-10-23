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
    panel.webview.onDidReceiveMessage((msg: { readonly type: 'open-url' | 'follow-logs' | 'alias' | 'doctor'; readonly url?: string; readonly provider?: 'vercel' | 'cloudflare'; readonly fix?: boolean }) => {
      if (msg.type === 'open-url' && msg.url) { void vscode.env.openExternal(vscode.Uri.parse(msg.url)); return }
      if (msg.type === 'follow-logs') { void vscode.commands.executeCommand('opendeploy.followLogs', msg.provider); return }
      if (msg.type === 'alias' && msg.url) { void vscode.commands.executeCommand('opendeploy.vercelSetAlias', msg.url); return }
      if (msg.type === 'doctor') { void vscode.commands.executeCommand('opendeploy.doctor', msg.fix === true ? 'fix' : undefined); return }
    })
  }
  const html = `<!DOCTYPE html>
  <html lang="en">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body{font-family:var(--vscode-font-family);padding:12px;color:var(--vscode-foreground);background:var(--vscode-editor-background)}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#444;color:#fff;margin-right:6px}
    .ok{background:#2e7d32}.warn{background:#f9a825}.err{background:#c62828}
    pre{white-space:pre-wrap;word-break:break-word}
    .card{border:1px solid var(--vscode-panel-border);border-radius:8px;padding:10px;margin-top:10px}
    .section-title{font-weight:600;margin-bottom:6px}
    .actions{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}
    button{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:1px solid var(--vscode-panel-border);border-radius:6px;padding:6px 10px}
    button.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:0}
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
          // Resolve provider icon + name (for badges and buttons)
          const pid = String(s.provider||'').toLowerCase();
          const icon = pid.includes('vercel') ? '▲' : (pid.includes('cloudflare') ? '☁' : (pid.includes('github') ? 'GH' : ''));
          const pname = pid.includes('vercel') ? 'Vercel' : (pid.includes('cloudflare') ? 'Cloudflare' : (pid.includes('github') ? 'GitHub' : ''));
          if (s.provider) html += '<span class="badge" title="' + s.provider + '">' + (icon ? (icon + ' ') : '') + (pname || s.provider) + '</span>';
          if (s.app) html += '<span class="badge">' + s.app + '</span>';
          html += '<div class="actions">';
          if (s.url) html += '<button id="btnOpenUrl" class="primary" title="' + s.url + '">' + (icon ? (icon + ' ') : '') + 'Open URL' + (pname ? (' (' + pname + ')') : '') + '</button>';
          if (s.logsUrl) html += '<button id="btnOpenLogs" title="' + s.logsUrl + '">' + (icon ? (icon + ' ') : '') + 'Open Logs' + (pname ? (' (' + pname + ')') : '') + '</button>';
          if (pid.includes('vercel') && s.url) html += '<button id="btnAlias" title="Alias this deployment">' + (icon ? (icon + ' ') : '') + 'Alias</button>';
          html += '<button id="btnFollowLogs">Follow Logs</button>';
          html += '</div>';
          // Doctor & Preflight
          html += '<div class="actions">';
          html += '<button id="btnDoctor">Doctor & Preflight</button>';
          html += '<button id="btnDoctorFix" title="Attempt best-effort fixes">Doctor (Fix)</button>';
          html += '</div>';
          if (s.message) html += '<pre>' + s.message + '</pre>';
          // Doctor summary card
          if (s.action === 'doctor' && Array.isArray(s.checks)) {
            const fails = s.checks.filter((c)=>c && c.ok===false).slice(0,5)
            if (fails.length) {
              html += '<div class="card">'
              html += '<div class="section-title">Doctor — Failed Checks</div>';
              html += '<ul style="margin:6px 0 8px 18px">'
              for (const c of fails) { html += '<li>' + (c.name||'check') + ': ' + (c.message||'') + '</li>' }
              html += '</ul>'
              html += '<div class="actions">'
              html += '<button id="btnDoctorFix2" title="Attempt best-effort fixes">Doctor (Fix)</button>'
              html += '</div>'
              html += '</div>'
            }
          }
          el.innerHTML = html;
          const btnUrl = document.getElementById('btnOpenUrl');
          if (btnUrl && s.url) btnUrl.onclick = () => { vscode.postMessage({ type: 'open-url', url: s.url }) }
          const btnLogs = document.getElementById('btnOpenLogs');
          if (btnLogs && s.logsUrl) btnLogs.onclick = () => { vscode.postMessage({ type: 'open-url', url: s.logsUrl }) }
          const btnFollow = document.getElementById('btnFollowLogs');
          if (btnFollow) btnFollow.onclick = () => { vscode.postMessage({ type: 'follow-logs', provider: s.provider }) }
          const btnAlias = document.getElementById('btnAlias');
          if (btnAlias && s.url) btnAlias.onclick = () => { vscode.postMessage({ type: 'alias', url: s.url, provider: s.provider }) }
          const btnDoctor = document.getElementById('btnDoctor');
          if (btnDoctor) btnDoctor.onclick = () => { vscode.postMessage({ type: 'doctor' }) }
          const btnDoctorFix = document.getElementById('btnDoctorFix');
          if (btnDoctorFix) btnDoctorFix.onclick = () => { vscode.postMessage({ type: 'doctor', fix: true }) }
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

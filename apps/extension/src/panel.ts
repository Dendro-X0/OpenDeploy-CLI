import * as vscode from 'vscode'
import { getSettings } from './config'
import { listProjectCandidates, ProjectCandidate } from './detect'
import { getWs } from './storage'

export type RunAction = 'plan' | 'deploy' | 'doctor' | 'detect' | 'logs'

export type PanelMessage =
  | { type: 'toggle-json' }
  | { type: 'generate-gh', cwd: string, template?: 'reusable' | 'inline' }
  | { type: 'auth', provider: 'vercel' | 'cloudflare' }
  | { type: 'run', action: RunAction, cwd: string }
  | { type: 'select-app', cwd: string }
  | { type: 'open-summary' }
  | { type: 'open-url', url: string }
  | { type: 'scan-strict' }
  | { type: 'scan' }

export type PanelState =
  | { kind: 'init', preferJson: boolean, apps: ReadonlyArray<ProjectCandidate>, lastApp?: string }
  | { kind: 'result', ok: boolean, logsUrl?: string }
  | { kind: 'hints', hints: ReadonlyArray<string> }
  | { kind: 'toast', level: 'info' | 'warn' | 'error', message: string, provider?: 'vercel' | 'cloudflare' }
  | { kind: 'scan', total: number, at?: string }

let panel: vscode.WebviewPanel | undefined
let onMessageCb: ((msg: PanelMessage) => void | Promise<void>) | undefined

export async function openControlPanel(onMessage: (msg: PanelMessage) => void | Promise<void>): Promise<() => void> {
  onMessageCb = onMessage
  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      'opendeployControl',
      'OpenDeploy Control',
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    )
    panel.onDidDispose(() => { panel = undefined; onMessageCb = undefined })
    panel.webview.onDidReceiveMessage((msg: PanelMessage) => {
      void onMessageCb?.(msg)
    })
  }
  panel.webview.html = getHtml()
  // Post initial state
  const ws = vscode.workspace.workspaceFolders?.[0]
  const root = ws?.uri.fsPath ?? ''
  const apps = root ? await listProjectCandidates(root) : []
  const preferJson = getSettings().preferJson
  const lastApp = getWs<string>('opendeploy.lastApp', '')
  postPanelState({ kind: 'init', preferJson, apps, lastApp })
  return () => { panel?.dispose() }
}

export function postPanelState(state: PanelState): void {
  if (!panel) return
  panel.webview.postMessage({ type: 'state', payload: state })
}

function getHtml(): string {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: light dark; }
      body { font-family: var(--vscode-font-family); margin: 0; padding: 0; background: var(--vscode-editor-background); color: var(--vscode-foreground); }
      header { padding: 12px 16px; border-bottom: 1px solid var(--vscode-panel-border); display: flex; align-items: center; justify-content: space-between; }
      .title { font-weight: 600; }
      .pill { padding: 2px 10px; border-radius: 999px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: default; }
      .pill.ok { background: rgba(16, 185, 129, 0.2); color: var(--vscode-foreground); }
      .pill.warn { background: rgba(245, 158, 11, 0.2); color: var(--vscode-foreground); }
      #scanPill { cursor: pointer; }
      main { padding: 12px 16px; display: grid; gap: 12px; }
      .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      select, button { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 6px; padding: 6px 10px; }
      button.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 0; }
      button.primary:hover { filter: brightness(1.05); }
      button.ghost { background: transparent; border-color: var(--vscode-panel-border); }
      .muted { opacity: 0.8; }
      .spacer { flex: 1; }
      .status { margin-top: 8px; font-size: 12px; }
      .link { color: var(--vscode-textLink-foreground); cursor: pointer; }
    </style>
  </head>
  <body>
    <header>
      <div class="title">OpenDeploy</div>
      <div style="display:flex; gap:8px; align-items:center;">
        <div id="scanPill" class="pill">Scan: -</div>
        <div id="jsonPill" class="pill">JSON: On</div>
      </div>
    </header>
    <main>
      <div class="row">
        <label for="appSel" class="muted">App</label>
        <select id="appSel"></select>
        <span class="spacer"></span>
        <button id="btnPlan" class="primary">Plan</button>
        <button id="btnDeploy" class="primary">Deploy</button>
        <button id="btnDoctor" class="ghost">Doctor</button>
        <button id="btnLogs" class="ghost">Follow Logs</button>
        <button id="btnDetect" class="ghost">Detect</button>
      </div>
      <div class="row">
        <select id="tplSel">
          <option value="reusable">Reusable</option>
          <option value="inline">Inline</option>
        </select>
        <button id="btnGenGH" class="ghost">Generate GH Pages workflow</button>
        <span class="spacer"></span>
        <button id="btnVercel" class="ghost">Vercel Auth</button>
        <button id="btnCf" class="ghost">Cloudflare Auth</button>
        <button id="btnScan" class="ghost" title="Run scan (non-strict)">Run Scan</button>
        <button id="btnScanStrict" class="ghost" title="Run scan --strict (fail on findings)">Strict Scan</button>
        <button id="btnJson" class="ghost">Toggle JSON</button>
        <button id="btnSummary" class="ghost">Open Summary</button>
      </div>
      <div id="toast" class="status"></div>
      <div id="hints" class="status"></div>
      <div id="result" class="status muted"></div>
    </main>
    <script>
      const vscode = acquireVsCodeApi();
      const appSel = document.getElementById('appSel');
      const jsonPill = document.getElementById('jsonPill');
      const scanPill = document.getElementById('scanPill');
      const result = document.getElementById('result');
      const hints = document.getElementById('hints');
      const toast = document.getElementById('toast');
      const btnScanStrict = document.getElementById('btnScanStrict');
      const btnScan = document.getElementById('btnScan');
      function cwd(){ const opt = appSel.options[appSel.selectedIndex]; return (opt && opt.value) || '' }
      function post(msg){ vscode.postMessage(msg) }
      function renderInit(s){
        jsonPill.textContent = 'JSON: ' + (s.preferJson ? 'On' : 'Off')
        appSel.innerHTML = ''
        (s.apps||[]).forEach(c => {
          const o = document.createElement('option'); o.text = c.label; o.value = c.fsPath; appSel.add(o)
        })
        if (s.lastApp) {
          for (let i=0;i<appSel.options.length;i++){ if (appSel.options[i].value===s.lastApp){ appSel.selectedIndex = i; break } }
        }
        if (s.kind === 'scan') {
          const n = Number(s.total||0)
          if (scanPill) {
            scanPill.textContent = n === 0 ? 'Scan: OK' : ('Scan: ' + n)
            scanPill.classList.remove('ok','warn')
            scanPill.classList.add(n === 0 ? 'ok' : 'warn')
            if (s.at) { try { scanPill.title = 'Last scan at ' + new Date(s.at).toLocaleString() } catch {} }
          }
        }
      }
      window.addEventListener('message', ev => {
        const { type, payload } = ev.data || {}
        if (type !== 'state') return
        const s = payload || {}
        if (s.kind === 'init') renderInit(s)
        if (s.kind === 'hints') {
          hints.textContent = ''
          (s.hints||[]).forEach(t => { const div = document.createElement('div'); div.textContent = '• ' + t; hints.appendChild(div) })
        }
        if (s.kind === 'scan') {
          const n = Number(s.total||0)
          if (scanPill) {
            scanPill.textContent = n === 0 ? 'Scan: OK' : ('Scan: ' + n)
            if (s.at) { try { scanPill.title = 'Last scan at ' + new Date(s.at).toLocaleString() } catch {} }
          }
        }
        if (s.kind === 'toast') {
          toast.innerHTML = ''
          const div = document.createElement('div');
          div.textContent = s.message
          const actions = document.createElement('div');
          if (s.provider) {
            const login = document.createElement('button'); login.textContent = 'Login'; login.className='ghost'; login.onclick = ()=>{ vscode.postMessage({ type: 'auth', provider: s.provider }); toast.innerHTML='' }
            actions.appendChild(login)
          }
          const dismiss = document.createElement('button'); dismiss.textContent = 'Dismiss'; dismiss.className='ghost'; dismiss.onclick = ()=>{ toast.innerHTML='' }
          actions.appendChild(dismiss)
          toast.appendChild(div); toast.appendChild(actions)
        }
        if (s.kind === 'result') {
          result.textContent = (s.ok ? 'Success' : 'Failed') + (s.logsUrl ? ' — ' : '')
          if (s.logsUrl) {
            const a = document.createElement('a'); a.textContent = 'Open logs'; a.href = s.logsUrl; a.className = 'link'; a.onclick = (e)=>{ e.preventDefault(); vscode.postMessage({ type: 'open-url', url: s.logsUrl }) }
            result.appendChild(a)
          }
        }
      })
      appSel.onchange = ()=> post({ type: 'select-app', cwd: cwd() })
      document.getElementById('btnPlan').onclick = ()=> post({ type: 'run', action: 'plan', cwd: cwd() })
      document.getElementById('btnDeploy').onclick = ()=> post({ type: 'run', action: 'deploy', cwd: cwd() })
      document.getElementById('btnDoctor').onclick = ()=> post({ type: 'run', action: 'doctor', cwd: cwd() })
      document.getElementById('btnLogs').onclick = ()=> post({ type: 'run', action: 'logs', cwd: cwd() })
      document.getElementById('btnDetect').onclick = ()=> post({ type: 'run', action: 'detect', cwd: cwd() })
      document.getElementById('btnGenGH').onclick = ()=> { const tpl = document.getElementById('tplSel').value; post({ type: 'generate-gh', cwd: cwd(), template: tpl }) }
      document.getElementById('btnVercel').onclick = ()=> post({ type: 'auth', provider: 'vercel' })
      document.getElementById('btnCf').onclick = ()=> post({ type: 'auth', provider: 'cloudflare' })
      if (btnScanStrict) btnScanStrict.addEventListener('click', () => { post({ type: 'scan-strict' }) })
      if (btnScan) btnScan.addEventListener('click', () => { post({ type: 'scan' }) })
      if (scanPill) scanPill.addEventListener('click', () => { post({ type: 'scan' }) })
      document.getElementById('btnJson').onclick = ()=> { post({ type: 'toggle-json' }); jsonPill.textContent = (jsonPill.textContent==='JSON: On') ? 'JSON: Off' : 'JSON: On' }
      document.getElementById('btnSummary').onclick = ()=> post({ type: 'open-summary' })
    </script>
  </body>
  </html>`
}

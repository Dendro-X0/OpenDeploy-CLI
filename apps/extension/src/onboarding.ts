import * as vscode from 'vscode'
import { getSettings } from './config'
import { listProjectCandidates, ProjectCandidate } from './detect'
import { getWs, setWs } from './storage'

export type OnboardingMessage =
  | { type: 'toggle-json' }
  | { type: 'select-app', cwd: string }
  | { type: 'auth', provider: 'vercel' | 'cloudflare' }
  | { type: 'follow-logs', provider: 'vercel' | 'cloudflare', cwd: string }
  | { type: 'run', action: 'plan' | 'deploy', provider: 'vercel' | 'cloudflare', cwd: string }
  | { type: 'open-dash', provider: 'vercel' | 'cloudflare' }

export type OnboardingState = { kind: 'init', preferJson: boolean, apps: ReadonlyArray<ProjectCandidate>, lastApp?: string }

let panel: vscode.WebviewPanel | undefined
let onMessageCb: ((msg: OnboardingMessage) => void | Promise<void>) | undefined

export async function openOnboarding(onMessage: (msg: OnboardingMessage) => void | Promise<void>): Promise<() => void> {
  onMessageCb = onMessage
  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      'opendeployOnboarding',
      'OpenDeploy Onboarding',
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    )
    panel.onDidDispose(() => { panel = undefined; onMessageCb = undefined })
    panel.webview.onDidReceiveMessage((msg: OnboardingMessage) => { void onMessageCb?.(msg) })
  }
  panel.webview.html = getHtml()
  const ws = vscode.workspace.workspaceFolders?.[0]
  const root = ws?.uri.fsPath ?? ''
  const apps = root ? await listProjectCandidates(root) : []
  const preferJson = getSettings().preferJson
  const lastApp = getWs<string>('opendeploy.lastApp', '')
  panel.webview.postMessage({ type: 'state', payload: { kind: 'init', preferJson, apps, lastApp } satisfies OnboardingState })
  return () => { panel?.dispose() }
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
      main { padding: 12px 16px; display: grid; gap: 12px; }
      .card { border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 12px; }
      .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      select, button { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 6px; padding: 6px 10px; }
      button.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 0; }
      button.primary:hover { filter: brightness(1.05); }
      .muted { opacity: 0.8; }
      .spacer { flex: 1; }
      .radio { display: inline-flex; align-items: center; gap: 6px; margin-right: 12px; }
      .section-title { font-weight: 600; margin-bottom: 6px; }
    </style>
  </head>
  <body>
    <header>
      <div class="title">OpenDeploy Onboarding</div>
      <div id="jsonPill" class="pill">JSON: On</div>
    </header>
    <main>
      <section class="card">
        <div class="section-title">1) Select App</div>
        <div class="row">
          <select id="appSel"></select>
          <span class="spacer"></span>
          <button id="btnUseApp" class="primary">Use App</button>
        </div>
      </section>
      <section class="card">
        <div class="section-title">2) Select Provider & Check Auth</div>
        <div class="row">
          <label class="radio"><input type="radio" name="provider" value="vercel" checked /> Vercel</label>
          <label class="radio"><input type="radio" name="provider" value="cloudflare" /> Cloudflare Pages</label>
          <span class="spacer"></span>
          <button id="btnCheckAuth">Check Auth</button>
        </div>
      </section>
      <section class="card">
        <div class="section-title">3) Choose Action</div>
        <div class="row">
          <button id="btnPlan" class="primary">Plan</button>
          <button id="btnDeploy" class="primary">Deploy</button>
          <button id="btnFollowLogs">Follow Logs</button>
          <span class="spacer"></span>
          <button id="btnToggleJson">Toggle JSON</button>
        </div>
      </section>
      <section class="card">
        <div class="section-title">4) Summary & Shortcuts</div>
        <div class="row">
          <span id="provBadge" class="pill" title="Selected provider">Vercel</span>
          <span class="spacer"></span>
          <button id="btnOpenDash">Open Dashboard</button>
          <button id="btnShortFollow">Follow Logs</button>
          <button id="btnShortDoctor">Doctor</button>
          <button id="btnShortDoctorFix">Doctor (Fix)</button>
          <button id="btnOpenSummary">Open Summary</button>
        </div>
      </section>
    </main>
    <script>
      const vscode = acquireVsCodeApi();
      const appSel = document.getElementById('appSel');
      const jsonPill = document.getElementById('jsonPill');
      const provBadge = document.getElementById('provBadge');
      let currentCwd = ''
      let provider = 'vercel'
      function cwd(){ const opt = appSel.options[appSel.selectedIndex]; return (opt && opt.value) || '' }
      function post(msg){ vscode.postMessage(msg) }
      function renderInit(s){
        jsonPill.textContent = 'JSON: ' + (s.preferJson ? 'On' : 'Off')
        appSel.innerHTML = ''
        (s.apps||[]).forEach(c => { const o = document.createElement('option'); o.text = c.label; o.value = c.fsPath; appSel.add(o) })
        if (s.lastApp) { for (let i=0;i<appSel.options.length;i++){ if (appSel.options[i].value===s.lastApp){ appSel.selectedIndex = i; break } } }
        currentCwd = cwd()
      }
      window.addEventListener('message', ev => {
        const { type, payload } = ev.data || {}
        if (type !== 'state') return
        const s = payload || {}
        if (s.kind === 'init') renderInit(s)
      })
      document.getElementById('btnUseApp').onclick = ()=> { currentCwd = cwd(); vscode.postMessage({ type: 'select-app', cwd: currentCwd }) }
      document.getElementById('btnCheckAuth').onclick = ()=> { const pv = document.querySelector('input[name=\"provider\"]:checked'); provider = (pv && pv.value) || 'vercel'; provBadge.textContent = (provider==='cloudflare'?'Cloudflare':'Vercel'); vscode.postMessage({ type: 'auth', provider }) }
      document.getElementById('btnPlan').onclick = ()=> { const pv = document.querySelector('input[name=\"provider\"]:checked'); provider = (pv && pv.value) || 'vercel'; vscode.postMessage({ type: 'run', action: 'plan', provider, cwd: currentCwd||cwd() }) }
      document.getElementById('btnDeploy').onclick = ()=> { const pv = document.querySelector('input[name=\"provider\"]:checked'); provider = (pv && pv.value) || 'vercel'; vscode.postMessage({ type: 'run', action: 'deploy', provider, cwd: currentCwd||cwd() }) }
      document.getElementById('btnFollowLogs').onclick = ()=> { const pv = document.querySelector('input[name=\"provider\"]:checked'); provider = (pv && pv.value) || 'vercel'; vscode.postMessage({ type: 'follow-logs', provider, cwd: currentCwd||cwd() }) }
      document.getElementById('btnToggleJson').onclick = ()=> { vscode.postMessage({ type: 'toggle-json' }); jsonPill.textContent = (jsonPill.textContent==='JSON: On') ? 'JSON: Off' : 'JSON: On' }
      // Shortcuts
      document.getElementById('btnOpenDash').onclick = ()=> { const pv = document.querySelector('input[name=\"provider\"]:checked'); provider = (pv && pv.value) || 'vercel'; vscode.postMessage({ type: 'open-dash', provider }) }
      document.getElementById('btnShortFollow').onclick = ()=> { const pv = document.querySelector('input[name=\"provider\"]:checked'); provider = (pv && pv.value) || 'vercel'; vscode.postMessage({ type: 'follow-logs', provider, cwd: currentCwd||cwd() }) }
      document.getElementById('btnShortDoctor').onclick = ()=> { vscode.postMessage({ type: 'doctor' }) }
      document.getElementById('btnShortDoctorFix').onclick = ()=> { vscode.postMessage({ type: 'doctor', fix: true }) }
      document.getElementById('btnOpenSummary').onclick = ()=> { vscode.postMessage({ type: 'open-summary' }) }
    </script>
  </body>
  </html>`
}

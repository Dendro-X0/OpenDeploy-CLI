import * as vscode from 'vscode'

let mainItem: vscode.StatusBarItem | undefined
let jsonItem: vscode.StatusBarItem | undefined
let planItem: vscode.StatusBarItem | undefined

export function createStatusBar(): vscode.StatusBarItem {
  if (!mainItem) {
    mainItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
    mainItem.text = 'OpenDeploy: idle'
    mainItem.tooltip = 'OpenDeploy status — click to open summary'
    mainItem.show()
  }
  if (!jsonItem) {
    jsonItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99)
    jsonItem.text = 'JSON: On'
    jsonItem.tooltip = 'Toggle JSON view'
    jsonItem.command = 'opendeploy.toggleJson'
    jsonItem.show()
  }
  if (!planItem) {
    planItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98)
    planItem.text = '$(play) Plan'
    planItem.tooltip = 'Run OpenDeploy Plan'
    planItem.command = 'opendeploy.plan'
    planItem.show()
  }
  return mainItem
}

export function setRunning(isRunning: boolean): void {
  if (!mainItem) return
  mainItem.text = isRunning ? 'OpenDeploy: running' : 'OpenDeploy: idle'
}

export function updateJsonToggle(enabled: boolean): void {
  if (!jsonItem) return
  jsonItem.text = enabled ? 'JSON: On' : 'JSON: Off'
}

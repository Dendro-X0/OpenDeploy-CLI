import * as vscode from 'vscode'

let ctx: vscode.ExtensionContext | undefined

export function setExtensionContext(c: vscode.ExtensionContext): void {
  ctx = c
}

export function getWs<T>(key: string, def: T): T {
  return (ctx?.workspaceState.get(key, def as any) as T) ?? def
}

export async function setWs<T>(key: string, value: T): Promise<void> {
  await ctx?.workspaceState.update(key, value as any)
}

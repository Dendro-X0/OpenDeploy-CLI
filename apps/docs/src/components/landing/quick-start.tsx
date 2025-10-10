"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"

type Cmd = { readonly key: string; readonly label: string; readonly code: string }
type Manager = "npm" | "pnpm" | "yarn" | "bun"
type InstallMode = "binary" | "manager"

function execPrefix(m: Manager): string {
  if (m === "pnpm") return "pnpm dlx"
  if (m === "yarn") return "yarn dlx"
  if (m === "bun") return "bunx"
  return "npx" // npm
}

export function QuickStart(): React.ReactElement {
  const [copiedKey, setCopiedKey] = useState<string>("")
  const [mgr, setMgr] = useState<Manager>("npm")
  const [mode, setMode] = useState<InstallMode>("binary")

  const x = execPrefix(mgr)
  const commands: ReadonlyArray<Cmd> = mode === "binary"
    ? [
        { key: "start", label: "# Start wizard", code: "opd start" },
        { key: "gen-vercel", label: "# Generate vercel.json", code: "opd start --provider vercel --generate-config-only" },
        { key: "up-vercel", label: "# Preview deploy (Vercel)", code: "opd up vercel --env preview --ndjson --timestamps" },
        { key: "logs-vc", label: "# Logs (Vercel)", code: "opd logs vercel --follow" },
        { key: "logs-cf", label: "# Open Cloudflare Inspect", code: "opd logs cloudflare --open" },
        { key: "open-gh", label: "# Open GitHub Pages", code: "opd open github" },
      ]
    : [
        { key: "coming-soon", label: "# Package manager install (coming soon)", code: "Use Releases binary: opd -h" },
      ]

  const all: string = commands.map((c) => `${c.label}\n${c.code}`).join("\n\n") + "\n"

  async function copy(text: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(""), 1500)
    } catch {
      setCopiedKey("")
    }
  }

  return (
    <div className="relative max-w-4xl mx-auto">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl -z-10" />
      <div className="text-left rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 flex items-center justify-between gap-2" aria-live="polite">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Quick Start</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3"
            onClick={async () => copy(all, "all")}
            aria-label="Copy quick start commands"
          >
            {copiedKey === "all" ? (
              <>
                <Check className="mr-2 h-4 w-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" /> Copy
              </>
            )}
          </Button>
        </div>
        <div className="p-6 font-mono text-sm leading-7 space-y-3">
          <div className="flex items-center gap-2 pb-2">
            <span className="text-xs text-muted-foreground">Install method:</span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={mode === "binary" ? "default" : "outline"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setMode("binary")}
                aria-pressed={mode === "binary"}
              >Releases (opd)</Button>
              <Button
                type="button"
                variant={mode === "manager" ? "default" : "outline"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setMode("manager")}
                aria-pressed={mode === "manager"}
                disabled
                title="Coming soon"
              >Package Manager (soon)</Button>
            </div>
          </div>
          {mode === "manager" ? (
          <div className="flex items-center gap-2 pb-2">
            <span className="text-xs text-muted-foreground">Package manager:</span>
            <div className="flex items-center gap-1">
              {(["npm","pnpm","yarn","bun"] as Manager[]).map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={mgr === m ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setMgr(m)}
                  aria-pressed={mgr === m}
                >{m}</Button>
              ))}
            </div>
          </div>
          ) : null}
          {commands.map((c) => (
            <div key={c.key} className="flex items-start justify-between gap-3 group">
              <div
                role="button"
                tabIndex={0}
                onClick={async () => copy(c.code, c.key)}
                onKeyDown={async (e) => { if (e.key === "Enter" || e.key === " ") { await copy(c.code, c.key) } }}
                className="rounded-md px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors max-w-full"
                aria-label={`Copy: ${c.code}`}
              >
                <div className="text-gray-600 dark:text-gray-400">{c.label}</div>
                <div className="text-blue-700 dark:text-blue-300 break-all">{c.code}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={async () => copy(c.code, c.key)}
                aria-label={`Copy ${c.key}`}
              >
                {copiedKey === c.key ? (<><Check className="mr-2 h-4 w-4" /> Copied</>) : (<><Copy className="mr-2 h-4 w-4" /> Copy</>)}
              </Button>
            </div>
          ))}
          <div className="text-xs text-muted-foreground pt-1 pl-2">Tip: Click a command to copy. Hover reveals an action button.</div>
        </div>
      </div>
    </div>
  )
}

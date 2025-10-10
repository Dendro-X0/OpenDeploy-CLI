"use client"

import { useEffect, useState, type ReactElement } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * Provider capabilities schema loaded from `/data/providers.json` at runtime.
 */
export interface CapabilityFlags {
  readonly static: boolean
  readonly serverless: boolean
  readonly link: boolean
  readonly env: boolean
  readonly build: boolean
  readonly deploy: boolean
  readonly logs: boolean
  readonly promote: boolean
  readonly rollback: boolean
  readonly ci: boolean
}

export interface ProviderCaps {
  readonly name: string
  readonly version?: string
  readonly capabilities: CapabilityFlags
  readonly notes?: readonly string[]
}

export type ProvidersCapsMap = Record<string, ProviderCaps>

interface ProviderCapabilitiesProps {
  /** provider id, e.g. `vercel`, `cloudflare`, `github` */
  readonly provider: string
  /** optional title override */
  readonly title?: string
  /** optional className */
  readonly className?: string
}

const BASE: string = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim()
const DATA_URL: string = `${BASE}/data/providers.json`

/**
 * Render a compact grid of capability badges for a provider.
 * Falls back to a minimal built‑in map when JSON is unavailable.
 */
export function ProviderCapabilities({ provider, title, className }: ProviderCapabilitiesProps): ReactElement {
  const [caps, setCaps] = useState<ProviderCaps | null>(null)

  useEffect(() => {
    let aborted = false
    const fetchCaps = async (): Promise<void> => {
      try {
        const res = await fetch(DATA_URL, { cache: "no-store" })
        if (!res.ok) throw new Error(`caps fetch failed: ${res.status}`)
        const json = (await res.json()) as ProvidersCapsMap
        if (!aborted) setCaps(json[provider] ?? null)
      } catch {
        // Fallback baseline that mirrors current CLI defaults
        const fallback: ProvidersCapsMap = {
          vercel: { name: "Vercel", capabilities: { static: true, serverless: true, link: true, env: true, build: true, deploy: true, logs: true, promote: true, rollback: true, ci: true } },
          cloudflare: { name: "Cloudflare Pages", capabilities: { static: true, serverless: false, link: true, env: true, build: true, deploy: true, logs: true, promote: false, rollback: false, ci: true } },
          github: { name: "GitHub Pages", capabilities: { static: true, serverless: false, link: false, env: false, build: true, deploy: true, logs: false, promote: false, rollback: false, ci: true } },
        }
        if (!aborted) setCaps(fallback[provider] ?? null)
      }
    }
    void fetchCaps()
    return () => { aborted = true }
  }, [provider])

  if (!caps) return <div className={cn("text-sm text-muted-foreground", className)}>No capability data.</div>

  const items: Array<{ key: keyof CapabilityFlags; label: string }> = [
    { key: "static", label: "Static" },
    { key: "serverless", label: "Serverless" },
    { key: "link", label: "Link" },
    { key: "env", label: "Env" },
    { key: "build", label: "Build" },
    { key: "deploy", label: "Deploy" },
    { key: "logs", label: "Logs" },
    { key: "promote", label: "Promote" },
    { key: "rollback", label: "Rollback" },
    { key: "ci", label: "CI" },
  ]

  return (
    <section className={cn("not-prose my-4", className)} aria-label={`${caps.name} capabilities`}>
      <h3 className="text-base font-semibold mb-2">{title ?? "Supported capabilities"}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map(({ key, label }) => {
          const enabled = caps.capabilities[key]
          return (
            <Badge
              key={key}
              variant={enabled ? "default" : "secondary"}
              className={cn("text-xs", enabled ? "bg-green-600 dark:bg-green-500" : "opacity-70")}
              aria-pressed={enabled}
              aria-label={`${label}: ${enabled ? "supported" : "not supported"}`}
            >
              {label}
            </Badge>
          )
        })}
      </div>
      {caps.notes && caps.notes.length > 0 ? (
        <ul className="mt-2 list-disc ml-5 text-sm text-muted-foreground">
          {caps.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

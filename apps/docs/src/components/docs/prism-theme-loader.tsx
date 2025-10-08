"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"

// Lightweight loader that swaps Prism theme CSS based on the active theme.
// Self-hosted from public/prism/ and prefixed with basePath/assetPrefix for GitHub Pages.
function resolveBasePath(): string {
  const env = (process.env.NEXT_PUBLIC_BASE_PATH || '').trim()
  if (env) return env
  if (typeof window !== 'undefined') {
    try {
      const data = (window as any).__NEXT_DATA__
      if (data?.assetPrefix) return String(data.assetPrefix)
    } catch { /* noop */ }
    try {
      const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null
      if (link?.href) {
        const u = new URL(link.href)
        // Drop trailing filename to get basePath
        const path = u.pathname.replace(/\/[^^/]*$/, '')
        if (path && path !== '/') return path
      }
    } catch { /* noop */ }
  }
  return ''
}

export function PrismThemeLoader(): null {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const base = resolveBasePath()
    const DARK_CSS = `${base}/prism/one-dark.css`
    const LIGHT_CSS = `${base}/prism/one-light.css`
    const id = "__prism-theme__"
    let link = document.getElementById(id) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement("link")
      link.id = id
      link.rel = "stylesheet"
      document.head.appendChild(link)
    }
    link.href = resolvedTheme === "dark" ? DARK_CSS : LIGHT_CSS
  }, [resolvedTheme])

  return null
}

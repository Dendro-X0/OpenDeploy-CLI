"use client"

import { useEffect, type ReactElement } from "react"

/**
 * MobileSafeMode
 * Enables a conservative, overflow-proof rendering mode on mobile when:
 * - Query param mobile=safe is present, or
 * - NEXT_PUBLIC_MOBILE_SAFE_MODE is set to "1" at build time.
 *
 * It sets a data attribute on <html> that globals.css can target to clamp widths,
 * disable sticky/complex effects, and turn off gradient text if needed.
 */
export default function MobileSafeMode(): ReactElement | null {
  useEffect((): void | (() => void) => {
    const apply = (): void => {
      try {
        const sp = new URLSearchParams(window.location.search)
        const qp = sp.get("mobile")
        const env: string | undefined = process.env.NEXT_PUBLIC_MOBILE_SAFE_MODE
        const enable: boolean = qp === "safe" || env === "1"
        const root: HTMLElement = document.documentElement
        if (enable) root.setAttribute("data-mobile-safe", "1")
        else root.removeAttribute("data-mobile-safe")
      } catch {
        /* no-op */
      }
    }
    apply()
    const onChange = (): void => apply()
    window.addEventListener("popstate", onChange)
    window.addEventListener("hashchange", onChange)
    return () => {
      window.removeEventListener("popstate", onChange)
      window.removeEventListener("hashchange", onChange)
    }
  }, [])
  return null
}

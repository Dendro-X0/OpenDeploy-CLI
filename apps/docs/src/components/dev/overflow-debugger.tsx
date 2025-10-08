"use client"

import { useEffect, type ReactElement } from "react"

/**
 * OverflowDebugger
 * Highlights elements that extend beyond the viewport width.
 * Enable with ?debug=overflow in the URL.
 */
export default function OverflowDebugger(): ReactElement | null {
  useEffect((): void | (() => void) => {
    const enabled = (): boolean => {
      try { return new URLSearchParams(window.location.search).get("debug") === "overflow" } catch { return false }
    }
    if (!enabled()) return
    const offenders = new Set<Element>()
    const scan = (): void => {
      offenders.forEach((el) => (el as HTMLElement).style.outline = "")
      offenders.clear()
      const vw = window.innerWidth
      const all = Array.from(document.querySelectorAll("*"))
      for (const el of all) {
        const r = (el as HTMLElement).getBoundingClientRect()
        const sw = (el as HTMLElement).scrollWidth
        if (r.right > vw + 1 || sw > vw + 1) {
          offenders.add(el)
        }
      }
      offenders.forEach((el) => (el as HTMLElement).style.outline = "1px solid rgba(255,0,0,0.6)")
    }
    const id = window.setInterval(scan, 800)
    scan()
    const onChange = (): void => { if (enabled()) scan() }
    window.addEventListener("popstate", onChange)
    window.addEventListener("hashchange", onChange)
    return () => { window.clearInterval(id); window.removeEventListener("popstate", onChange); window.removeEventListener("hashchange", onChange); offenders.forEach((el) => (el as HTMLElement).style.outline = "") }
  }, [])
  return null
}

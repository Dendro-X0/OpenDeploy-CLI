"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState, type RefObject, type CSSProperties } from "react"
import { cn } from "@/lib/utils"

type Heading = { id: string; title: string; level: number }

/**
 * Convert heading text into a URL-safe slug id.
 * Ensures lower-case, trims, strips non-word characters and collapses spaces to dashes.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
}

interface ReadingIndicatorProps {
  contentRef: RefObject<HTMLElement | null>
  className?: string
}

/**
 * ReadingIndicator renders a right-rail table of contents with a progress bar.
 * On wide screens (>=1280px), it floats on the right using fixed positioning to remain visible while scrolling.
 * On smaller screens it falls back to a sticky container within the flow.
 */
export function ReadingIndicator({ contentRef, className }: ReadingIndicatorProps): React.ReactElement | null {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [activeId, setActiveId] = useState<string>("")
  const [progress, setProgress] = useState<number>(0)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const asideScrollRef = useRef<HTMLDivElement | null>(null)
  const asideRef = useRef<HTMLDivElement | null>(null)
  const [useFixed, setUseFixed] = useState<boolean>(false)
  const [fixedStyle, setFixedStyle] = useState<CSSProperties | undefined>(undefined)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    // Collect h2-h4 headings, ensure they have ids
    const nodes = Array.from(el.querySelectorAll<HTMLElement>("h2, h3, h4"))
    const used = new Set<string>()
    const hs: Heading[] = nodes.map((node) => {
      let id = node.id
      if (!id) {
        const base = slugify(node.textContent || "") || "section"
        let unique = base
        let i = 1
        while (used.has(unique)) {
          unique = `${base}-${i++}`
        }
        node.id = unique
        id = unique
      }
      used.add(id)
      const level = Number(node.tagName.replace("H", ""))
      return { id, title: node.textContent || id, level }
    })
    setHeadings(hs)

    // Intersection observer for active heading
    observerRef.current?.disconnect()
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId((entry.target as HTMLElement).id)
          }
        })
      },
      { root: null, rootMargin: "-40% 0px -55% 0px", threshold: [0, 1] },
    )
    nodes.forEach((n) => io.observe(n))
    observerRef.current = io

    // Cleanup
    return () => io.disconnect()
  }, [contentRef])

  useEffect(() => {
    const onScroll = (): void => {
      const el = contentRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const contentHeight = el.offsetHeight
      const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(contentHeight - viewportHeight, 1))
      const pct = (scrolled / Math.max(contentHeight - viewportHeight, 1)) * 100
      setProgress(pct)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [contentRef])

  // Decide when to use fixed positioning (xl breakpoint) and compute geometry
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)')
    const updateMode = (): void => setUseFixed(mq.matches)
    updateMode()
    mq.addEventListener('change', updateMode)
    return () => mq.removeEventListener('change', updateMode)
  }, [])

  useEffect(() => {
    if (!useFixed) {
      setFixedStyle(undefined)
      return
    }
    const updatePosition = (): void => {
      const content = contentRef.current
      const aside = asideRef.current
      if (!content || !aside) return
      const rect = content.getBoundingClientRect()
      const margin = 24 // space between content and rail
      const minPadding = 16 // viewport right padding
      const width = aside.offsetWidth || 272
      let left = rect.right + margin
      const maxLeft = window.innerWidth - minPadding - width
      if (left > maxLeft) left = Math.max(minPadding, maxLeft)
      const top = 96 // 24 * 4 (matches top-24 in sticky mode)
      const maxHeight = Math.max(window.innerHeight - top - 16, 200)
      setFixedStyle({ position: 'fixed', left, top, maxHeight, zIndex: 30 })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, { passive: true })
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
    }
  }, [useFixed, contentRef])

  const items = useMemo(() => headings, [headings])

  // Intentionally do not auto-scroll the right rail; sticky container keeps it visible.

  if (items.length === 0) return null

  return (
    <aside
      className={cn("hidden xl:block w-[260px] flex-shrink-0", className)}
      aria-label="On this page"
    >
      <div
        ref={asideRef}
        style={fixedStyle}
        className={cn(
          useFixed ? "w-[260px]" : "",
        )}
      >
      <div
        ref={asideScrollRef}
        className={cn(
          useFixed
            ? "max-h-[calc(100vh-7rem)] overflow-auto overflow-x-hidden pr-2"
            : "sticky top-24 max-h-[calc(100vh-7rem)] overflow-auto overflow-x-hidden pr-2",
        )}
      >
        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-1.5 w-full rounded-full bg-border overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Reading progress">
            <div className="h-full bg-primary transition-[width] ease-linear duration-200" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Outline */}
        <div className="border-l border-border pl-6 overflow-x-hidden">
          <h4 className="font-semibold text-sm mb-4 text-muted-foreground uppercase tracking-wide">On This Page</h4>
          <nav
            className="space-y-2 overflow-x-hidden"
            aria-label="Section links"
            onKeyDown={(e) => {
              const target = e.target as HTMLElement
              if (target.tagName !== 'A') return
              const links = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLAnchorElement>('a'))
              const ix = links.indexOf(target as HTMLAnchorElement)
              if (e.key === 'ArrowDown' && ix > -1) {
                e.preventDefault(); const next = links[ix + 1] ?? links[0]; next.focus()
              } else if (e.key === 'ArrowUp' && ix > -1) {
                e.preventDefault(); const prev = links[ix - 1] ?? links[links.length - 1]; prev.focus()
              }
            }}
          >
            {items.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={cn(
                  "block text-sm text-muted-foreground hover:text-foreground transition-colors py-1 border-l-2 border-transparent pl-3",
                  item.level === 2 && "font-medium",
                  item.level === 3 && "pl-6",
                  item.level === 4 && "pl-9",
                  activeId === item.id && "text-foreground border-border",
                )}
                aria-current={activeId === item.id ? "true" : undefined}
                tabIndex={0}
                onClick={() => {
                  // After default jump, move focus to the heading for screen readers without forcing scroll
                  requestAnimationFrame(() => {
                    const el = document.getElementById(item.id)
                    if (!el) return
                    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
                    ;(el as HTMLElement).focus({ preventScroll: true })
                  })
                }}
              >
                {item.title}
              </a>
            ))}
          </nav>
        </div>
      </div>
      </div>
    </aside>
  )
}

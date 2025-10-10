"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { DocsHeader } from "@/components/layout/docs/docs-header"
import { DocsSidebar } from "@/components/layout/docs/docs-sidebar"
import { ReadingIndicator } from "@/components/layout/docs/reading-indicator"
import { DocsPageFlip } from "@/components/layout/docs/docs-page-flip"
import { cn } from "@/lib/utils"
import SkipLink from "@/components/a11y/skip-link"

interface DocsLayoutProps {
  children: React.ReactNode
  showSidebar?: boolean
  showTableOfContents?: boolean
  tableOfContents?: Array<{ id: string; title: string; level: number }>
}

export function DocsLayout({
  children,
  showSidebar = true,
  showTableOfContents = false,
  tableOfContents = [],
}: DocsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const contentRef = useRef<HTMLElement | null>(null)
  const [tocEnabled, setTocEnabled] = useState<boolean>(showTableOfContents)

  // Compute tocEnabled from the URL on the client without useSearchParams to avoid Suspense requirement
  useEffect((): void | (() => void) => {
    const compute = (): void => {
      try {
        const sp: URLSearchParams = new URLSearchParams(window.location.search)
        const disabled: boolean = sp.get("toc") === "0"
        setTocEnabled(showTableOfContents && !disabled)
      } catch {
        setTocEnabled(showTableOfContents)
      }
    }
    compute()
    const onPop = (): void => compute()
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [showTableOfContents])

  // Prevent background scroll when the mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
    return
  }, [sidebarOpen])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SkipLink />
      <DocsHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />

      <div className="flex flex-1">
        {/* Fixed Sidebar */}
        {showSidebar && (
          <>
            {/* Mobile off-canvas (render only when open, within a clipping container) */}
            <div
              className={cn("fixed inset-0 z-50 lg:hidden", sidebarOpen ? "block" : "hidden")}
              role="dialog"
              aria-modal="true"
            >
              <div className="absolute inset-0 bg-black/60" role="presentation" aria-hidden onClick={() => setSidebarOpen(false)} />
              <aside
                className="absolute top-16 left-0 h-[calc(100vh-4rem)] w-64 sm:w-72 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/95"
                id="docs-sidebar"
              >
                <DocsSidebar onItemClick={() => setSidebarOpen(false)} />
              </aside>
            </div>

            {/* Desktop sidebar (participates in layout width) */}
            <aside className="hidden lg:sticky lg:top-16 lg:z-30 lg:block lg:h-[calc(100vh-4rem)] lg:w-72 lg:flex-shrink-0 lg:border-r">
              <DocsSidebar />
            </aside>
          </>
        )}

        {/* Main content area */}
        <main className="relative flex-1 min-w-0 flex flex-col overflow-hidden" id="main-content" role="main" aria-hidden={sidebarOpen ? true : undefined}>
          {/* Subtle background gradients (decorative) */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-[5%] top-[-10%] h-[280px] w-[520px] rounded-full bg-gradient-to-br from-sky-300/15 via-violet-300/10 to-transparent blur-3xl dark:from-sky-400/10 dark:via-violet-400/10" />
            <div className="absolute right-[-8%] bottom-[-12%] h-[260px] w-[480px] rounded-full bg-gradient-to-tr from-emerald-200/15 via-cyan-200/10 to-transparent blur-3xl dark:from-emerald-300/10 dark:via-cyan-300/10" />
          </div>
          <div className="flex-1 min-w-0 max-w-full mx-auto px-4 sm:px-6 py-8 pb-16">
            <div className="flex justify-center min-w-0 max-w-full">
              {/* Centered content container */}
              <div className={cn(
                "w-full min-w-0 max-w-full",
                tocEnabled
                  ? "sm:max-w-4xl xl:max-w-5xl xl:flex xl:gap-8"
                  : "sm:max-w-3xl"
              )}>
                {/* Main content */}
                <div
                  ref={contentRef as any}
                  className={cn(
                    "flex-1 min-w-0 max-w-full docs-container",
                    tocEnabled ? "xl:max-w-3xl" : ""
                  )}
                >
                  {children}
                  <DocsPageFlip />
                </div>

                {/* Reading Indicator (right rail) */}
                {tocEnabled && (
                  <div className="hidden xl:block">
                    <ReadingIndicator contentRef={contentRef} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

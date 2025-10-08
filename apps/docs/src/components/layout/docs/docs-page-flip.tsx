"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"
import type { ReactElement } from "react"
import { cn } from "@/lib/utils"

/**
 * Minimal next/previous pager for docs pages.
 * Automatically determines prev/next using a fixed route order for OpenDeploy CLI docs.
 */
export function DocsPageFlip(): ReactElement | null {
  const pathname = (usePathname() || "").replace(/\/$/, "")

  const order = [
    { title: "Overview", url: "/docs/opendeploy/overview" },
    { title: "Commands", url: "/docs/opendeploy/commands" },
    { title: "Providers", url: "/docs/opendeploy/providers" },
    { title: "CI Recipes", url: "/docs/opendeploy/ci" },
    { title: "Troubleshooting", url: "/docs/opendeploy/troubleshooting" },
  ] as const

  const idx = order.findIndex((i) => pathname.startsWith(i.url))
  if (idx === -1) return null

  const prev = idx > 0 ? order[idx - 1] : null
  const next = idx < order.length - 1 ? order[idx + 1] : null

  if (!prev && !next) return null

  return (
    <div className="mt-12 pt-6 border-t border-border">
      <div className="flex items-center justify-between gap-3">
        {prev ? (
          <PagerLink href={prev.url} label="Previous" title={prev.title} direction="prev" />
        ) : (
          <div />
        )}
        {next ? (
          <PagerLink href={next.url} label="Next" title={next.title} direction="next" />
        ) : (
          <div />
        )}
      </div>
    </div>
  )
}

type PagerLinkProps = {
  href: string
  label: string
  title: string
  direction: "prev" | "next"
}

function PagerLink({ href, label, title, direction }: PagerLinkProps): ReactElement {
  const isNext = direction === "next"
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
        isNext && "ml-auto",
      )}
      aria-label={`${label}: ${title}`}
    >
      {!isNext && <ArrowLeft className="h-4 w-4 opacity-70 group-hover:opacity-100" />}
      <div className="flex flex-col text-left">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="font-medium">{title}</span>
      </div>
      {isNext && <ArrowRight className="h-4 w-4 opacity-70 group-hover:opacity-100" />}
    </Link>
  )
}

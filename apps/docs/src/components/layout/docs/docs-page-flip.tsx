"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"
import type { ReactElement } from "react"
import { cn } from "@/lib/utils"
import { navigationItems, type NavLeaf, type NavSubGroup } from "./nav"

/**
 * Next/previous pager for docs pages.
 * Uses the shared navigation tree to determine a linear order across all internal docs pages.
 */
export function DocsPageFlip(): ReactElement | null {
  const pathname: string = (usePathname() || "").replace(/\/$/, "")

  // Flatten the navigation into a linear list of internal pages in sidebar order.
  const linear = flattenNav()
  const idx = linear.findIndex((i) => pathname === i.url)
  if (idx === -1) return null

  const prev = idx > 0 ? linear[idx - 1] : null
  const next = idx < linear.length - 1 ? linear[idx + 1] : null

  if (!prev && !next) return null

  return (
    <div className="mt-12 pt-6 border-t border-border">
      <div className="flex items-center justify-between gap-3">
        {prev && (
          <PagerLink href={prev.url} label="Previous" title={prev.title} direction="prev" />
        )}
        {next && (
          <PagerLink href={next.url} label="Next" title={next.title} direction="next" />
        )}
      </div>
    </div>
  )
}

type LinearItem = { title: string; url: string }

function isInternal(url: string): boolean {
  return url.startsWith("/")
}

function flattenNav(): LinearItem[] {
  const out: LinearItem[] = []
  for (const item of navigationItems) {
    if ("url" in item) {
      if (isInternal(item.url)) out.push({ title: item.title, url: item.url })
      continue
    }
    for (const sub of item.items) {
      if ("url" in sub) {
        const u = (sub as NavLeaf).url
        // Skip anchor-only links (e.g., Quick Start anchor) for linear paging
        if (isInternal(u) && !u.includes("#")) out.push({ title: sub.title, url: u })
      } else {
        for (const leaf of (sub as NavSubGroup).items) {
          if (isInternal(leaf.url)) out.push({ title: leaf.title, url: leaf.url })
        }
      }
    }
  }
  return out
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

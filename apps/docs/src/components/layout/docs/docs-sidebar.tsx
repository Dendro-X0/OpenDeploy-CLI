"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Code, FileText, Home, Rocket, Terminal, ChevronDown, ChevronRight, Cloud } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import type { LucideIcon } from "lucide-react"
import VERSION from "@/lib/version"

type NavLeaf = { title: string; url: string }
type NavSubGroup = { title: string; items: readonly NavLeaf[] }
type NavLink = { title: string; icon: LucideIcon; url: string }
type NavGroup = { title: string; icon: LucideIcon; items: readonly (NavLeaf | NavSubGroup)[] }
type NavItem = NavLink | NavGroup

const navigationItems: ReadonlyArray<NavItem> = [
  {
    title: "Overview",
    icon: Home,
    url: "/docs/opendeploy/overview",
  },
  {
    title: "Getting Started",
    icon: Rocket,
    items: [
      { title: "Install", url: "/docs/opendeploy/install" },
      { title: "Quick Start", url: "/docs/opendeploy/overview#quick-start" },
    ],
  },
  {
    title: "CLI",
    icon: Terminal,
    items: [
      { title: "Commands", url: "/docs/opendeploy/commands" },
      { title: "Environment", url: "/docs/opendeploy/commands/environment" },
      { title: "Deploy", url: "/docs/opendeploy/commands/deploy" },
      { title: "System", url: "/docs/opendeploy/commands/system" },
      { title: "CI Recipes", url: "/docs/opendeploy/ci" },
      { title: "Troubleshooting", url: "/docs/opendeploy/troubleshooting" },
    ],
  },
  {
    title: "Providers",
    icon: Cloud,
    items: [
      { title: "Vercel", url: "/docs/opendeploy/providers/vercel" },
      { title: "Netlify", url: "/docs/opendeploy/providers/netlify" },
      { title: "Cloudflare Pages", url: "/docs/opendeploy/providers/cloudflare" },
      { title: "GitHub Pages", url: "/docs/opendeploy/providers/github" },
    ],
  },
]

type ResourceItem = { title: string; url: string; icon: LucideIcon; badge?: string }
const resourceItems: ReadonlyArray<ResourceItem> = [
  { title: "Changelog", url: "https://github.com/Dendro-X0/OpenDeploy-CLI/releases", icon: FileText, badge: "New" },
  { title: "GitHub", url: "https://github.com/Dendro-X0/OpenDeploy-CLI", icon: Code },
]

interface DocsSidebarProps { onItemClick?: () => void }

export function DocsSidebar({ onItemClick }: DocsSidebarProps) {
  const pathname = usePathname()
  const STORAGE_KEY: string = "docs:expanded"
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const arr = JSON.parse(raw) as unknown
          if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === "string")
        }
      } catch {}
    }
    return ["Getting Started", "CLI", "Providers"]
  })
  useEffect(() => { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedSections)) } catch {} }, [expandedSections])

  const toggleSection = (title: string): void => {
    setExpandedSections(prev => (prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]))
  }

  const base = (url: string): string => url.split('#')[0]
  const isActive = (url: string): boolean => pathname === base(url)
  const flattenUrls = (items: ReadonlyArray<NavLeaf | NavSubGroup>): readonly string[] => {
    const out: string[] = []
    for (const it of items) {
      if ('url' in it) out.push(base(it.url))
      else for (const leaf of it.items) out.push(base(leaf.url))
    }
    return out
  }
  const isParentActive = (items: ReadonlyArray<NavLeaf | NavSubGroup>): boolean => {
    const urls = flattenUrls(items)
    return urls.some(u => pathname === u)
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0 px-4 py-6 pr-2">
        <div className="space-y-8">
          {/* Main Navigation */}
          <div>
            <nav className="space-y-1" role="navigation" aria-label="Primary">
              {navigationItems.map((item) => (
                <div key={item.title}>
                  {"items" in item ? (
                    <>
                      {(() => { const Icon = item.icon; return null })()}
                      <button
                        onClick={() => toggleSection(item.title)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground group",
                          isParentActive(item.items) && "bg-accent text-accent-foreground",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {(() => { const Icon = item.icon; return <Icon className="h-4 w-4" /> })()}
                          <span>{item.title}</span>
                        </div>
                        {expandedSections.includes(item.title) ? (
                          <ChevronDown className="h-4 w-4 transition-transform" />
                        ) : (
                          <ChevronRight className="h-4 w-4 transition-transform" />
                        )}
                      </button>
                      {expandedSections.includes(item.title) && (
                        <div className="ml-7 mt-1 space-y-1 border-l border-border pl-4">
                          {item.items.map((subItem) => {
                            if ('url' in subItem) {
                              return (
                                <Link
                                  key={subItem.title}
                                  href={subItem.url}
                                  onClick={onItemClick}
                                  aria-current={isActive(subItem.url) ? "page" : undefined}
                                  className={cn(
                                    "block rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                                    isActive(subItem.url) && "bg-accent text-accent-foreground font-medium",
                                  )}
                                >
                                  {subItem.title}
                                </Link>
                              )
                            }
                            const key = `${item.title}:${subItem.title}`
                            const expanded = expandedSections.includes(key)
                            return (
                              <div key={key}>
                                <button
                                  onClick={() => toggleSection(key)}
                                  className={cn(
                                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground",
                                    expanded && "bg-accent text-accent-foreground",
                                  )}
                                >
                                  <span>{subItem.title}</span>
                                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                                {expanded && (
                                  <div className="ml-4 mt-1 space-y-1 border-l border-border pl-3">
                                    {subItem.items.map((leaf) => (
                                      <Link
                                        key={leaf.title}
                                        href={leaf.url}
                                        onClick={onItemClick}
                                        aria-current={isActive(leaf.url) ? "page" : undefined}
                                        className={cn(
                                          "block rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                                          isActive(leaf.url) && "bg-accent text-accent-foreground font-medium",
                                        )}
                                      >
                                        {leaf.title}
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.url}
                      onClick={onItemClick}
                      aria-current={isActive(item.url) ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                        isActive(item.url) && "bg-accent text-accent-foreground",
                      )}
                    >
                      {(() => { const Icon = (item as NavLink).icon; return <Icon className="h-4 w-4" /> })()}
                      <span>{item.title}</span>
                    </Link>
                  )}
                </div>
              ))}
            </nav>
          </div>

          {/* Resources */}
          <div>
            <h4 className="mb-4 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Resources
            </h4>
            <nav className="space-y-1" role="navigation" aria-label="Resources">
              {resourceItems.map((item) => (
                <Link
                  key={item.title}
                  href={item.url}
                  onClick={onItemClick}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive(item.url) && "bg-accent text-accent-foreground font-medium",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </div>
                  {item.badge && (
                    <Badge variant="secondary" className="text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </ScrollArea>

      {/* Sidebar Footer */}
      <div className="border-t p-4">
        <div className="text-xs text-muted-foreground text-center">
          <div className="mb-2">{VERSION.version}</div>
          <Link
            href="https://github.com/Dendro-X0/OpenDeploy-CLI"
            className="hover:text-foreground transition-colors"
            target="_blank"
          >
            View Source
          </Link>
        </div>
      </div>
    </div>
  )
}

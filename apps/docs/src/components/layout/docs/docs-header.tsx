"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Github, ExternalLink, Menu, Package, Terminal, BookOpen } from "lucide-react"
import Link from "next/link"
import { ThemeToggleSwitch } from "@/components/theme/ThemeToggleSwitch"
import VERSION from "@/lib/version"

interface DocsHeaderProps {
  onMenuClick?: () => void
  sidebarOpen?: boolean
}

export function DocsHeader({ onMenuClick, sidebarOpen }: DocsHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 overflow-x-hidden">
        {/* Left side */}
        <div className="flex items-center gap-4 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={onMenuClick}
            aria-label="Toggle navigation"
            aria-controls="docs-sidebar"
            aria-expanded={Boolean(sidebarOpen)}
            aria-haspopup="menu"
          >
            <Menu className="h-4 w-4" />
            <span className="sr-only">Toggle menu</span>
          </Button>

          <Link href="/" aria-label="OpenDeploy home" className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground flex-shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="100%"
              height="100%"
              viewBox="0 0 64 64"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-label="OpenDeploy Stack"
            >
              <path d="M12 42 H36" />
              <path d="M16 34 H40" />
              <path d="M20 26 H44" />
              <path d="M40 46 L48 38 L56 46" />
            </svg>
          </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold whitespace-nowrap text-sm sm:text-base leading-tight">OpenDeploy CLI</span>
              <span className="text-[10px] text-muted-foreground truncate">{VERSION.version}</span>
            </div>
          </Link>

          {VERSION.isBeta && (
            <Badge variant="outline" className="hidden sm:inline-flex text-xs">
              Beta
            </Badge>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4 min-w-0">
          {/* Search */}
          <div className="relative max-w-sm w-full hidden sm:block" role="search">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" aria-label="Search documentation" placeholder="Search documentation..." className="pl-9 h-9" />
          </div>

          {/* Navigation (hidden on mobile to avoid overlap; visible from sm+) */}
          <nav className="hidden sm:flex items-center gap-2" aria-label="Header navigation">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/docs/opendeploy/overview">
                <BookOpen className="h-4 w-4" />
                <span className="sr-only">Documentation</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="https://github.com/Dendro-X0/OpenDeploy-CLI" target="_blank">
                <Github className="h-4 w-4" />
                <span className="sr-only">GitHub</span>
              </Link>
            </Button>
          </nav>
          <ThemeToggleSwitch />
        </div>
      </div>
    </header>
  )
}

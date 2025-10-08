"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Github,
  ExternalLink,
  Package,
  BookOpen,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import { ThemeToggleSwitch } from "@/components/theme/ThemeToggleSwitch";
import VERSION from "@/lib/version";
// Inline SVG so it inherits currentColor from the container

export function HomeHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        {/* Left side - Logo */}
        <Link href="/" className="flex items-center gap-3 min-w-0">
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
          {VERSION.isBeta && (
            <Badge
              variant="outline"
              className="hidden sm:inline-flex text-xs ml-2"
            >
              Beta
            </Badge>
          )}
        </Link>

        {/* Right side - Navigation */}
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link
              href="/docs/opendeploy/overview"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Documentation
            </Link>
            <Link
              href="/docs/opendeploy/ci"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              CI Recipes
            </Link>
            <Link
              href="https://github.com/Dendro-X0/OpenDeploy-CLI/issues"
              target="_blank"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Feedback
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/docs/opendeploy/overview">
                <BookOpen className="h-4 w-4" />
                <span className="sr-only">Documentation</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/docs/opendeploy/commands">
                <Terminal className="h-4 w-4" />
                <span className="sr-only">CLI Reference</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link
                href="https://github.com/Dendro-X0/OpenDeploy-CLI"
                target="_blank"
              >
                <Github className="h-4 w-4" />
                <span className="sr-only">GitHub</span>
              </Link>
            </Button>
            <ThemeToggleSwitch />
          </div>
        </div>
      </div>
    </header>
  );
}

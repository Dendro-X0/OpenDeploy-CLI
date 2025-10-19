import type { LucideIcon } from "lucide-react"
import { Home, Rocket, Terminal, Cloud, Code, FileText } from "lucide-react"

export type NavLeaf = { title: string; url: string }
export type NavSubGroup = { title: string; items: readonly NavLeaf[] }
export type NavLink = { title: string; icon: LucideIcon; url: string }
export type NavGroup = { title: string; icon: LucideIcon; items: readonly (NavLeaf | NavSubGroup)[] }
export type NavItem = NavLink | NavGroup

export const navigationItems: ReadonlyArray<NavItem> = [
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
      { title: "What's New (vNext)", url: "/docs/opendeploy/whats-new-vnext" },
      { title: "3 Steps: Vercel", url: "/docs/opendeploy/quickstart-vercel" },
      { title: "3 Steps: GitHub Pages", url: "/docs/opendeploy/quickstart-github-pages" },
      { title: "3 Steps: Cloudflare Pages", url: "/docs/opendeploy/quickstart-cloudflare" },
      { title: "Overview Quick Start", url: "/docs/opendeploy/overview#quick-start" },
      { title: "Roadmap", url: "/docs/opendeploy/roadmap" },
    ],
  },
  {
    title: "CLI",
    icon: Terminal,
    items: [
      { title: "Commands", url: "/docs/opendeploy/commands" },
      { title: "Scan", url: "/docs/opendeploy/commands/scan" },
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
      { title: "Cloudflare Pages", url: "/docs/opendeploy/providers/cloudflare" },
      { title: "GitHub Pages", url: "/docs/opendeploy/providers/github" },
    ],
  },
  {
    title: "Architecture",
    icon: FileText,
    items: [
      { title: "Output Contract", url: "/docs/opendeploy/architecture/output-contract" },
      { title: "NDJSON Consumption", url: "/docs/opendeploy/architecture/ndjson-consumption" },
      { title: "Doctor & Preflight", url: "/docs/opendeploy/doctor-preflight" },
      { title: "Providers vNext", url: "/docs/opendeploy/architecture/providers-vnext" },
      { title: "Plugin Authoring", url: "/docs/opendeploy/architecture/plugins/authoring" },
    ],
  },
] as const

export type ResourceItem = { title: string; url: string; icon: LucideIcon; badge?: string }
export const resourceItems: ReadonlyArray<ResourceItem> = [
  { title: "Changelog", url: "https://github.com/Dendro-X0/OpenDeploy-CLI/releases", icon: FileText, badge: "New" },
  { title: "GitHub", url: "https://github.com/Dendro-X0/OpenDeploy-CLI", icon: Code },
] as const

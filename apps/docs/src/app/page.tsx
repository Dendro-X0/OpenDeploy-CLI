import type React from "react"
import { HomeLayout } from "@/components/layout/home/home-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight, Code, Zap, Star, Rocket, Package, Terminal, Palette, Settings, MessageSquare } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { QuickStart } from "@/components/landing/quick-start"
import { VideoGallery } from "@/components/landing/video-gallery"
import { HeroStartCommand } from "@/components/landing/hero-start"
import { LogoWithBadge } from "@/components/landing/logo-with-badge"
import VERSION from "@/lib/version"

interface LogoProps {
  alt: string
  lightSrc: string
  darkSrc: string
  width: number
  height: number
  className?: string
}

/**
 * Render a brand logo in a fixed bounding box that looks visually consistent
 * across different aspect ratios. Automatically swaps light/dark variants.
 */
const Logo: React.FC<LogoProps> = ({ alt, lightSrc, darkSrc, width, height, className }) => {
  // Prefix with base path so images resolve on GitHub Pages subpaths
  const base: string = (process.env.NEXT_PUBLIC_BASE_PATH || '').trim()
  const light: string = `${base}${lightSrc}`
  const dark: string = `${base}${darkSrc}`
  return (
    <div
      className={cn("relative", className)}
      style={{ width: `${width}px`, height: `${height}px` }}
      aria-label={alt}
    >
      <Image src={light} alt={alt} fill className="object-contain dark:hidden" sizes={`${width}px`} unoptimized priority />
      <Image src={dark} alt={alt} fill className="hidden object-contain dark:block" sizes={`${width}px`} unoptimized priority />
    </div>
  )
}

export default function HomePage() {
  return (
    <HomeLayout>
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <section className="text-center py-20 px-4">
          <Badge variant="secondary" className="mb-6 text-sm px-4 py-2">
            <Star className="w-4 h-4 mr-2" />
            OpenDeploy CLI • {VERSION.version}
          </Badge>
          <h1 className="text-6xl font-bold tracking-tight mb-8 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-gray-100 dark:via-gray-300 dark:to-gray-100 bg-clip-text text-transparent">
            Fast, Friendly Deploys
            <br />
            for Modern Web Apps
          </h1>
          <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            A CLI for the modern web stack that makes it easy to detect your stack, sync environment variables, and deploy frameworks—
            including Next.js, Astro, SvelteKit, Nuxt, and Remix—to Vercel, Netlify, Cloudflare Pages, and GitHub Pages.
            100% open source and free. Secrets are redacted in human logs and JSON/NDJSON by default.
          </p>
          <div className="flex gap-4 justify-center flex-wrap mb-16">
            <Button asChild size="lg" className="h-14 px-8 text-base">
              <Link href="/docs/opendeploy/install">
                <Rocket className="mr-2 h-5 w-5" />
                Get Started
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="h-14 px-8 text-base bg-transparent" asChild>
              <Link href="/docs/opendeploy/overview">
                View Documentation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Prominent one-liner: start */}
          <div className="mb-10">
            <HeroStartCommand />
          </div>

          {/* Quick Start Commands */}
          <QuickStart />
        </section>

        {/* Video Tutorials */}
        <VideoGallery
          headline="Quick Tutorial Videos"
          subheadline="Short demos showing the Start wizard, CI/args, and troubleshooting a real project (coming soon)."
          videos={[
            { title: "60s Quick Deploy (Vercel)", platform: "youtube", id: "dQw4w9WgXcQ", durationSeconds: 60 },
            { title: "CI + JSON/NDJSON", platform: "youtube", id: "dQw4w9WgXcQ", durationSeconds: 90 },
            { title: "Troubleshooting & Fix (Docs Site)", platform: "youtube", id: "dQw4w9WgXcQ", durationSeconds: 120 },
            { title: "Monorepo App Selection", platform: "youtube", id: "dQw4w9WgXcQ", durationSeconds: 75 },
            { title: "Netlify Prepare-only", platform: "youtube", id: "dQw4w9WgXcQ", durationSeconds: 80 },
            { title: "Advanced Flags", platform: "youtube", id: "dQw4w9WgXcQ", durationSeconds: 110 }
          ]}
        />

        {/* Real Features */}
        <section className="py-20 px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6">What You Get with OpenDeploy CLI</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              CI‑ready workflows, environment parity, and readable deploy streams across Vercel, Netlify, Cloudflare Pages, and GitHub Pages.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader className="pb-4">
                <div className="w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Terminal className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-xl mb-2">Env Management</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Sync, pull, diff, and validate `.env` with filters and strict modes. Mapping and optimized writes included.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader className="pb-4">
                <div className="w-14 h-14 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Code className="h-7 w-7 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-xl mb-2">Dry‑run for CI</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Deterministic JSON summaries for every command. Validate outputs in CI without side effects.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader className="pb-4">
                <div className="w-14 h-14 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Zap className="h-7 w-7 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle className="text-xl mb-2">Deploy + Logs</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Stream deploys with NDJSON and timestamps. Emit `url` and `logsUrl` reliably across providers.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader className="pb-4">
                <div className="w-14 h-14 rounded-xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Package className="h-7 w-7 text-orange-600 dark:text-orange-400" />
                </div>
                <CardTitle className="text-xl mb-2">Monorepo Aware</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Chosen deploy cwd, link detection, and doctor checks for apps/* and root configs.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader className="pb-4">
                <div className="w-14 h-14 rounded-xl bg-cyan-100 dark:bg-cyan-900/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Settings className="h-7 w-7 text-cyan-700 dark:text-cyan-300" />
                </div>
                <CardTitle className="text-xl mb-2">Config Generation</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  One command to emit <code>vercel.json</code>, <code>netlify.toml</code> (Next runtime/Nuxt defaults), and <code>turbo.json</code> with smart caching.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader className="pb-4">
                <div className="w-14 h-14 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Rocket className="h-7 w-7 text-red-600 dark:text-red-400" />
                </div>
                <CardTitle className="text-xl mb-2">Provider Parity</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Vercel and Netlify linking, env, deploy, promote, and rollback behaviors with consistent JSON outputs.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader className="pb-4">
                <div className="w-14 h-14 rounded-xl bg-teal-100 dark:bg-teal-900/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Palette className="h-7 w-7 text-teal-600 dark:text-teal-400" />
                </div>
                <CardTitle className="text-xl mb-2">Output Modes</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  `--json`, `--ndjson`, `--summary-only`, `--timestamps`, `--quiet`, `--no-emoji`, plus `--verbose`, `--color`, `--json-file`, `--ndjson-file`, `--gha`.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* Supported Frameworks & Providers */}
        <section className="py-10 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <h3 className="text-4xl font-bold mb-8 mt-12 py-8 bg-gradient-to-r from-gray-800 to-purple-500 text-transparent bg-clip-text dark:from-gray-200 dark:to-yellow-500">Frameworks</h3>

            {/* Frameworks */}
            <div className="flex items-center justify-center gap-10 flex-wrap mb-6">
              <Logo alt="Next.js" lightSrc="/logo/Next.js_wordmark_light.svg" darkSrc="/logo/Next.js_wordmark_dark.svg" width={140} height={40} />
              <Logo alt="Astro" lightSrc="/logo/Astro_light.svg" darkSrc="/logo/Astro_dark.svg" width={140} height={40} />
              <Logo alt="SvelteKit" lightSrc="/logo/svelte.svg" darkSrc="/logo/svelte.svg" width={140} height={40} />
              <Logo alt="Nuxt" lightSrc="/logo/Nuxt_wordmark_light.svg" darkSrc="/logo/Nuxt_wordmark_dark.svg" width={140} height={40} />
              <LogoWithBadge alt="Remix" lightSrc="/logo/Remix_wordmark_light.svg" darkSrc="/logo/Remix_wordmark_dark.svg" width={140} height={40} badge="Beta" badgeVariant="yellow" />
            </div>
            

            <h3 className="text-4xl font-bold mb-8 mt-12 py-8 bg-gradient-to-r from-gray-800 to-blue-500 text-transparent bg-clip-text dark:from-gray-200 dark:to-green-500">Providers</h3>

            {/* Providers */}
            <div className="flex items-center justify-center gap-10 flex-wrap">
              <Logo alt="Vercel" lightSrc="/logo/Vercel_wordmark_light.svg" darkSrc="/logo/Vercel_wordmark_dark.svg" width={140} height={40} />
              <Logo alt="Cloudflare Pages" lightSrc="/logo/cloudflare.svg" darkSrc="/logo/cloudflare.svg" width={140} height={40} />
              <Logo alt="GitHub Pages" lightSrc="/logo/GitHub_light.svg" darkSrc="/logo/GitHub_dark.svg" width={140} height={40} />
            </div>
          </div>
        </section>

        {/* Open Source & Security */}
        <section className="py-20 px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Open Source & Security</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              OpenDeploy is permanently open source and free to use. Secrets are never printed: the CLI redacts sensitive values
              across human logs, JSON/NDJSON, and file sinks. Telemetry is disabled by default. Built for local and CI. See our
              {" "}
              <Link href="/docs/opendeploy/security" className="underline hover:no-underline">Security</Link>
              {" "} page for details.
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold mb-6">Ship Reliable Deploys in Minutes</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Detect your stack, generate provider configs, sync env safely, and deploy with confidence.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button asChild size="lg" className="h-14 px-8 text-base">
                <Link href="https://github.com/Dendro-X0/OpenDeploy-CLI/issues">
                  Feedback
                  <MessageSquare className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="h-14 px-8 text-base bg-transparent" asChild>
                <Link href="https://github.com/Dendro-X0/OpenDeploy-CLI" target="_blank">
                  View on GitHub
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="h-14 px-8 text-base bg-transparent" asChild>
                <Link href={`https://github.com/Dendro-X0/OpenDeploy-CLI/releases/tag/${VERSION.version}`} target="_blank">
                  Release Notes ({VERSION.version})
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </HomeLayout>
  )
}

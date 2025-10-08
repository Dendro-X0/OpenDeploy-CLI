import { Github } from "lucide-react"
import Link from "next/link"

export function DocsFooter() {
  return (
    <footer className="border-t bg-background mt-auto">
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Left side - Project info */}
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              © 2025 OpenDeploy CLI.
            </div>
          </div>

          {/* Right side - Links */}
          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-6 text-sm">
              <Link
                href="/docs/community/contributing"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Contributing
              </Link>
              <Link href="/docs/changelog" className="text-muted-foreground hover:text-foreground transition-colors">
                Changelog
              </Link>
              <Link
                href="https://github.com/Dendro-X0/OpenDeploy-CLI"
                className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Github className="h-4 w-4" />
                GitHub
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}

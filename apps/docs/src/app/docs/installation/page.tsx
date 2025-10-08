
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Terminal, Package, Download, CheckCircle, ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { DocsLayout } from "@/components/layout/docs/docs-layout"

const tableOfContents = [
  { id: "prerequisites", title: "Prerequisites", level: 2 },
  { id: "installation-options", title: "Installation Options", level: 2 },
  { id: "npm", title: "Using npm", level: 3 },
  { id: "yarn", title: "Using Yarn", level: 3 },
  { id: "pnpm", title: "Using pnpm", level: 3 },
  { id: "bun", title: "Using Bun", level: 3 },
  { id: "development-server", title: "Development Server", level: 2 },
  { id: "next-steps", title: "Next Steps", level: 2 },
]

export default function InstallationPage() {
  return (
    <DocsLayout showTableOfContents={true} tableOfContents={tableOfContents}>
      <article className="prose prose-gray dark:prose-invert max-w-none">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8 not-prose">
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link href="/docs" className="hover:text-foreground transition-colors">
            Documentation
          </Link>
          <span>/</span>
          <span className="text-foreground">Installation</span>
        </nav>

        {/* Header */}
        <header className="mb-12 not-prose">
          <Badge variant="secondary" className="mb-4">
            Getting Started
          </Badge>
          <h1 className="text-4xl font-bold mb-6 text-foreground" id="installation">
            Installation
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Get started with our documentation system in just a few minutes. Follow this comprehensive guide to set up
            your project with your preferred package manager.
          </p>
        </header>

        {/* Prerequisites */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-foreground" id="prerequisites">
            Prerequisites
          </h2>
          <Alert className="mb-6 not-prose">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-base">
              <strong>Requirements:</strong> Node.js 18+ and a package manager (npm, yarn, pnpm, or bun) installed on
              your system.
            </AlertDescription>
          </Alert>
          <p className="text-muted-foreground">
            Before you begin, ensure you have Node.js version 18 or higher installed on your machine. You can download
            it from{" "}
            <a
              href="https://nodejs.org"
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              nodejs.org
            </a>
            . Most package managers come bundled with Node.js, but you can also install them separately if needed.
          </p>
        </section>

        {/* Installation Options */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-foreground" id="installation-options">
            Installation Options
          </h2>
          <p className="text-muted-foreground mb-8">
            Choose your preferred package manager to get started. All options will create the same project structure and
            functionality.
          </p>

          <div className="not-prose">
            <Tabs defaultValue="npm" className="mb-8">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="npm" id="npm">
                  npm
                </TabsTrigger>
                <TabsTrigger value="yarn" id="yarn">
                  yarn
                </TabsTrigger>
                <TabsTrigger value="pnpm" id="pnpm">
                  pnpm
                </TabsTrigger>
                <TabsTrigger value="bun" id="bun">
                  bun
                </TabsTrigger>
              </TabsList>

              <TabsContent value="npm">
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                        <Package className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      Install with npm
                    </CardTitle>
                    <CardDescription className="text-base">
                      npm is the default package manager for Node.js and comes pre-installed.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6 font-mono text-sm space-y-4 border">
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 mb-2"># Create a new Next.js project</div>
                        <div className="text-gray-900 dark:text-gray-100">
                          npx create-next-app@latest my-docs --typescript --tailwind --eslint --app
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 mb-2"># Navigate to project directory</div>
                        <div className="text-gray-900 dark:text-gray-100">cd my-docs</div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 mb-2"># Install additional dependencies</div>
                        <div className="text-gray-900 dark:text-gray-100">
                          npm install @radix-ui/react-* lucide-react next-themes
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="yarn">
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                        <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      Install with Yarn
                    </CardTitle>
                    <CardDescription className="text-base">
                      Yarn is a fast, reliable, and secure dependency management tool.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6 font-mono text-sm space-y-4 border">
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 mb-2"># Create a new Next.js project</div>
                        <div className="text-gray-900 dark:text-gray-100">
                          yarn create next-app my-docs --typescript --tailwind --eslint --app
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 mb-2"># Navigate to project directory</div>
                        <div className="text-gray-900 dark:text-gray-100">cd my-docs</div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 mb-2"># Install additional dependencies</div>
                        <div className="text-gray-900 dark:text-gray-100">
                          yarn add @radix-ui/react-* lucide-react next-themes
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pnpm">
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                        <Package className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      Install with pnpm
                    </CardTitle>
                    <CardDescription className="text-base">
                      pnpm is a fast, disk space efficient package manager with strict dependency management.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6 font-mono text-sm space-y-4 border">
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 mb-2"># Create a new Next.js project</div>
                        <div className="text-gray-900 dark:text-gray-100">
                          pnpm create next-app my-docs --typescript --tailwind --eslint --app
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 mb-2"># Navigate to project directory</div>
                        <div className="text-gray-900 dark:text-gray-100">cd my-docs</div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 mb-2"># Install additional dependencies</div>
                        <div className="text-gray-900 dark:text-gray-100">
                          pnpm add @radix-ui/react-* lucide-react next-themes
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bun">
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                        <Package className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      Install with Bun
                    </CardTitle>
                    <CardDescription className="text-base">
                      Bun is an incredibly fast JavaScript runtime and package manager built from scratch.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6 font-mono text-sm space-y-4 border">
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 mb-2"># Create a new Next.js project</div>
                        <div className="text-gray-900 dark:text-gray-100">
                          bunx create-next-app my-docs --typescript --tailwind --eslint --app
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 mb-2"># Navigate to project directory</div>
                        <div className="text-gray-900 dark:text-gray-100">cd my-docs</div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 mb-2"># Install additional dependencies</div>
                        <div className="text-gray-900 dark:text-gray-100">
                          bun add @radix-ui/react-* lucide-react next-themes
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        {/* Development Server */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-foreground" id="development-server">
            Development Server
          </h2>
          <p className="text-muted-foreground mb-8">
            Once you've installed the dependencies, you can start the development server to see your documentation site
            in action.
          </p>

          <div className="grid md:grid-cols-2 gap-6 not-prose">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                    <Terminal className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  Start Development
                </CardTitle>
                <CardDescription className="text-base">
                  Launch the development server with hot reload for instant feedback.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 font-mono text-sm border mb-4">
                  npm run dev
                </div>
                <p className="text-sm text-muted-foreground">
                  Your documentation will be available at{" "}
                  <code className="bg-muted px-1 rounded text-xs">http://localhost:3000</code>
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                    <Download className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  Template Download
                </CardTitle>
                <CardDescription className="text-base">
                  Skip the setup and download our pre-configured template.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 font-mono text-sm border mb-4">
                  git clone https://github.com/your-org/docs-template.git
                </div>
                <p className="text-sm text-muted-foreground">
                  Clone our template repository to get started with a pre-configured setup.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Next Steps */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-foreground" id="next-steps">
            Next Steps
          </h2>

          <div className="not-prose">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>What's Next?</CardTitle>
                <CardDescription className="text-base">
                  Now that you have the documentation system installed, here are the recommended next steps:
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-4 text-base mb-8">
                  <li>
                    <strong>Customize Navigation:</strong> Update the sidebar navigation in{" "}
                    <code className="bg-muted px-2 py-1 rounded text-sm">components/docs-sidebar.tsx</code>
                  </li>
                  <li>
                    <strong>Project Information:</strong> Modify project details in{" "}
                    <code className="bg-muted px-2 py-1 rounded text-sm">app/layout.tsx</code>
                  </li>
                  <li>
                    <strong>Add Content:</strong> Create documentation pages in the{" "}
                    <code className="bg-muted px-2 py-1 rounded text-sm">app/docs/</code> directory
                  </li>
                  <li>
                    <strong>Customize Styling:</strong> Update themes and colors to match your project branding
                  </li>
                  <li>
                    <strong>Configure Features:</strong> Set up search functionality, analytics, and deployment
                  </li>
                </ol>
                <Button asChild>
                  <Link href="/docs/quick-start">
                    Continue to Quick Start Guide
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Navigation */}
        <nav className="flex justify-between items-center pt-8 border-t not-prose">
          <Button variant="ghost" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
          <Button asChild>
            <Link href="/docs/quick-start">
              Quick Start Guide
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </nav>
      </article>
    </DocsLayout>
  )
}

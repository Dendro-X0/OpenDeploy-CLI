
import { SidebarInset } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { FileText, Palette, Settings, ArrowRight, Lightbulb } from "lucide-react"
import Link from "next/link"
import { DocsSidebar } from "@/components/layout/docs/docs-sidebar"
import { DocsHeader } from "@/components/layout/docs/docs-header"
import { DocsFooter } from "@/components/layout/docs/docs-footer"

export default function QuickStartPage() {
  return (
    <>
      <DocsSidebar />
      <SidebarInset>
        <DocsHeader />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto px-6 py-8 max-w-4xl">
            <div className="mb-8">
              <Badge variant="secondary" className="mb-2">
                Getting Started
              </Badge>
              <h1 className="text-3xl font-bold mb-4">Quick Start Guide</h1>
              <p className="text-lg text-muted-foreground">
                Get your documentation site up and running in under 5 minutes with this comprehensive guide.
              </p>
            </div>

            <Alert className="mb-8">
              <Lightbulb className="h-4 w-4" />
              <AlertDescription>
                This guide assumes you've already completed the{" "}
                <Link href="/docs/installation" className="underline">
                  installation process
                </Link>
                .
              </AlertDescription>
            </Alert>

            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      1
                    </span>
                    Project Structure Overview
                  </CardTitle>
                  <CardDescription>
                    Understanding the modular architecture of your documentation system.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                    <div>my-docs/</div>
                    <div>├── app/</div>
                    <div>
                      │ ├── docs/ <span className="text-muted-foreground"># Documentation pages</span>
                    </div>
                    <div>
                      │ ├── layout.tsx <span className="text-muted-foreground"># Root layout</span>
                    </div>
                    <div>
                      │ └── page.tsx <span className="text-muted-foreground"># Homepage</span>
                    </div>
                    <div>├── components/</div>
                    <div>
                      │ ├── docs-sidebar.tsx <span className="text-muted-foreground"># Navigation sidebar</span>
                    </div>
                    <div>
                      │ ├── docs-header.tsx <span className="text-muted-foreground"># Header component</span>
                    </div>
                    <div>
                      │ └── docs-footer.tsx <span className="text-muted-foreground"># Footer component</span>
                    </div>
                    <div>
                      └── public/ <span className="text-muted-foreground"># Static assets</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      2
                    </span>
                    Customize Navigation
                  </CardTitle>
                  <CardDescription>Update the sidebar navigation to match your project structure.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">
                    Edit the <code className="bg-muted px-1 rounded">navigationItems</code> array in{" "}
                    <code className="bg-muted px-1 rounded">components/docs-sidebar.tsx</code>:
                  </p>
                  <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                    <div className="text-muted-foreground">// Add your own navigation structure</div>
                    <div>const navigationItems = [</div>
                    <div> {"{"}</div>
                    <div> title: "Your Section",</div>
                    <div> icon: YourIcon,</div>
                    <div> items: [</div>
                    <div> {'{ title: "Page 1", url: "/docs/page-1" }'},</div>
                    <div> {'{ title: "Page 2", url: "/docs/page-2" }'},</div>
                    <div> ],</div>
                    <div> {"},"},</div>
                    <div>]</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      3
                    </span>
                    Create Documentation Pages
                  </CardTitle>
                  <CardDescription>Add your content by creating new pages in the docs directory.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">
                    Create a new page at <code className="bg-muted px-1 rounded">app/docs/your-page/page.tsx</code>:
                  </p>
                  <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                    <div>export default function YourPage() {"{"}</div>
                    <div> return (</div>
                    <div> {"<>"}</div>
                    <div> {"<DocsSidebar />"}</div>
                    <div> {"<SidebarInset>"}</div>
                    <div> {"<DocsHeader />"}</div>
                    <div> {"<main>"}</div>
                    <div> {"//"} Your content here</div>
                    <div> {"</main>"}</div>
                    <div> {"<DocsFooter />"}</div>
                    <div> {"</SidebarInset>"}</div>
                    <div> {"</>"}</div>
                    <div> )</div>
                    <div>{"}"}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      4
                    </span>
                    Customize Branding
                  </CardTitle>
                  <CardDescription>Update colors, logos, and project information to match your brand.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Update Project Info</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Modify the project name and version in{" "}
                        <code className="bg-muted px-1 rounded">components/docs-sidebar.tsx</code>
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Customize Colors</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Update your theme colors in <code className="bg-muted px-1 rounded">app/globals.css</code>
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Add Your Logo</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Replace the package icon in the sidebar header with your project logo
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator className="my-8" />

            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Content Guide
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Learn how to structure and write effective documentation.
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/docs/guides/content">
                      Learn More <ArrowRight className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Theming
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Customize the look and feel to match your project.
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/docs/guides/theming">
                      Customize <ArrowRight className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Advanced Setup
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure search, analytics, and deployment options.
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/docs/guides/advanced">
                      Configure <ArrowRight className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
        <DocsFooter />
      </SidebarInset>
    </>
  )
}

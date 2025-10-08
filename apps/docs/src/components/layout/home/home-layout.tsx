import type React from "react"
import { HomeHeader } from "./home-header"
import { DocsFooter } from "../docs/docs-footer"

interface HomeLayoutProps {
  children: React.ReactNode
}

export function HomeLayout({ children }: HomeLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <HomeHeader />
      <main>{children}</main>
      <DocsFooter />
    </div>
  )
}

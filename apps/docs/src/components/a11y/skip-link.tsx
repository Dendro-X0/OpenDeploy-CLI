"use client"

import Link from "next/link"
import type { JSX } from "react"

/**
 * SkipLink renders a visually hidden anchor that becomes visible on focus,
 * allowing keyboard and screen reader users to jump straight to main content.
 */
export default function SkipLink(): JSX.Element {
  return (
    <Link
      href="#main-content"
      className="skip-link"
      aria-label="Skip to main content"
    >
      Skip to main content
    </Link>
  )
}

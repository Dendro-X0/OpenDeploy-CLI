import React from "react"
import Image from "next/image"

/**
 * LogoWithBadge renders a brand logo with automatic light/dark variants
 * and an optional small badge (e.g., "Beta").
 *
 * The component keeps visual consistency across different aspect ratios by
 * using a fixed bounding box sized via width/height props.
 */
export type BadgeVariant = "yellow" | "blue" | "green" | "red" | "gray"

interface LogoWithBadgeProps {
  readonly alt: string
  readonly lightSrc: string
  readonly darkSrc: string
  readonly width: number
  readonly height: number
  readonly badge?: string
  readonly badgeVariant?: BadgeVariant
  readonly className?: string
}

const BADGE_BG: Record<BadgeVariant, string> = {
  yellow: "bg-yellow-500/90 dark:bg-yellow-400/90",
  blue: "bg-blue-600/90 dark:bg-blue-500/90",
  green: "bg-green-600/90 dark:bg-green-500/90",
  red: "bg-red-600/90 dark:bg-red-500/90",
  gray: "bg-gray-600/90 dark:bg-gray-500/90",
} as const

export function LogoWithBadge({ alt, lightSrc, darkSrc, width, height, badge, badgeVariant = "yellow", className }: LogoWithBadgeProps): React.ReactElement {
  const base: string = (process.env.NEXT_PUBLIC_BASE_PATH || '').trim()
  const light: string = `${base}${lightSrc}`
  const dark: string = `${base}${darkSrc}`
  const textColor: string = badgeVariant === "yellow" ? "text-black" : "text-white"
  return (
    <div className={`relative ${className ?? ""}`} style={{ width: `${width}px`, height: `${height}px` }} aria-label={alt}>
      <Image src={light} alt={alt} fill className="object-contain dark:hidden" sizes={`${width}px`} />
      <Image src={dark} alt={alt} fill className="hidden object-contain dark:block" sizes={`${width}px`} />
      {badge ? (
        <span className={`absolute -top-2 -right-3 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow ${BADGE_BG[badgeVariant]} ${textColor}`}>
          {badge}
        </span>
      ) : null}
    </div>
  )
}

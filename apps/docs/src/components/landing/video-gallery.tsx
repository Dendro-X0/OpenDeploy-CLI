"use client"
import type React from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** A single video item to show in the gallery. */
export interface VideoItem {
  readonly title: string
  readonly platform: "youtube" | "vimeo"
  readonly id?: string
  readonly href?: string
  readonly durationSeconds?: number
  readonly comingSoon?: boolean
}

/** Props for the VideoGallery component. */
export interface VideoGalleryProps {
  readonly headline: string
  readonly subheadline?: string
  readonly videos: readonly VideoItem[]
  readonly className?: string
}

function secondsToClock(total: number | undefined): string {
  if (!total || total <= 0) return ""
  const m: number = Math.floor(total / 60)
  const s: number = total % 60
  const ss: string = s < 10 ? `0${s}` : String(s)
  return `${m}:${ss}`
}

function embedUrl(item: VideoItem): string {
  if (item.platform === "youtube" && item.id) return `https://www.youtube.com/embed/${item.id}`
  if (item.platform === "vimeo" && item.id) return `https://player.vimeo.com/video/${item.id}`
  return ""
}

function externalWatchUrl(item: VideoItem): string | undefined {
  if (item.href) return item.href
  if (item.platform === "youtube" && item.id) return `https://www.youtube.com/watch?v=${item.id}`
  if (item.platform === "vimeo" && item.id) return `https://vimeo.com/${item.id}`
  return undefined
}

function VideoCard(item: VideoItem): React.ReactElement {
  const url: string = embedUrl(item)
  const watch: string | undefined = externalWatchUrl(item)
  const duration: string = secondsToClock(item.durationSeconds)
  const showEmbed: boolean = Boolean(url)
  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{item.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={cn("w-full rounded-lg overflow-hidden bg-black/5 dark:bg-white/5", "border border-border")}
             style={{ aspectRatio: "16 / 9" }}>
          {showEmbed ? (
            <iframe
              title={item.title}
              src={url}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              {item.comingSoon ? "Coming soon" : "Video unavailable"}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{duration}</div>
          {watch ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={watch} target="_blank" rel="noreferrer">Watch</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Render a responsive gallery of product demo videos.
 */
export function VideoGallery(props: VideoGalleryProps): React.ReactElement {
  const { headline, subheadline, videos, className } = props
  return (
    <section className={cn("py-20 px-4", className)}>
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-4">{headline}</h2>
        {subheadline ? (
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">{subheadline}</p>
        ) : null}
      </div>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {videos.map((v: VideoItem, i: number) => (
          <VideoCard key={`${v.title}-${i}`} {...v} />
        ))}
      </div>
    </section>
  )
}

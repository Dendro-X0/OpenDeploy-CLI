"use client"

import { useState, useRef, useEffect, type HTMLAttributes, type ReactElement } from "react"
import { Button } from "@/components/ui/button"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

function getCodeText(el: HTMLElement | null): string {
  if (!el) return ""
  if (el.tagName.toLowerCase() === "code") return el.textContent ?? ""
  const code = el.querySelector("code")
  return code?.textContent ?? ""
}

function getLanguage(el: HTMLElement | null, fallbackClass?: string): string | null {
  const cls = [
    el?.className ?? "",
    el?.querySelector("code")?.className ?? "",
    fallbackClass ?? "",
  ]
    .filter(Boolean)
    .join(" ")
  const m = cls.match(/language-([a-z0-9+\-]+)/i)
  return m?.[1] ?? null
}

export function CodeBlock(props: HTMLAttributes<HTMLPreElement>): ReactElement {
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement | null>(null)
  const [lang, setLang] = useState<string | null>(getLanguage(null, props.className))

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1200)
    return () => clearTimeout(t)
  }, [copied])

  useEffect(() => {
    setLang(getLanguage(preRef.current, props.className))
  }, [props.className])

  const onCopy = async (): Promise<void> => {
    const text = getCodeText(preRef.current)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // ignore
    }
  }

  return (
    <div className="not-prose my-4 rounded-lg border border-border w-full min-w-0 overflow-x-auto overflow-y-hidden">
      <div className="flex items-center justify-between bg-foreground/5 px-3 py-1.5 border-b border-border">
        <div className="text-[10px] uppercase tracking-wide text-foreground/70">
          {lang ?? "code"}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCopy}
          className="h-7 px-2 text-xs border border-border bg-background/70 hover:bg-background/90"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </>
          )}
        </Button>
      </div>
      <pre
        ref={preRef}
        {...props}
        className={cn("m-0 !rounded-none overflow-auto max-w-full", props.className)}
      />
    </div>
  )
}

export function extractVercelInspectUrl(text: string): string | undefined {
  if (!text) return undefined
  const re = /https?:\/\/[^\s]*vercel\.com[^\s]*/g
  const m = text.match(re)
  return m && m.length > 0 ? m[0] : undefined
}

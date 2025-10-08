export async function mapLimit<T, R>(items: readonly T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<readonly R[]> {
  const n: number = Math.max(1, Math.floor(limit) || 1)
  const results: R[] = new Array(items.length)
  let next = 0
  async function start(): Promise<void> {
    const idx = next++
    if (idx >= items.length) return
    try {
      results[idx] = await worker(items[idx] as T, idx)
    } finally {
      await start()
    }
  }
  const runners: Promise<void>[] = []
  for (let i = 0; i < Math.min(n, items.length); i++) runners.push(start())
  await Promise.all(runners)
  return results
}

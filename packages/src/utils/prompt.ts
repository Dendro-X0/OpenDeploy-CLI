import { createInterface } from 'node:readline'

export interface ConfirmOptions { readonly defaultYes?: boolean }

function normalize(answer: string): string { return answer.trim().toLowerCase() }

export async function confirm(question: string, opts: ConfirmOptions = {}): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const suffix: string = opts.defaultYes === false ? ' [y/N] ' : ' [Y/n] '
  const q: string = `${question}${suffix}`
  const result: boolean = await new Promise<boolean>((resolve) => {
    rl.question(q, (ans: string) => {
      const val: string = normalize(ans)
      if (val === '' && (opts.defaultYes === undefined || opts.defaultYes === true)) return resolve(true)
      if (val === 'y' || val === 'yes') return resolve(true)
      resolve(false)
    })
  })
  rl.close()
  return result
}

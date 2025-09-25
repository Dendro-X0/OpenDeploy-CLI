export type ColorMode = 'auto' | 'always' | 'never'

let mode: ColorMode = 'auto'

function supportsColor(): boolean {
  if (mode === 'always') return true
  if (mode === 'never') return false
  return Boolean(process.stdout && process.stdout.isTTY)
}

export function setColorMode(m: ColorMode): void { mode = m }

function wrap(codeOpen: string, codeClose: string, text: string): string {
  if (!supportsColor()) return text
  return `\u001b[${codeOpen}m${text}\u001b[${codeClose}m`
}

export const colors = {
  green: (s: string): string => wrap('32', '39', s),
  yellow: (s: string): string => wrap('33', '39', s),
  // Use bright cyan to render as light blue in most terminals
  cyan: (s: string): string => wrap('96', '39', s),
  blue: (s: string): string => wrap('34', '39', s),
  red: (s: string): string => wrap('31', '39', s),
  dim: (s: string): string => wrap('2', '22', s),
  bold: (s: string): string => wrap('1', '22', s)
}

export function colorize(kind: 'green' | 'yellow' | 'cyan' | 'blue' | 'red' | 'dim' | 'bold', s: string): string {
  return colors[kind](s)
}

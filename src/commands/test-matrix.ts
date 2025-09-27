import { Command } from 'commander'
import { logger } from '../utils/logger'
import { proc } from '../utils/process'

interface MatrixOptions { readonly local?: boolean }

function volArg(cwd: string): string { return `${cwd}:/workspace` }

async function runDockerNode(args: { readonly image: string; readonly cwd: string }): Promise<boolean> {
  const vol = volArg(args.cwd)
  const cmd = [
    'docker run --rm',
    `-e CI=1 -e FORCE_COLOR=0 -e TZ=UTC -e LC_ALL=C`,
    `-v "${vol}" -w /workspace`,
    args.image,
    'bash -lc',
    '"corepack enable && corepack prepare pnpm@10.13.1 --activate && pnpm install --frozen-lockfile && pnpm test -- --reporter=dot"'
  ].join(' ')
  logger.info(`$ ${cmd}`)
  const res = await proc.run({ cmd })
  if (!res.ok) logger.error(res.stderr || res.stdout || 'docker run failed')
  return res.ok
}

export function registerTestMatrixCommand(program: Command): void {
  program
    .command('test-matrix')
    .description('Run the test matrix locally (Node 18/20/22 in Docker; experimental OS parity)')
    .option('--local', 'Run locally using Docker if available')
    .action(async (opts: MatrixOptions): Promise<void> => {
      const cwd: string = process.cwd()
      if (opts.local !== true) {
        logger.info('Use --local to run matrix locally. Remote CI matrix is configured in GitHub Actions.')
        return
      }
      // Check docker
      const hasDocker = await proc.has('docker')
      if (!hasDocker) {
        logger.warn('Docker not found. Running tests once on host instead.')
        const r = await proc.run({ cmd: 'pnpm test -- --reporter=dot', cwd })
        if (!r.ok) process.exitCode = 1
        return
      }
      const ok18 = await runDockerNode({ image: 'node:18', cwd })
      const ok20 = await runDockerNode({ image: 'node:20', cwd })
      const ok22 = await runDockerNode({ image: 'node:22', cwd })
      // Optionally, users can try a Windows container if their Docker setup supports it (local-only)
      // Example image: mcr.microsoft.com/windows/nanoserver:ltsc2022 (requires custom steps)
      // We keep this commented to avoid failures on hosts without Windows container support.
      if (!(ok18 && ok20 && ok22)) process.exitCode = 1
    })
}

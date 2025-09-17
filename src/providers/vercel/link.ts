import { proc } from '../../utils/process'

export async function ensureLinked(args: { readonly cwd: string; readonly projectId?: string; readonly orgId?: string }): Promise<void> {
  const flags: string[] = ['--yes']
  if (args.projectId) flags.push(`--project ${args.projectId}`)
  if (args.orgId) flags.push(`--org ${args.orgId}`)
  const res = await proc.run({ cmd: `vercel link ${flags.join(' ')}`.trim(), cwd: args.cwd })
  if (!res.ok && !res.stdout.toLowerCase().includes('already linked')) {
    throw new Error('Project not linked to Vercel. Run: vercel link')
  }
}

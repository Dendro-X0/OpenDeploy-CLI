/**
 * ProjectRef identifies a project/site/app on a provider.
 * One export per file as per repository code standards.
 */
export interface ProjectRef {
  readonly projectId?: string
  readonly orgId?: string
  readonly slug?: string
}

export interface PackageJson {
  readonly name?: string
  readonly version?: string
  readonly private?: boolean
  readonly scripts?: Readonly<Record<string, string>>
  readonly dependencies?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
  readonly workspaces?: readonly string[] | Readonly<{ readonly packages?: readonly string[] }>
}

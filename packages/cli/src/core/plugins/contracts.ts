/*
 * Plugin contracts for stacks (frameworks) and providers.
 * These contracts are versioned; do not break minor/patch.
 */

export const PLUGIN_API_VERSION = '1.0.0';

export type PackageManager = 'pnpm' | 'yarn' | 'npm' | 'bun';

export interface StackDetectResult {
  readonly matchScore: number; // 0..100
  readonly rootDir: string;
  readonly framework: string; // e.g., 'vite', 'next'
  readonly isMonorepo: boolean;
  readonly packageManager: PackageManager;
  readonly configFiles: readonly string[];
  readonly environmentFiles: readonly string[];
  readonly buildCommand: readonly string[]; // e.g., ['pnpm','build']
  readonly outputDir: string; // absolute or project-relative
  readonly staticExport: boolean;
  readonly notes?: readonly string[];
}

export interface StackBuildOptions {
  readonly cwd: string;
  readonly env: Readonly<Record<string, string>>;
  readonly json: boolean;
  readonly ndjson: boolean;
  readonly ci: boolean;
  readonly timeoutMs?: number;
}

export interface StackBuildResult {
  readonly ok: boolean;
  readonly outputDir: string;
  readonly staticExport: boolean;
  readonly artifacts?: readonly string[];
  readonly final?: true;
}

export interface StackPlugin {
  detect(args: { readonly cwd: string }): Promise<StackDetectResult | undefined>;
  build(args: StackBuildOptions): Promise<StackBuildResult>;
  verify?(args: { readonly cwd: string; readonly outputDir: string }): Promise<readonly string[]>; // warnings
  envHints?(): ReadonlyArray<string>;
}

export interface ProviderCapabilities {
  readonly name: string;
  readonly supportsLocalBuild: boolean;
  readonly supportsRemoteBuild: boolean;
  readonly supportsStaticDeploy: boolean;
  readonly supportsServerless: boolean;
  readonly supportsLogsFollow: boolean;
  readonly supportsAliasDomains: boolean;
  readonly supportsRollback: boolean;
}

/** Context provided to provider plugins to ensure consistent logging and redaction */
export interface ProviderContext {
  readonly cwd: string;
  readonly json: boolean;
  readonly ndjson: boolean;
  readonly ci: boolean;
  readonly log: {
    readonly info: (msg: string) => void;
    readonly warn: (msg: string) => void;
    readonly error: (msg: string) => void;
    readonly success: (msg: string) => void;
    readonly note: (msg: string) => void;
  };
  readonly nd: (event: Record<string, unknown>) => void; // emits redacted NDJSON/JSON
}

export interface ProviderDeployArgs {
  readonly cwd: string;
  readonly outputDir: string;
  readonly target: 'preview' | 'prod';
  readonly env: Readonly<Record<string, string>>;
  readonly json: boolean;
  readonly ndjson: boolean;
  readonly ci: boolean;
}

export interface ProviderDeployResult {
  readonly ok: boolean;
  readonly url?: string;
  readonly logsUrl?: string;
  readonly id?: string;
  readonly final?: true;
}

export interface ProviderPlugin {
  setContext?(ctx: ProviderContext): void;
  getCapabilities(): ProviderCapabilities;
  validateAuth(args: { readonly json: boolean; readonly ndjson: boolean; readonly ci: boolean }): Promise<void>;
  link?(args: { readonly cwd: string; readonly project?: string; readonly org?: string }): Promise<void>;
  deployStatic(args: ProviderDeployArgs): Promise<ProviderDeployResult>;
  deployServer?(args: ProviderDeployArgs): Promise<ProviderDeployResult>;
  logs?(args: { readonly id?: string; readonly follow?: boolean; readonly json: boolean }): Promise<void>;
}

export type StackPluginModule = { readonly plugin: StackPlugin; readonly version: string };
export type ProviderPluginModule = { readonly id: string; readonly plugin: ProviderPlugin; readonly version: string };

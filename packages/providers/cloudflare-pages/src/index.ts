/**
 * @packageDocumentation
 * Cloudflare Pages provider (vNext) implementing @opendeploy/core Provider.
 * MVP: static/Next on Pages deploy via wrangler; minimal detection and artifact resolution.
 */

import { join } from "node:path";
import { readFile, stat, writeFile } from "node:fs/promises";
import type {
  Provider,
  ProviderCapabilities,
  Detected,
  BuildInputs,
  BuildResult,
  DeployInputs,
  DeployResult,
  GenerateArgs,
  Hint
} from "@opendeploy/core";
import { NodeProcessRunner, type ProcessRunner } from "@opendeploy/core";

/** Test file/directory existence. */
async function exists(path: string): Promise<boolean> {
  try { const s = await stat(path); return s.isFile() || s.isDirectory(); } catch { return false }
}

/** Slugify a project name from a path. */
function slugify(base: string): string {
  return base.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-").replace(/^-+|-+$/g, "");
}

/** Extract `name = "..."` from wrangler.toml (best effort). */
async function readWranglerName(cwd: string): Promise<string | undefined> {
  try {
    const p = join(cwd, "wrangler.toml");
    if (!(await exists(p))) return undefined;
    const raw = await readFile(p, "utf8");
    const m = raw.match(/\bname\s*=\s*"([^"]+)"/);
    if (m && m[1]) return m[1];
  } catch { /* ignore */ }
  return undefined;
}

/** Retrieve Cloudflare account id via `wrangler whoami`. */
async function getAccountId(runner: ProcessRunner, cwd: string): Promise<string | undefined> {
  const res = await runner.exec("wrangler", ["whoami"], { cwd, timeoutMs: 60_000 });
  if (!res.ok) return undefined;
  const text: string = (res.stdout + "\n" + res.stderr).trim();
  const m = text.match(/account\s*id\s*[:=]\s*([a-z0-9]+)/i);
  return m?.[1];
}

/** Get the most recent Pages deployment info as JSON (best-effort). */
async function getLatestDeployment(runner: ProcessRunner, cwd: string, projectName: string): Promise<{ readonly id?: string; readonly url?: string }> {
  const res = await runner.exec("wrangler", ["pages", "deployments", "list", "--project-name", projectName, "--json"], { cwd, timeoutMs: 120_000 });
  if (!res.ok) return {};
  try {
    const arr = JSON.parse(res.stdout) as Array<{ readonly id?: string; readonly url?: string; readonly is_current?: boolean }>;
    if (!Array.isArray(arr) || arr.length === 0) return {};
    const chosen = arr.find(d => d.is_current === true) ?? arr[0];
    return { id: chosen?.id, url: chosen?.url };
  } catch {
    return {};
  }
}

/**
 * Try to infer framework and publishDir using simple heuristics.
 */
async function detectSimple(cwd: string): Promise<Detected> {
  // Next.js: next.config.* present → publishDir .vercel/output/static (Next on Pages)
  const nextFiles: readonly string[] = ["next.config.ts", "next.config.js", "next.config.mjs"];
  for (const f of nextFiles) {
    const p: string = join(cwd, f);
    if (await exists(p)) return { framework: "next", publishDir: ".vercel/output/static" };
  }
  // SvelteKit: prefer build/
  const svelteFiles: readonly string[] = ["svelte.config.ts", "svelte.config.js"];
  for (const f of svelteFiles) {
    const p: string = join(cwd, f);
    if (await exists(p)) return { framework: "sveltekit", publishDir: "build" };
  }
  // Astro: prefer dist/
  const astroFiles: readonly string[] = ["astro.config.ts", "astro.config.mjs", "astro.config.js"];
  for (const f of astroFiles) {
    const p: string = join(cwd, f);
    if (await exists(p)) return { framework: "astro", publishDir: "dist" };
  }
  // Artifact directories
  const dirs: readonly string[] = [".vercel/output/static", "dist", "build", "out", "public"];
  for (const d of dirs) { if (await exists(join(cwd, d))) return { publishDir: d } }
  return {};
}

/**
 * @public
 * Cloudflare Pages provider for MVP.
 */
export class CloudflarePagesProvider implements Provider {
  /** @inheritdoc */
  public readonly id: "cloudflare-pages" = "cloudflare-pages";
  private readonly runner: ProcessRunner;

  public constructor(runner?: ProcessRunner) {
    this.runner = runner ?? new NodeProcessRunner();
  }

  /** @inheritdoc */
  public getCapabilities(): ProviderCapabilities {
    return {
      name: "Cloudflare Pages",
      supportsLocalBuild: true,
      supportsRemoteBuild: false,
      supportsStaticDeploy: true,
      supportsSsr: false,
      supportsLogsFollow: false
    };
  }

  /** @inheritdoc */
  public async detect(cwd: string): Promise<Detected> {
    return await detectSimple(cwd);
  }

  /** @inheritdoc */
  public async build(args: BuildInputs): Promise<BuildResult> {
    // MVP: do not run user builds; resolve an artifact directory
    const candidates: string[] = [];
    if (args.publishDirHint) candidates.push(args.publishDirHint);
    candidates.push(".vercel/output/static", "dist", "build", "out", "public");
    for (const dir of candidates) {
      const full: string = join(args.cwd, dir);
      if (await exists(full)) return { ok: true, artifactDir: full };
    }
    const hint: string = args.publishDirHint ? join(args.cwd, args.publishDirHint) : join(args.cwd, ".vercel/output/static");
    return { ok: true, artifactDir: hint };
  }

  /** @inheritdoc */
  public async deploy(args: DeployInputs): Promise<DeployResult> {
    const runner: ProcessRunner = this.runner;
    const artifact: string = args.artifactDir ?? join(args.cwd, ".vercel/output/static");
    let projectName: string | undefined = await readWranglerName(args.cwd);
    if (!projectName) {
      const base = args.cwd.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "site";
      projectName = slugify(base);
    }
    // wrangler pages deploy <artifact> --project-name <name>
    const res = await runner.exec("wrangler", ["pages", "deploy", artifact, "--project-name", projectName], { cwd: args.cwd, timeoutMs: (args.timeoutSeconds ?? 600) * 1000 });
    if (!res.ok) {
      const msg: string = (res.stderr || res.stdout).trim() || "Cloudflare Pages deploy failed";
      return { ok: false, message: msg };
    }
    // Best-effort URL and logs URL inference
    const url: string = `https://${projectName}.pages.dev`;
    let logsUrl: string | undefined;
    try {
      const accountId: string | undefined = await getAccountId(runner, args.cwd);
      const latest = await getLatestDeployment(runner, args.cwd, projectName);
      if (accountId && latest.id) logsUrl = `https://dash.cloudflare.com/${accountId}/pages/view/${projectName}/${latest.id}`;
      else if (accountId) logsUrl = `https://dash.cloudflare.com/${accountId}/pages/view/${projectName}`;
    } catch { /* ignore */ }
    return { ok: true, url, logsUrl };
  }

  /** @inheritdoc */
  public async generateConfig(args: GenerateArgs): Promise<string> {
    // Write wrangler.toml for Next on Pages by default (safe for other static sites; directories are ignored if not used)
    const p: string = join(args.cwd, "wrangler.toml");
    const base = args.cwd.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "site";
    const name = slugify(base);
    const body = `# Auto-generated by OpenDeploy CLI (Cloudflare Pages — Next on Pages)\n` +
      `# Install the builder:\n#   pnpm add -D @cloudflare/next-on-pages\n` +
      `# Build locally:\n#   npx @cloudflare/next-on-pages@1\n` +
      `# Deploy locally:\n#   wrangler pages deploy .vercel/output/static --project-name ${name}\n` +
      `name = "${name}"\n` +
      `pages_build_output_dir = ".vercel/output/static"\n` +
      `pages_functions_directory = ".vercel/output/functions"\n` +
      `compatibility_date = "2024-01-01"\n` +
      `compatibility_flags = ["nodejs_compat"]\n`;
    if (args.overwrite === true || !(await exists(p))) {
      await writeFile(p, body, "utf8");
    }
    return p;
  }
}

export type { Provider, ProviderCapabilities, Detected, BuildInputs, BuildResult, DeployInputs, DeployResult, GenerateArgs, Hint };

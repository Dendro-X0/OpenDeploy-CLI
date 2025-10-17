/**
 * @packageDocumentation
 * GitHub Pages provider (vNext) implementing @opendeploy/core Provider.
 * MVP: static-only deploy via gh-pages; minimal detection and artifact resolution.
 */

import { join } from "node:path";
import { stat, writeFile } from "node:fs/promises";
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

/** Test file existence. */
async function exists(path: string): Promise<boolean> {
  try { const s = await stat(path); return s.isFile() || s.isDirectory(); } catch { return false }
}

/** Parse a GitHub remote URL (https or ssh) into owner/repo. */
function parseGitRemote(remote: string): { readonly owner?: string; readonly repo?: string } {
  const t = remote.trim();
  const httpsRe = /^https?:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/i;
  const m1 = t.match(httpsRe);
  if (m1) return { owner: m1[1], repo: m1[2] };
  const sshRe = /^git@github\.com:(.+?)\/(.+?)(?:\.git)?$/i;
  const m2 = t.match(sshRe);
  if (m2) return { owner: m2[1], repo: m2[2] };
  return {};
}

/**
 * Resolve a gh-pages invocation as bin + args prefix.
 * Prefers local/global gh-pages; falls back to `npx -y gh-pages`.
 */
async function resolveGhPages(runner: ProcessRunner, cwd: string): Promise<{ readonly bin: string; readonly prefix: readonly string[] }> {
  // Direct gh-pages (Node spawn resolves .cmd on Windows)
  const direct = await runner.exec("gh-pages", ["--help"], { cwd, timeoutMs: 10_000 });
  if (direct.ok) return { bin: "gh-pages", prefix: [] };
  // Fallback to npx
  const npx = await runner.exec("npx", ["-y", "gh-pages", "--help"], { cwd, timeoutMs: 10_000 });
  if (npx.ok) return { bin: "npx", prefix: ["-y", "gh-pages"] };
  // Final fallback (let OS error surface)
  return { bin: "gh-pages", prefix: [] };
}

/**
 * Try to infer framework and publishDir using simple heuristics.
 */
async function detectSimple(cwd: string): Promise<Detected> {
  // Next.js: next.config.* present → publishDir out
  const nextFiles: readonly string[] = ["next.config.ts", "next.config.js", "next.config.mjs"];
  for (const f of nextFiles) {
    const p: string = join(cwd, f);
    if (await exists(p)) return { framework: "next", publishDir: "out" };
  }
  // Astro
  const astroFiles: readonly string[] = ["astro.config.ts", "astro.config.mjs", "astro.config.js"];
  for (const f of astroFiles) {
    const p: string = join(cwd, f);
    if (await exists(p)) return { framework: "astro", publishDir: "dist" };
  }
  // SvelteKit
  const svelteFiles: readonly string[] = ["svelte.config.ts", "svelte.config.js"];
  for (const f of svelteFiles) {
    const p: string = join(cwd, f);
    if (await exists(p)) return { framework: "sveltekit", publishDir: "build" };
  }
  // Artifact directories
  const dirs: readonly string[] = ["dist", "build", "out", "public"];
  for (const d of dirs) { if (await exists(join(cwd, d))) return { publishDir: d } }
  return {};
}

/**
 * @public
 * GitHub Pages provider (static-only) for MVP.
 */
export class GithubPagesProvider implements Provider {
  /** @inheritdoc */
  public readonly id: "github-pages" = "github-pages";
  private readonly runner: ProcessRunner;

  public constructor(runner?: ProcessRunner) {
    this.runner = runner ?? new NodeProcessRunner();
  }

  /** @inheritdoc */
  public getCapabilities(): ProviderCapabilities {
    return {
      name: "GitHub Pages",
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
    candidates.push("dist", "build", "out", "public");
    for (const dir of candidates) {
      const full: string = join(args.cwd, dir);
      if (await exists(full)) return { ok: true, artifactDir: full };
    }
    const hint: string = args.publishDirHint ? join(args.cwd, args.publishDirHint) : join(args.cwd, "dist");
    return { ok: true, artifactDir: hint };
  }

  /** @inheritdoc */
  public async deploy(args: DeployInputs): Promise<DeployResult> {
    const runner: ProcessRunner = this.runner;
    const dir: string = args.artifactDir ?? join(args.cwd, "dist");
    // Ensure .nojekyll exists in artifact
    try { const marker: string = join(dir, ".nojekyll"); if (!(await exists(marker))) await writeFile(marker, "", "utf8"); } catch { /* ignore */ }
    // Resolve gh-pages bin
    const gh = await resolveGhPages(runner, args.cwd);
    const bin: string = gh.bin;
    const prefix: readonly string[] = gh.prefix;
    const res = await runner.exec(bin, [...prefix, "-d", dir, "--dotfiles"], { cwd: args.cwd, timeoutMs: (args.timeoutSeconds ?? 300) * 1000 });
    if (!res.ok) {
      const msg: string = (res.stderr || res.stdout).trim() || "GitHub Pages deploy failed";
      return { ok: false, message: msg };
    }
    // Infer public URL from git remote when available
    try {
      const g = await runner.exec("git", ["remote", "get-url", "origin"], { cwd: args.cwd, timeoutMs: 10_000 });
      if (g.ok) {
        const { owner, repo } = parseGitRemote(g.stdout || g.stderr || "");
        if (owner && repo) {
          const url = `https://${owner}.github.io/${repo}/`;
          return { ok: true, url };
        }
      }
    } catch { /* ignore */ }
    return { ok: true };
  }

  /** @inheritdoc */
  public async generateConfig(args: GenerateArgs): Promise<string> {
    const p: string = join(args.cwd, ".nojekyll");
    // only write when overwrite true or file is missing
    if (args.overwrite === true || !(await exists(p))) {
      await writeFile(p, "", "utf8");
    }
    return p;
  }
}

export type { Provider, ProviderCapabilities, Detected, BuildInputs, BuildResult, DeployInputs, DeployResult, GenerateArgs, Hint };

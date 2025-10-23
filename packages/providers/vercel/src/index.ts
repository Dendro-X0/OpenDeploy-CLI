/**
 * @packageDocumentation
 * Vercel provider (vNext) implementing @opendeploy/core Provider.
 * MVP: static/standard deploy via the Vercel CLI; minimal detection and artifact resolution.
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

/** Try to detect framework and publishDir with light heuristics. */
async function detectSimple(cwd: string): Promise<Detected> {
  // Next.js
  const nextFiles: readonly string[] = ["next.config.ts", "next.config.js", "next.config.mjs"];
  for (const f of nextFiles) { if (await exists(join(cwd, f))) return { framework: "next" } }
  // Astro
  const astroFiles: readonly string[] = ["astro.config.ts", "astro.config.mjs", "astro.config.js"];
  for (const f of astroFiles) { if (await exists(join(cwd, f))) return { framework: "astro", publishDir: "dist" } }
  // SvelteKit
  const svelteFiles: readonly string[] = ["svelte.config.ts", "svelte.config.js"];
  for (const f of svelteFiles) { if (await exists(join(cwd, f))) return { framework: "sveltekit", publishDir: "build" } }
  // Fallback: common artifact dirs
  const dirs: readonly string[] = ["dist", "build", "out", ".vercel/output/static", "public"];
  for (const d of dirs) { if (await exists(join(cwd, d))) return { publishDir: d } }
  return {};
}

/** Extract a likely Inspect URL from Vercel CLI output. */
function extractInspectUrl(text: string): string | undefined {
  const re = /https?:\/\/[^\s]*vercel\.com[^\s]*/g;
  const m = text.match(re);
  return m && m.length > 0 ? m[0] : undefined;
}

/** Extract a likely deployment URL from Vercel CLI output. */
function extractDeployUrl(text: string): string | undefined {
  const re = /https?:\/\/[^\s]+vercel\.app/g;
  const m = text.match(re);
  return m && m.length > 0 ? m[0] : undefined;
}

/**
 * @public
 * Vercel provider for MVP (CLI-based deploys).
 */
export class VercelProvider implements Provider {
  /** @inheritdoc */
  public readonly id: "vercel" = "vercel";
  private readonly runner: ProcessRunner;

  public constructor(runner?: ProcessRunner) {
    this.runner = runner ?? new NodeProcessRunner();
  }

  /** @inheritdoc */
  public getCapabilities(): ProviderCapabilities {
    return {
      name: "Vercel",
      supportsLocalBuild: true,
      supportsRemoteBuild: true,
      supportsStaticDeploy: true,
      supportsSsr: true,
      supportsLogsFollow: true
    };
  }

  /** @inheritdoc */
  public async detect(cwd: string): Promise<Detected> {
    return await detectSimple(cwd);
  }

  /** @inheritdoc */
  public async build(args: BuildInputs): Promise<BuildResult> {
    // MVP: do not run user builds here; deploy step can decide prebuilt vs remote
    const candidates: string[] = [];
    if (args.publishDirHint) candidates.push(args.publishDirHint);
    candidates.push("dist", "build", "out", ".vercel/output/static", "public");
    for (const dir of candidates) {
      const full: string = join(args.cwd, dir);
      if (await exists(full)) return { ok: true, artifactDir: full };
    }
    // Provide a deterministic hint
    const hint: string = args.publishDirHint ? join(args.cwd, args.publishDirHint) : join(args.cwd, "dist");
    return { ok: true, artifactDir: hint };
  }

  /** @inheritdoc */
  public async deploy(args: DeployInputs): Promise<DeployResult> {
    const runner: ProcessRunner = this.runner;
    const env: "production" | "preview" = args.env === "production" ? "production" : "preview";
    const wantProd: boolean = env === "production";
    // Prefer remote build unless a prebuilt artifact directory exists
    const hasPrebuilt: boolean = typeof args.artifactDir === "string" && (await exists(args.artifactDir));
    let cmd: readonly string[] = wantProd ? ["deploy", "--prod", "--yes"] : ["deploy", "--yes"];
    if (hasPrebuilt) cmd = wantProd ? ["deploy", "--prebuilt", "--prod", "--yes"] : ["deploy", "--prebuilt", "--yes"];
    const res = await runner.exec("vercel", cmd, { cwd: args.cwd, timeoutMs: (args.timeoutSeconds ?? 900) * 1000 });
    if (!res.ok) {
      const err: string = (res.stderr || res.stdout).trim() || "Vercel deploy failed";
      return { ok: false, message: err };
    }
    const combined: string = (res.stdout || "") + "\n" + (res.stderr || "");
    const url: string | undefined = extractDeployUrl(combined);
    let logsUrl: string | undefined = extractInspectUrl(combined);
    if (!logsUrl && url) {
      try {
        const insp = await runner.exec("vercel", ["inspect", url], { cwd: args.cwd, timeoutMs: 120_000 });
        const text: string = (insp.stdout || "") + "\n" + (insp.stderr || "");
        const cand = extractInspectUrl(text);
        if (cand) logsUrl = cand;
      } catch { /* ignore */ }
    }
    return { ok: true, url, logsUrl };
  }

  /** @inheritdoc */
  public async generateConfig(args: GenerateArgs): Promise<string> {
    // Minimal vercel.json for static frameworks; SSR remains app-config specific
    const p: string = join(args.cwd, "vercel.json");
    const body = JSON.stringify({
      $schema: "https://openapi.vercel.sh/vercel.json",
      cleanUrls: true
    }, null, 2);
    if (args.overwrite === true || !(await exists(p))) {
      await writeFile(p, body, "utf8");
    }
    return p;
  }
}

export type { Provider, ProviderCapabilities, Detected, BuildInputs, BuildResult, DeployInputs, DeployResult, GenerateArgs, Hint };

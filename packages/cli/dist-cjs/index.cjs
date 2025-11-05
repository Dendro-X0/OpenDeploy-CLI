#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/utils/fs.ts
async function exists(path) {
  try {
    const s = await (0, import_promises.stat)(path);
    return s.isFile() || s.isDirectory();
  } catch {
    return false;
  }
}
async function readJson(path) {
  try {
    const buf = await (0, import_promises.readFile)(path, "utf8");
    return JSON.parse(buf);
  } catch {
    return null;
  }
}
async function writeJson(path, data) {
  try {
    await (0, import_promises.mkdir)((0, import_node_path.dirname)(path), { recursive: true });
  } catch {
  }
  const s = JSON.stringify(data, null, 2);
  await (0, import_promises.writeFile)(path, s + "\n", "utf8");
}
var import_promises, import_node_path, fsx;
var init_fs = __esm({
  "src/utils/fs.ts"() {
    "use strict";
    import_promises = require("fs/promises");
    import_node_path = require("path");
    fsx = { exists, readJson, writeJson };
  }
});

// src/core/detectors/package-manager.ts
async function detectPackageManager(args) {
  const lockBun1 = (0, import_node_path2.join)(args.cwd, "bun.lockb");
  const lockBun2 = (0, import_node_path2.join)(args.cwd, "bun.lock");
  const lockPnpm = (0, import_node_path2.join)(args.cwd, "pnpm-lock.yaml");
  const lockYarn = (0, import_node_path2.join)(args.cwd, "yarn.lock");
  const lockNpm = (0, import_node_path2.join)(args.cwd, "package-lock.json");
  if (await fsx.exists(lockBun1) || await fsx.exists(lockBun2)) return "bun";
  if (await fsx.exists(lockPnpm)) return "pnpm";
  if (await fsx.exists(lockYarn)) return "yarn";
  if (await fsx.exists(lockNpm)) return "npm";
  return "pnpm";
}
var import_node_path2;
var init_package_manager = __esm({
  "src/core/detectors/package-manager.ts"() {
    "use strict";
    import_node_path2 = require("path");
    init_fs();
  }
});

// src/core/detectors/monorepo.ts
async function detectMonorepo(args) {
  const turbo = (0, import_node_path3.join)(args.cwd, "turbo.json");
  const nx = (0, import_node_path3.join)(args.cwd, "nx.json");
  const pnpmWs = (0, import_node_path3.join)(args.cwd, "pnpm-workspace.yaml");
  if (await fsx.exists(turbo)) return "turborepo";
  if (await fsx.exists(nx)) return "nx";
  if (await fsx.exists(pnpmWs)) return "workspaces";
  const pkgPath = (0, import_node_path3.join)(args.cwd, "package.json");
  const pkg = await fsx.readJson(pkgPath);
  if (pkg !== null && pkg.workspaces !== void 0) return "workspaces";
  return "none";
}
var import_node_path3;
var init_monorepo = __esm({
  "src/core/detectors/monorepo.ts"() {
    "use strict";
    import_node_path3 = require("path");
    init_fs();
  }
});

// src/core/detectors/env-files.ts
async function detectEnvFiles(args) {
  const candidates = [".env", ".env.local", ".env.production", ".env.development"];
  const found = [];
  for (const f of candidates) {
    const p = (0, import_node_path4.join)(args.cwd, f);
    if (await fsx.exists(p)) found.push(f);
  }
  return found;
}
var import_node_path4;
var init_env_files = __esm({
  "src/core/detectors/env-files.ts"() {
    "use strict";
    import_node_path4 = require("path");
    init_fs();
  }
});

// src/core/detectors/next.ts
function hasNextDependency(pkg) {
  if (pkg === null) return false;
  const deps = { ...pkg.dependencies ?? {}, ...pkg.devDependencies ?? {} };
  return Object.prototype.hasOwnProperty.call(deps, "next");
}
async function detectNextApp(args) {
  const pkgPath = (0, import_node_path5.join)(args.cwd, "package.json");
  const pkg = await fsx.readJson(pkgPath);
  if (!hasNextDependency(pkg)) throw new Error("No Next.js dependency detected in package.json");
  const hasApp = await fsx.exists((0, import_node_path5.join)(args.cwd, "app"));
  const hasPages = await fsx.exists((0, import_node_path5.join)(args.cwd, "pages"));
  const build = pkg?.scripts?.build ?? "next build";
  const detection = {
    framework: "next",
    rootDir: args.cwd,
    appDir: args.cwd,
    hasAppRouter: hasApp && !hasPages ? true : hasApp,
    packageManager: await detectPackageManager({ cwd: args.cwd }),
    monorepo: await detectMonorepo({ cwd: args.cwd }),
    buildCommand: build,
    outputDir: ".next",
    // Next on Netlify uses a runtime/plugin; publishDir is not strictly required for SSR/hybrid.
    publishDir: void 0,
    renderMode: "hybrid",
    confidence: 0.95,
    environmentFiles: await detectEnvFiles({ cwd: args.cwd })
  };
  return detection;
}
var import_node_path5;
var init_next = __esm({
  "src/core/detectors/next.ts"() {
    "use strict";
    import_node_path5 = require("path");
    init_fs();
    init_package_manager();
    init_monorepo();
    init_env_files();
  }
});

// src/core/detectors/astro.ts
function hasAstroDependency(pkg) {
  if (pkg === null) return false;
  const deps = { ...pkg.dependencies ?? {}, ...pkg.devDependencies ?? {} };
  return Object.prototype.hasOwnProperty.call(deps, "astro");
}
async function detectAstroApp(args) {
  const pkgPath = (0, import_node_path6.join)(args.cwd, "package.json");
  const pkg = await fsx.readJson(pkgPath);
  if (!hasAstroDependency(pkg)) throw new Error("No Astro dependency detected in package.json");
  const build = pkg?.scripts?.build ?? "astro build";
  const detection = {
    framework: "astro",
    rootDir: args.cwd,
    appDir: args.cwd,
    hasAppRouter: false,
    packageManager: await detectPackageManager({ cwd: args.cwd }),
    monorepo: await detectMonorepo({ cwd: args.cwd }),
    buildCommand: build,
    outputDir: "dist",
    publishDir: "dist",
    renderMode: "static",
    confidence: 0.9,
    environmentFiles: await detectEnvFiles({ cwd: args.cwd })
  };
  return detection;
}
var import_node_path6;
var init_astro = __esm({
  "src/core/detectors/astro.ts"() {
    "use strict";
    import_node_path6 = require("path");
    init_fs();
    init_package_manager();
    init_monorepo();
    init_env_files();
  }
});

// src/core/detectors/sveltekit.ts
function hasSvelteKitDependency(pkg) {
  if (pkg === null) return false;
  const deps = { ...pkg.dependencies ?? {}, ...pkg.devDependencies ?? {} };
  if (Object.prototype.hasOwnProperty.call(deps, "@sveltejs/kit")) return true;
  if (Object.prototype.hasOwnProperty.call(deps, "svelte")) {
    const scripts = pkg.scripts ?? {};
    const hasKitScript = Object.values(scripts).some((s) => typeof s === "string" && /svelte-?kit|vite\s+build/i.test(s));
    if (hasKitScript) return true;
  }
  return false;
}
async function detectSvelteKitApp(args) {
  const pkgPath = (0, import_node_path7.join)(args.cwd, "package.json");
  const pkg = await fsx.readJson(pkgPath);
  if (!hasSvelteKitDependency(pkg)) throw new Error("No SvelteKit dependency detected in package.json");
  const build = pkg?.scripts?.build ?? "vite build";
  const detection = {
    framework: "sveltekit",
    rootDir: args.cwd,
    appDir: args.cwd,
    hasAppRouter: false,
    packageManager: await detectPackageManager({ cwd: args.cwd }),
    monorepo: await detectMonorepo({ cwd: args.cwd }),
    buildCommand: build,
    // Output varies by adapter; use a conventional folder for reference
    outputDir: "build",
    publishDir: "build",
    renderMode: "hybrid",
    confidence: 0.85,
    environmentFiles: await detectEnvFiles({ cwd: args.cwd })
  };
  return detection;
}
var import_node_path7;
var init_sveltekit = __esm({
  "src/core/detectors/sveltekit.ts"() {
    "use strict";
    import_node_path7 = require("path");
    init_fs();
    init_package_manager();
    init_monorepo();
    init_env_files();
  }
});

// src/core/detectors/remix.ts
function hasRemixDependency(pkg) {
  if (pkg === null) return false;
  const deps = { ...pkg.dependencies ?? {}, ...pkg.devDependencies ?? {} };
  if (Object.prototype.hasOwnProperty.call(deps, "remix")) return true;
  if (Object.prototype.hasOwnProperty.call(deps, "@remix-run/node")) return true;
  if (Object.prototype.hasOwnProperty.call(deps, "@remix-run/react")) return true;
  const scripts = pkg.scripts ?? {};
  const looksLike = Object.values(scripts).some((s) => typeof s === "string" && /remix\s+build|remix\s+dev/i.test(s));
  return looksLike;
}
async function detectRemixApp(args) {
  const pkgPath = (0, import_node_path8.join)(args.cwd, "package.json");
  const pkg = await fsx.readJson(pkgPath);
  if (!hasRemixDependency(pkg)) throw new Error("No Remix dependency detected in package.json");
  const build = pkg?.scripts?.build ?? "remix build";
  const detection = {
    framework: "remix",
    rootDir: args.cwd,
    appDir: args.cwd,
    hasAppRouter: false,
    packageManager: await detectPackageManager({ cwd: args.cwd }),
    monorepo: await detectMonorepo({ cwd: args.cwd }),
    buildCommand: build,
    outputDir: "build",
    publishDir: "build/client",
    renderMode: "hybrid",
    confidence: 0.88,
    environmentFiles: await detectEnvFiles({ cwd: args.cwd })
  };
  return detection;
}
var import_node_path8;
var init_remix = __esm({
  "src/core/detectors/remix.ts"() {
    "use strict";
    import_node_path8 = require("path");
    init_fs();
    init_package_manager();
    init_monorepo();
    init_env_files();
  }
});

// src/core/detectors/react-router.ts
async function readJson2(path) {
  try {
    const s = await (0, import_promises2.readFile)(path, "utf8");
    return JSON.parse(s);
  } catch {
    return null;
  }
}
function detectPm(_pkg) {
  const ua = typeof process.env.npm_config_user_agent === "string" ? process.env.npm_config_user_agent : "";
  if (ua.includes("pnpm")) return "pnpm";
  if (ua.includes("yarn")) return "yarn";
  if (ua.includes("bun")) return "bun";
  return "npm";
}
function detectMonorepo2() {
  return "none";
}
async function detectReactRouterApp(args) {
  const cwd = args.cwd;
  const pkg = await readJson2((0, import_node_path9.join)(cwd, "package.json"));
  if (!pkg) throw new Error("not a react-router app");
  const deps = { ...pkg.dependencies ?? {}, ...pkg.devDependencies ?? {} };
  const scripts = pkg.scripts ?? {};
  const hasRRDeps = typeof deps["@react-router/dev"] === "string" || typeof deps["@react-router/node"] === "string" || typeof deps["@react-router/serve"] === "string";
  const hasRRBuild = Object.values(scripts).some((s) => /react-router\s+build/i.test(String(s)));
  if (!hasRRDeps && !hasRRBuild) throw new Error("not a react-router app");
  const buildCommand = hasRRBuild ? Object.entries(scripts).find(([, cmd]) => /react-router\s+build/i.test(String(cmd)))?.[1] ?? "react-router build" : "react-router build";
  const result = {
    framework: "remix",
    rootDir: cwd,
    appDir: cwd,
    hasAppRouter: false,
    packageManager: detectPm(pkg),
    monorepo: detectMonorepo2(),
    buildCommand,
    outputDir: "build",
    publishDir: "build/client",
    renderMode: "static",
    confidence: 0.75,
    environmentFiles: [".env", ".env.local", ".env.production.local"]
  };
  return result;
}
var import_promises2, import_node_path9;
var init_react_router = __esm({
  "src/core/detectors/react-router.ts"() {
    "use strict";
    import_promises2 = require("fs/promises");
    import_node_path9 = require("path");
  }
});

// src/core/detectors/nuxt.ts
function hasNuxtDependency(pkg) {
  if (pkg === null) return false;
  const deps = { ...pkg.dependencies ?? {}, ...pkg.devDependencies ?? {} };
  return Object.prototype.hasOwnProperty.call(deps, "nuxt");
}
async function detectNuxtApp(args) {
  const pkgPath = (0, import_node_path10.join)(args.cwd, "package.json");
  const pkg = await fsx.readJson(pkgPath);
  if (!hasNuxtDependency(pkg)) throw new Error("No Nuxt dependency detected in package.json");
  const scripts = pkg?.scripts ?? {};
  const build = scripts.build ?? "nuxt build";
  const usesGenerate = /nuxt\s+generate|nuxi\s+generate/i.test(build);
  const detection = {
    framework: "nuxt",
    rootDir: args.cwd,
    appDir: args.cwd,
    hasAppRouter: false,
    packageManager: await detectPackageManager({ cwd: args.cwd }),
    monorepo: await detectMonorepo({ cwd: args.cwd }),
    buildCommand: build,
    // Nuxt outputs to .output by default (Nitro). Static generate -> .output/public
    outputDir: ".output",
    publishDir: usesGenerate ? ".output/public" : void 0,
    renderMode: usesGenerate ? "static" : "hybrid",
    confidence: 0.9,
    environmentFiles: await detectEnvFiles({ cwd: args.cwd })
  };
  return detection;
}
var import_node_path10;
var init_nuxt = __esm({
  "src/core/detectors/nuxt.ts"() {
    "use strict";
    import_node_path10 = require("path");
    init_fs();
    init_package_manager();
    init_monorepo();
    init_env_files();
  }
});

// src/core/detectors/expo.ts
function hasExpoDependency(pkg) {
  if (pkg === null) return false;
  const deps = { ...pkg.dependencies ?? {}, ...pkg.devDependencies ?? {} };
  if (Object.prototype.hasOwnProperty.call(deps, "expo")) return true;
  const scripts = pkg.scripts ?? {};
  const looksLike = Object.values(scripts).some((s) => typeof s === "string" && /expo\s+(start|build|run|prebuild)/i.test(s));
  return looksLike;
}
async function detectExpoApp(args) {
  const pkgPath = (0, import_node_path11.join)(args.cwd, "package.json");
  const pkg = await fsx.readJson(pkgPath);
  if (!hasExpoDependency(pkg)) throw new Error("No Expo dependency detected in package.json");
  const build = pkg?.scripts?.build ?? "expo build";
  const detection = {
    framework: "expo",
    rootDir: args.cwd,
    appDir: args.cwd,
    hasAppRouter: false,
    packageManager: await detectPackageManager({ cwd: args.cwd }),
    monorepo: await detectMonorepo({ cwd: args.cwd }),
    buildCommand: build,
    outputDir: "dist",
    publishDir: "dist",
    renderMode: "static",
    confidence: 0.6,
    environmentFiles: await detectEnvFiles({ cwd: args.cwd })
  };
  return detection;
}
var import_node_path11;
var init_expo = __esm({
  "src/core/detectors/expo.ts"() {
    "use strict";
    import_node_path11 = require("path");
    init_fs();
    init_package_manager();
    init_monorepo();
    init_env_files();
  }
});

// src/core/detectors/auto.ts
async function tryDetect(fn, cwd) {
  try {
    return await fn({ cwd });
  } catch {
    return void 0;
  }
}
async function detectApp(args) {
  const cwd = args.cwd;
  const candidates = [];
  const next = await tryDetect(detectNextApp, cwd);
  if (next) candidates.push(next);
  const astro = await tryDetect(detectAstroApp, cwd);
  if (astro) candidates.push(astro);
  const svelte = await tryDetect(detectSvelteKitApp, cwd);
  if (svelte) candidates.push(svelte);
  const rr = await tryDetect(detectReactRouterApp, cwd);
  if (rr) candidates.push(rr);
  const remix = await tryDetect(detectRemixApp, cwd);
  if (remix) candidates.push(remix);
  const nuxt = await tryDetect(detectNuxtApp, cwd);
  if (nuxt) candidates.push(nuxt);
  if (process.env.OPD_EXPERIMENTAL === "1") {
    const expo = await tryDetect(detectExpoApp, cwd);
    if (expo) candidates.push(expo);
  }
  if (candidates.length === 0) throw new Error("No supported framework detected");
  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates[0];
}
async function detectCandidates(args) {
  const cwd = args.cwd;
  const set = /* @__PURE__ */ new Set();
  if (await tryDetect(detectNextApp, cwd)) set.add("next");
  if (await tryDetect(detectAstroApp, cwd)) set.add("astro");
  if (await tryDetect(detectSvelteKitApp, cwd)) set.add("sveltekit");
  if (await tryDetect(detectReactRouterApp, cwd)) set.add("remix");
  else if (await tryDetect(detectRemixApp, cwd)) set.add("remix");
  if (await tryDetect(detectNuxtApp, cwd)) set.add("nuxt");
  if (process.env.OPD_EXPERIMENTAL === "1" && await tryDetect(detectExpoApp, cwd)) set.add("expo");
  return set;
}
var init_auto = __esm({
  "src/core/detectors/auto.ts"() {
    "use strict";
    init_next();
    init_astro();
    init_sveltekit();
    init_remix();
    init_react_router();
    init_nuxt();
    init_expo();
  }
});

// src/utils/colors.ts
function supportsColor() {
  if (mode === "always") return true;
  if (mode === "never") return false;
  return Boolean(process.stdout && process.stdout.isTTY);
}
function setColorMode(m) {
  mode = m;
}
function wrap(codeOpen, codeClose, text) {
  if (!supportsColor()) return text;
  return `\x1B[${codeOpen}m${text}\x1B[${codeClose}m`;
}
function colorize(kind, s) {
  return colors[kind](s);
}
var mode, colors;
var init_colors = __esm({
  "src/utils/colors.ts"() {
    "use strict";
    mode = "auto";
    colors = {
      green: (s) => wrap("32", "39", s),
      yellow: (s) => wrap("33", "39", s),
      // Use bright cyan to render as light blue in most terminals
      cyan: (s) => wrap("96", "39", s),
      blue: (s) => wrap("34", "39", s),
      red: (s) => wrap("31", "39", s),
      dim: (s) => wrap("2", "22", s),
      bold: (s) => wrap("1", "22", s)
    };
  }
});

// src/utils/logger.ts
async function safeAppend(path, line) {
  try {
    await (0, import_promises3.mkdir)((0, import_node_path12.dirname)(path), { recursive: true });
    await (0, import_promises3.appendFile)(path, line, "utf8");
  } catch {
  }
}
function applyRedaction(msg) {
  if (redactors.length === 0) return msg;
  let out = msg;
  for (const r of redactors) {
    try {
      out = out.replace(r, "******");
    } catch {
    }
  }
  return out;
}
function write(kind, msg) {
  if (jsonOnly) return;
  const prefix = noEmoji ? kind === "error" ? "[error]" : kind === "warn" ? "[warn]" : kind === "info" ? "[info]" : "[debug]" : kind === "error" ? "\u2716" : kind === "warn" ? "\u26A0" : kind === "info" ? "\u2139" : "\u2022";
  const ts = timestampsOn ? `${(/* @__PURE__ */ new Date()).toISOString()} ` : "";
  const redacted = applyRedaction(msg);
  const hasAnsi = redacted.includes("\x1B[");
  const colored = hasAnsi ? redacted : kind === "error" ? colorize("red", redacted) : kind === "warn" ? colorize("yellow", redacted) : kind === "info" ? colorize("cyan", redacted) : redacted;
  console[kind === "error" ? "error" : "log"](`${ts}${prefix} ${colored}`);
}
function enrichJson(val) {
  if (!timestampsOn && !ndjson) return val;
  if (val !== null && typeof val === "object") {
    const obj = { ...val };
    if (timestampsOn && obj.ts === void 0) obj.ts = (/* @__PURE__ */ new Date()).toISOString();
    return obj;
  }
  return val;
}
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function isJsonMode(flag) {
  return flag === true || process.env.OPD_JSON === "1" || process.env.OPD_NDJSON === "1";
}
var import_node_path12, import_promises3, level, jsonOnly, noEmoji, jsonCompact, ndjson, timestampsOn, summaryOnly, jsonFilePath, ndjsonFilePath, redactors, logger;
var init_logger = __esm({
  "src/utils/logger.ts"() {
    "use strict";
    import_node_path12 = require("path");
    import_promises3 = require("fs/promises");
    init_colors();
    level = "info";
    jsonOnly = false;
    noEmoji = false;
    jsonCompact = false;
    ndjson = false;
    timestampsOn = false;
    summaryOnly = false;
    redactors = [];
    logger = {
      info: (msg) => {
        if (jsonOnly) return;
        if (level === "info" || level === "debug") write("info", msg);
      },
      warn: (msg) => {
        if (jsonOnly) return;
        write("warn", msg);
      },
      error: (msg) => {
        if (jsonOnly) return;
        write("error", msg);
      },
      success: (msg) => {
        if (jsonOnly) return;
        const text = `${noEmoji ? "[ok]" : "\u2713"} ${msg}`;
        const colored = colorize("green", text);
        write("info", colored);
      },
      note: (msg) => {
        if (jsonOnly) return;
        const text = `${noEmoji ? "[start]" : "\u25C7"} ${msg}`;
        const colored = colorize("cyan", text);
        write("info", colored);
      },
      section: (title) => {
        if (jsonOnly) return;
        const bar = "\u2500".repeat(Math.max(12, Math.min(60, title.length + 10)));
        const head = `${colorize("cyan", bar)}
${colorize("bold", title)}
${colorize("cyan", bar)}`;
        console.log(head);
      },
      highlight: (msg, color) => colorize(color, msg),
      json: (val) => {
        const v = enrichJson(val);
        if (summaryOnly) {
          const isSummary = typeof v === "object" && v !== null && v.final === true;
          if (!isSummary) return;
        }
        const rawLine = ndjson || jsonCompact ? JSON.stringify(v) : JSON.stringify(v, null, 2);
        const line = applyRedaction(rawLine);
        console.log(line);
        if (ndjsonFilePath) void safeAppend(ndjsonFilePath, line + "\n");
        if (jsonFilePath) {
          const jlRaw = ndjson ? JSON.stringify(v) : jsonCompact ? JSON.stringify(v) : JSON.stringify(v, null, 2);
          const jl = applyRedaction(jlRaw);
          void safeAppend(jsonFilePath, jl + "\n");
        }
      },
      jsonPrint: (val) => {
        logger.json(val);
        try {
          console.log(JSON.stringify(val));
        } catch {
        }
      },
      setLevel: (lvl) => {
        level = lvl;
      },
      setJsonOnly: (on) => {
        jsonOnly = on;
      },
      setNoEmoji: (on) => {
        noEmoji = on;
      },
      setJsonCompact: (on) => {
        jsonCompact = on;
      },
      setNdjson: (on) => {
        ndjson = on;
        if (on) {
          jsonOnly = true;
          jsonCompact = true;
        }
      },
      setTimestamps: (on) => {
        timestampsOn = on;
      },
      setSummaryOnly: (on) => {
        summaryOnly = on;
      },
      setJsonFile: (path) => {
        jsonFilePath = path;
      },
      setNdjsonFile: (path) => {
        ndjsonFilePath = path;
      },
      setRedactors: (patterns) => {
        redactors = patterns.map((p) => p instanceof RegExp ? p : new RegExp(escapeRegExp(p), "g"));
      }
    };
  }
});

// src/utils/process.ts
async function ensureDir(path) {
  try {
    await (0, import_promises4.mkdir)((0, import_node_path13.dirname)(path), { recursive: true });
  } catch {
  }
}
async function recordAppend(obj) {
  if (!recordFile) return;
  try {
    await ensureDir(recordFile);
    await (0, import_promises4.appendFile)(recordFile, JSON.stringify(obj) + "\n", "utf8");
  } catch {
  }
}
async function loadReplay() {
  if (!replayFile || replayEvents.length > 0) return;
  try {
    const buf = await (0, import_promises4.readFile)(replayFile, "utf8");
    const lines = buf.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    replayEvents = lines.map((l) => JSON.parse(l));
  } catch {
    replayEvents = [];
  }
}
function nextReplay(type, fallbackCmd) {
  if (replayEvents.length === 0 || replayIdx >= replayEvents.length) return void 0;
  const ev = replayEvents[replayIdx++];
  if (ev.t !== type) return ev;
  return ev;
}
function spawnStream(args) {
  if (replayFile) {
    void loadReplay();
    const ev = nextReplay("stream", args.cmd);
    const chunks = ev?.chunks ?? [];
    let closed = false;
    setImmediate(() => {
      for (const c of chunks) {
        if (c.fd === "out") args.onStdout?.(c.data);
        else args.onStderr?.(c.data);
      }
      closed = true;
    });
    const done2 = new Promise((resolve) => {
      setTimeout(() => resolve({ ok: ev?.ok ?? true, exitCode: ev?.exitCode ?? 0 }), 0);
    });
    const stop2 = () => {
    };
    return { stop: stop2, done: done2 };
  }
  if (!args.cmd || args.cmd.trim().length === 0) return { stop: () => {
  }, done: Promise.resolve({ ok: false, exitCode: 1 }) };
  const isWin = process.platform === "win32";
  const mergedEnv = args.env !== void 0 ? { ...process.env, ...args.env } : { ...process.env };
  const wantCI = process.env.OPD_FORCE_CI === "1" || process.env.OPD_JSON === "1" || process.env.OPD_NDJSON === "1" || process.env.CI === "true" || process.env.CI === "1" || process.env.GITHUB_ACTIONS === "true";
  if (wantCI) {
    mergedEnv.CI = "1";
    if (!mergedEnv.FORCE_COLOR) mergedEnv.FORCE_COLOR = "0";
    if (!mergedEnv.TERM) mergedEnv.TERM = "dumb";
  }
  const shellFile = isWin ? process.env.ComSpec ?? "cmd.exe" : process.env.SHELL ?? "/bin/sh";
  const shellArgs = isWin ? ["/d", "/s", "/c", args.cmd] : ["-c", args.cmd];
  const cp = (0, import_node_child_process.spawn)(shellFile, [...shellArgs], { cwd: args.cwd, windowsHide: true, env: mergedEnv });
  const t0 = Date.now();
  if (process.env.OPD_DEBUG_PROCESS === "1") {
    const info = `[proc] spawnStream pid=? cmd="${args.cmd}" cwd="${args.cwd ?? ""}" timeoutMs=${Number(args.timeoutMs) || 0}`;
    try {
      process.stderr.write(info + "\n");
    } catch {
    }
  }
  cp.stdout?.setEncoding("utf8");
  cp.stderr?.setEncoding("utf8");
  const recChunks = [];
  const onOut = (d) => {
    recChunks.push({ fd: "out", data: d });
    args.onStdout?.(d);
  };
  const onErr = (d) => {
    recChunks.push({ fd: "err", data: d });
    args.onStderr?.(d);
  };
  cp.stdout?.on("data", onOut);
  cp.stderr?.on("data", onErr);
  let timeout;
  const done = new Promise((resolve) => {
    cp.on("error", () => {
      if (process.env.OPD_DEBUG_PROCESS === "1") {
        try {
          process.stderr.write(`[proc] spawnStream error after ${Date.now() - t0}ms
`);
        } catch {
        }
      }
      const res = { ok: false, exitCode: 1 };
      void recordAppend({ t: "stream", cmd: args.cmd, cwd: args.cwd, ...res, chunks: recChunks });
      resolve(res);
    });
    cp.on("close", (code) => {
      if (process.env.OPD_DEBUG_PROCESS === "1") {
        const info = `[proc] spawnStream exit code=${code ?? "null"} after ${Date.now() - t0}ms`;
        try {
          process.stderr.write(info + "\n");
        } catch {
        }
      }
      const res = { ok: (code ?? 1) === 0, exitCode: code ?? 1 };
      void recordAppend({ t: "stream", cmd: args.cmd, cwd: args.cwd, ...res, chunks: recChunks });
      resolve(res);
    });
  });
  if (Number.isFinite(Number(args.timeoutMs)) && Number(args.timeoutMs) > 0) {
    timeout = setTimeout(() => {
      try {
        cp.kill();
      } catch {
      }
      try {
        if (isWin) (0, import_node_child_process.spawn)("taskkill", ["/T", "/F", "/PID", String(cp.pid)], { stdio: "ignore", windowsHide: true });
      } catch {
      }
    }, Number(args.timeoutMs));
    cp.on("close", () => {
      if (timeout) clearTimeout(timeout);
    });
    cp.on("error", () => {
      if (timeout) clearTimeout(timeout);
    });
  }
  const stop = () => {
    try {
      if (process.platform === "win32") {
        try {
          cp.kill();
        } catch {
        }
        try {
          (0, import_node_child_process.spawn)("taskkill", ["/T", "/F", "/PID", String(cp.pid)], { stdio: "ignore", windowsHide: true });
        } catch {
        }
      } else {
        try {
          cp.kill("SIGTERM");
        } catch {
        }
        setTimeout(() => {
          try {
            cp.kill("SIGKILL");
          } catch {
          }
        }, 500);
      }
    } catch {
    }
  };
  return { stop, done };
}
async function run(args) {
  if (replayFile) {
    await loadReplay();
    const ev = nextReplay("run", args.cmd);
    const stdout = ev?.stdout ?? "";
    const stderr = ev?.stderr ?? "";
    const exitCode = ev?.exitCode ?? 0;
    return { ok: ev?.ok ?? true, exitCode, stdout, stderr };
  }
  return await new Promise((resolve) => {
    if (!args.cmd || args.cmd.trim().length === 0) return resolve({ ok: false, exitCode: 1, stdout: "", stderr: "empty command" });
    const isWin = process.platform === "win32";
    const mergedEnv = args.env !== void 0 ? { ...process.env, ...args.env } : { ...process.env };
    const wantCI = process.env.OPD_FORCE_CI === "1" || process.env.OPD_JSON === "1" || process.env.OPD_NDJSON === "1" || process.env.CI === "true" || process.env.CI === "1" || process.env.GITHUB_ACTIONS === "true";
    if (wantCI) {
      mergedEnv.CI = "1";
      if (!mergedEnv.FORCE_COLOR) mergedEnv.FORCE_COLOR = "0";
      if (!mergedEnv.TERM) mergedEnv.TERM = "dumb";
    }
    const shellFile = isWin ? process.env.ComSpec ?? "cmd.exe" : process.env.SHELL ?? "/bin/sh";
    const shellArgs = isWin ? ["/d", "/s", "/c", args.cmd] : ["-c", args.cmd];
    const cp = (0, import_node_child_process.spawn)(shellFile, [...shellArgs], { cwd: args.cwd, windowsHide: true, env: mergedEnv });
    const t0 = Date.now();
    if (process.env.OPD_DEBUG_PROCESS === "1") {
      const info = `[proc] run pid=? cmd="${args.cmd}" cwd="${args.cwd ?? ""}"`;
      try {
        process.stderr.write(info + "\n");
      } catch {
      }
    }
    const outChunks = [];
    const errChunks = [];
    cp.stdout?.on("data", (d) => {
      outChunks.push(Buffer.from(d));
    });
    cp.stderr?.on("data", (d) => {
      errChunks.push(Buffer.from(d));
    });
    if (typeof args.stdin === "string" && cp.stdin) {
      cp.stdin.write(args.stdin);
      cp.stdin.end();
    }
    cp.on("error", (_err) => {
      const res = { ok: false, exitCode: 1, stdout: Buffer.concat(outChunks).toString(), stderr: Buffer.concat(errChunks).toString() };
      void recordAppend({ t: "run", cmd: args.cmd, cwd: args.cwd, ...res });
      resolve(res);
    });
    cp.on("close", (code) => {
      const exit = code === null ? 1 : code;
      const res = { ok: exit === 0, exitCode: exit, stdout: Buffer.concat(outChunks).toString(), stderr: Buffer.concat(errChunks).toString() };
      void recordAppend({ t: "run", cmd: args.cmd, cwd: args.cwd, ...res });
      resolve(res);
    });
  });
}
async function has(cmd) {
  const res = await run({ cmd: `${cmd} --version` });
  return res.ok;
}
async function runStream(args) {
  if (replayFile) {
    await loadReplay();
    const ev = nextReplay("stream", args.cmd);
    for (const c of ev?.chunks ?? []) {
      if (c.fd === "out") args.onStdout?.(c.data);
      else args.onStderr?.(c.data);
    }
    return { ok: ev?.ok ?? true, exitCode: ev?.exitCode ?? 0 };
  }
  return await new Promise((resolve) => {
    if (!args.cmd || args.cmd.trim().length === 0) return resolve({ ok: false, exitCode: 1 });
    const isWin = process.platform === "win32";
    const mergedEnv = args.env !== void 0 ? { ...process.env, ...args.env } : { ...process.env };
    const wantCI = process.env.OPD_FORCE_CI === "1" || process.env.OPD_JSON === "1" || process.env.OPD_NDJSON === "1" || process.env.CI === "true" || process.env.CI === "1" || process.env.GITHUB_ACTIONS === "true";
    if (wantCI) {
      mergedEnv.CI = "1";
      if (!mergedEnv.FORCE_COLOR) mergedEnv.FORCE_COLOR = "0";
      if (!mergedEnv.TERM) mergedEnv.TERM = "dumb";
    }
    const shellFile = isWin ? process.env.ComSpec ?? "cmd.exe" : process.env.SHELL ?? "/bin/sh";
    const shellArgs = isWin ? ["/d", "/s", "/c", args.cmd] : ["-c", args.cmd];
    const cp = (0, import_node_child_process.spawn)(shellFile, [...shellArgs], { cwd: args.cwd, windowsHide: true, env: mergedEnv });
    const t0 = Date.now();
    cp.stdout?.setEncoding("utf8");
    cp.stderr?.setEncoding("utf8");
    if (args.onStdout) cp.stdout?.on("data", (d) => {
      args.onStdout?.(d);
    });
    if (args.onStderr) cp.stderr?.on("data", (d) => {
      args.onStderr?.(d);
    });
    let timeout;
    cp.on("error", () => {
      if (timeout) clearTimeout(timeout);
      if (process.env.OPD_DEBUG_PROCESS === "1") {
        try {
          process.stderr.write(`[proc] runStream error after ${Date.now() - t0}ms
`);
        } catch {
        }
      }
      const res = { ok: false, exitCode: 1 };
      void recordAppend({ t: "stream", cmd: args.cmd, cwd: args.cwd, ...res });
      resolve(res);
    });
    cp.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      if (process.env.OPD_DEBUG_PROCESS === "1") {
        const info = `[proc] runStream exit code=${code ?? "null"} after ${Date.now() - t0}ms`;
        try {
          process.stderr.write(info + "\n");
        } catch {
        }
      }
      resolve({ ok: (code ?? 1) === 0, exitCode: code ?? 1 });
    });
    if (Number.isFinite(Number(args.timeoutMs)) && Number(args.timeoutMs) > 0) {
      timeout = setTimeout(() => {
        try {
          cp.kill();
        } catch {
        }
        try {
          if (isWin) (0, import_node_child_process.spawn)("taskkill", ["/T", "/F", "/PID", String(cp.pid)], { stdio: "ignore", windowsHide: true });
        } catch {
        }
      }, Number(args.timeoutMs));
    }
  });
}
async function withTimeout(promise, ms) {
  if (!Number.isFinite(ms) || ms <= 0) return await promise;
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    promise.then((v) => {
      clearTimeout(timer);
      resolve(v);
    }, (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function runWithTimeout(args, timeoutMs = 12e4) {
  return await withTimeout(run(args), timeoutMs);
}
async function runWithRetry(args, opts) {
  const envRetries = Number.isFinite(Number(process.env.OPD_RETRIES)) ? Number(process.env.OPD_RETRIES) : void 0;
  const envBase = Number.isFinite(Number(process.env.OPD_BASE_DELAY_MS)) ? Number(process.env.OPD_BASE_DELAY_MS) : void 0;
  const envTimeout = Number.isFinite(Number(process.env.OPD_TIMEOUT_MS)) ? Number(process.env.OPD_TIMEOUT_MS) : void 0;
  const retries = Math.max(0, opts?.retries ?? (envRetries ?? 2));
  const base = Math.max(10, opts?.baseDelayMs ?? (envBase ?? 300));
  const to = opts?.timeoutMs ?? (envTimeout ?? 12e4);
  let attempt = 0;
  while (true) {
    try {
      const res = await runWithTimeout(args, to);
      if (res.ok || attempt >= retries) return res;
    } catch (e) {
      if (attempt >= retries) throw e;
    }
    const jitter = Math.floor(Math.random() * base);
    const wait = base * Math.pow(2, attempt) + jitter;
    await sleep(wait);
    attempt++;
  }
}
var import_node_child_process, import_node_path13, import_promises4, recordFile, replayFile, replayEvents, replayIdx, proc;
var init_process = __esm({
  "src/utils/process.ts"() {
    "use strict";
    import_node_child_process = require("child_process");
    import_node_path13 = require("path");
    import_promises4 = require("fs/promises");
    recordFile = process.env.OPD_RECORD_FIXTURES;
    replayFile = process.env.OPD_REPLAY_FIXTURES;
    replayEvents = [];
    replayIdx = 0;
    proc = { run, runStream, spawnStream, has };
  }
});

// src/core/provider-system/providers/virtual.ts
var virtual_exports = {};
__export(virtual_exports, {
  VirtualProvider: () => VirtualProvider
});
var import_node_path16, VirtualProvider;
var init_virtual = __esm({
  "src/core/provider-system/providers/virtual.ts"() {
    "use strict";
    init_fs();
    import_node_path16 = require("path");
    VirtualProvider = class {
      id;
      constructor(baseId) {
        this.id = `${baseId}-virtual`;
      }
      /**
       * Minimal capabilities advertised for docs/UX; can be extended.
       */
      getCapabilities() {
        return {
          name: "Virtual Provider",
          supportsLocalBuild: true,
          supportsRemoteBuild: false,
          supportsStaticDeploy: true,
          supportsServerless: false,
          supportsEdgeFunctions: false,
          supportsSsr: false,
          hasProjectLinking: false,
          envContexts: ["preview", "production"],
          supportsLogsFollow: true,
          supportsAliasDomains: false,
          supportsRollback: false
        };
      }
      async detect(_cwd) {
        return { framework: "static", publishDir: "dist" };
      }
      async validateAuth(_cwd) {
        return;
      }
      async link(_cwd, project) {
        return project;
      }
      async build(args) {
        const artifactDir = args.publishDirHint ?? "dist";
        return { ok: true, artifactDir };
      }
      async deploy(args) {
        const env = args.envTarget;
        const url = env === "production" ? "https://example-prod.virtual.app" : "https://example-preview.virtual.app";
        const logsUrl = "https://virtual.dev/provider/logs/abc123";
        return { ok: true, url, logsUrl };
      }
      async open(_project) {
        return;
      }
      async envList(_project) {
        return {};
      }
      async envSet(_project, _kv) {
        return;
      }
      async logs(_project, _options) {
        return;
      }
      async generateConfig(args) {
        const filename = "virtual.config.json";
        const path = (0, import_node_path16.join)(args.cwd, filename);
        const exists2 = await fsx.exists(path);
        if (!exists2 || args.overwrite) {
          await fsx.writeJson(path, {
            provider: "virtual",
            framework: args.detection.framework ?? "static",
            publishDir: args.detection.publishDir ?? "dist"
          });
        }
        return filename;
      }
    };
  }
});

// src/utils/hints.ts
function keyOf(rule) {
  return rule.id;
}
function matchRules(args) {
  const t = args.text;
  const p = args.provider;
  const out = [];
  for (const r of RULES) {
    if (r.provider && p && r.provider !== p) continue;
    if (r.pattern.test(t)) out.push(r);
  }
  return out;
}
function handleHints(args) {
  const hits = matchRules(args);
  if (hits.length === 0) return;
  for (const r of hits) {
    const k = keyOf(r);
    if (EMITTED.has(k)) continue;
    EMITTED.add(k);
    if (process.env.OPD_NDJSON === "1") logger.json({ action: "hint", provider: args.provider, kind: r.kind, message: r.message, docsUrl: r.docsUrl });
    if (process.env.OPD_JSON !== "1" && process.env.OPD_NDJSON !== "1") logger.note(`Hint: ${r.message}`);
  }
}
var EMITTED, RULES;
var init_hints = __esm({
  "src/utils/hints.ts"() {
    "use strict";
    init_logger();
    EMITTED = /* @__PURE__ */ new Set();
    RULES = [
      {
        id: "pnpm-approve-builds",
        pattern: /Ignored build scripts:/i,
        kind: "dependency",
        message: 'pnpm v9 blocked postinstall scripts (e.g., @tailwindcss/oxide, esbuild). Run "pnpm approve-builds" or add { "pnpm": { "trustedDependencies": ["@tailwindcss/oxide","esbuild"] } } to package.json.'
      },
      {
        id: "env-missing",
        pattern: /(Missing required (environment )?variables?|not found in process\.env|Environment variable .+ is required|ReferenceError: process is not defined)/i,
        kind: "env",
        message: "Missing environment variables. Consider: opd env pull <provider> --env preview; or opd env sync <provider> --file .env.local."
      },
      {
        id: "fs-watch-limit",
        pattern: /ENOSPC: System limit for number of file watchers reached|inotify watch limits reached/i,
        kind: "platform",
        message: "File watcher limit reached. Increase inotify/fs.watch limits or run builds in CI/Linux/WSL."
      },
      {
        id: "cf-wrangler-output-dir",
        provider: "cloudflare",
        pattern: /pages_build_output_dir\s+.*not found|Cannot find output directory/i,
        kind: "config",
        message: 'wrangler.toml: set pages_build_output_dir = ".vercel/output/static" for Next on Pages.'
      },
      {
        id: "cf-nodejs-compat",
        provider: "cloudflare",
        pattern: /ReferenceError:\s*require\s+is\s+not\s+defined|node:.* module not found/i,
        kind: "runtime",
        message: 'wrangler.toml: add compatibility_flags = ["nodejs_compat"].'
      },
      {
        id: "gh-next-export-missing",
        provider: "github",
        pattern: /No static files found in 'out'|ENOENT.*out\/_next\/static/i,
        kind: "build",
        message: 'Next.js \u2192 GitHub Pages: enable static export (next.config: { output: "export" }) and build to out/.'
      }
    ];
  }
});

// src/core/provider-system/providers/vercel.ts
var vercel_exports = {};
__export(vercel_exports, {
  VercelProvider: () => VercelProvider
});
var import_node_path17, import_promises10, import_promises11, VercelProvider;
var init_vercel = __esm({
  "src/core/provider-system/providers/vercel.ts"() {
    "use strict";
    init_process();
    import_node_path17 = require("path");
    import_promises10 = require("fs/promises");
    init_auto();
    import_promises11 = require("fs/promises");
    init_hints();
    VercelProvider = class {
      id = "vercel";
      async resolveVercel(cwd) {
        const envBin = process.env.OPD_VERCEL_BIN;
        if (envBin && envBin.length > 0) {
          const chk = await proc.run({ cmd: `${envBin} --version`, cwd });
          if (chk.ok) return envBin;
        }
        const tryCmd = async (cmd) => {
          const r = await proc.run({ cmd: `${cmd} --version`, cwd });
          return r.ok ? cmd : void 0;
        };
        const direct = await tryCmd("vercel");
        if (direct) return "vercel";
        if (process.platform === "win32") {
          const directCmd = await tryCmd("vercel.cmd");
          if (directCmd) return "vercel.cmd";
          const whereCmd = await proc.run({ cmd: "where vercel.cmd", cwd });
          if (whereCmd.ok) {
            const lines = (whereCmd.stdout || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
            if (lines.length > 0) return lines[0];
          }
          const whereExe = await proc.run({ cmd: "where vercel", cwd });
          if (whereExe.ok) {
            const lines = (whereExe.stdout || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
            const cmdLine = lines.find((l) => l.toLowerCase().endsWith(".cmd"));
            if (cmdLine) return cmdLine;
            if (lines.length > 0 && !/\.[a-z]+$/i.test(lines[0])) return "vercel";
            if (lines.length > 0) return lines[0];
          }
        }
        const npx = await tryCmd("npx -y vercel");
        if (npx) return "npx -y vercel";
        if (process.platform === "win32") {
          const npxCmd = await tryCmd("npx.cmd -y vercel");
          if (npxCmd) return "npx.cmd -y vercel";
        }
        const dlx = await tryCmd("pnpm dlx vercel");
        if (dlx) return "pnpm dlx vercel";
        if (process.platform === "win32") {
          const dlxCmd = await tryCmd("pnpm.cmd dlx vercel");
          if (dlxCmd) return "pnpm.cmd dlx vercel";
        }
        return "vercel";
      }
      getCapabilities() {
        return {
          name: "Vercel",
          supportsLocalBuild: false,
          supportsRemoteBuild: true,
          supportsStaticDeploy: true,
          supportsServerless: true,
          supportsEdgeFunctions: true,
          supportsSsr: true,
          hasProjectLinking: true,
          envContexts: ["preview", "production"],
          supportsLogsFollow: true,
          supportsAliasDomains: true,
          supportsRollback: false
        };
      }
      async detect(cwd) {
        try {
          const det = await detectApp({ cwd });
          return { framework: det.framework, publishDir: det.publishDir };
        } catch {
          return {};
        }
      }
      async validateAuth(cwd) {
        const bin = await this.resolveVercel(cwd);
        if (process.env.OPD_TEST_NO_SPAWN === "1") return;
        const ver = await proc.run({ cmd: `${bin} --version`, cwd });
        if (!ver.ok) throw new Error("Vercel CLI not found. Install from https://vercel.com/cli or npm i -g vercel");
        const who = await proc.run({ cmd: `${bin} whoami`, cwd });
        if (!who.ok) throw new Error("Vercel not logged in. Run: vercel login");
      }
      async link(cwd, project) {
        const bin = await this.resolveVercel(cwd);
        const flags = ["--yes"];
        if (project.projectId) flags.push(`--project ${project.projectId}`);
        if (project.orgId) flags.push(`--org ${project.orgId}`);
        if (flags.length > 1) {
          const stepTimeout = Number.isFinite(Number(process.env.OPD_TIMEOUT_MS)) ? Number(process.env.OPD_TIMEOUT_MS) : 12e4;
          await runWithRetry({ cmd: `${bin} link ${flags.join(" ")}`.trim(), cwd }, { timeoutMs: stepTimeout });
        }
        try {
          const buf = await (0, import_promises10.readFile)((0, import_node_path17.join)(cwd, ".vercel", "project.json"), "utf8");
          const js = JSON.parse(buf);
          if (typeof js.projectId === "string") return { projectId: js.projectId, orgId: project.orgId };
        } catch {
        }
        return project;
      }
      async build(_args) {
        return { ok: true };
      }
      async deploy(args) {
        if (process.env.OPD_TEST_NO_SPAWN === "1") {
          const url = "https://example-preview.vercel.app";
          const logsUrl2 = "https://vercel.com/acme/app/inspect/dep_123";
          return { ok: true, url, logsUrl: logsUrl2 };
        }
        const bin = await this.resolveVercel(args.cwd);
        const prod = args.envTarget === "production";
        const cmd = prod ? `${bin} deploy --prod --yes` : `${bin} deploy --yes`;
        let deployedUrl;
        let logsUrl;
        const urlRe = /https?:\/\/[^\s]+vercel\.app/g;
        const inspectRe = /https?:\/\/[^\s]*vercel\.com[^\s]*/g;
        const deployTimeout = Number.isFinite(Number(process.env.OPD_TIMEOUT_MS)) ? Number(process.env.OPD_TIMEOUT_MS) : 9e5;
        const ctl = proc.spawnStream({
          cmd,
          cwd: args.cwd,
          timeoutMs: deployTimeout,
          onStdout: (chunk) => {
            try {
              handleHints({ provider: "vercel", text: chunk });
            } catch {
            }
            const m = chunk.match(urlRe);
            if (!deployedUrl && m && m.length > 0) deployedUrl = m[0];
          },
          onStderr: (chunk) => {
            try {
              handleHints({ provider: "vercel", text: chunk });
            } catch {
            }
            if (!logsUrl) {
              const m = chunk.match(inspectRe);
              if (m && m.length > 0) logsUrl = m[0];
            }
          }
        });
        const res = await ctl.done;
        if (!res.ok) return { ok: false, message: "Vercel deploy failed" };
        if (!logsUrl && deployedUrl) {
          try {
            const inspectCmd = `vercel inspect ${deployedUrl}`;
            const out = await proc.run({ cmd: inspectCmd, cwd: args.cwd });
            if (out.ok) {
              const m = out.stdout.match(/https?:\/\/[^\s]*vercel\.com[^\s]*/g);
              if (m && m.length > 0) logsUrl = m[0];
            }
          } catch {
          }
        }
        return { ok: true, url: deployedUrl, logsUrl };
      }
      async open(_project) {
        return;
      }
      async envList(_project) {
        return {};
      }
      async envSet(_project, _kv) {
        return;
      }
      async logs(_project) {
        return;
      }
      /**
       * Write a minimal vercel.json using detection hints.
       */
      async generateConfig(args) {
        const path = (0, import_node_path17.join)(args.cwd, "vercel.json");
        if (args.overwrite !== true) {
          try {
            const s = await (0, import_promises11.stat)(path);
            if (s.isFile()) return path;
          } catch {
          }
        }
        const config2 = {
          $schema: "https://openapi.vercel.sh/vercel.json",
          version: 2,
          buildCommand: args.detection.buildCommand
        };
        if (args.detection.publishDir) config2.outputDirectory = args.detection.publishDir;
        const content = `${JSON.stringify(config2, null, 2)}
`;
        await (0, import_promises11.writeFile)(path, content, "utf8");
        return path;
      }
    };
  }
});

// src/core/provider-system/providers/cloudflare-pages.ts
var cloudflare_pages_exports = {};
__export(cloudflare_pages_exports, {
  CloudflarePagesProvider: () => CloudflarePagesProvider
});
var import_node_path18, import_promises12, CloudflarePagesProvider;
var init_cloudflare_pages = __esm({
  "src/core/provider-system/providers/cloudflare-pages.ts"() {
    "use strict";
    import_node_path18 = require("path");
    import_promises12 = require("fs/promises");
    init_process();
    init_logger();
    init_fs();
    init_auto();
    init_hints();
    CloudflarePagesProvider = class {
      id = "cloudflare";
      async resolveWrangler(cwd) {
        const envBin = process.env.OPD_WRANGLER_BIN;
        if (envBin && envBin.length > 0) {
          const chk = await proc.run({ cmd: `${envBin} --version`, cwd });
          if (chk.ok) return envBin;
        }
        const ver = await proc.run({ cmd: "wrangler --version", cwd });
        if (ver.ok) return "wrangler";
        if (process.platform === "win32") {
          const verCmd = await proc.run({ cmd: "wrangler.cmd --version", cwd });
          if (verCmd.ok) return "wrangler.cmd";
          const whereCmd = await proc.run({ cmd: "where wrangler.cmd", cwd });
          if (whereCmd.ok) {
            const first = (whereCmd.stdout || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
            if (first) return first;
          }
          const whereExe = await proc.run({ cmd: "where wrangler", cwd });
          if (whereExe.ok) {
            const first = (whereExe.stdout || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
            if (first) return first;
          }
        }
        const verNpx = await proc.run({ cmd: "npx -y wrangler --version", cwd });
        if (verNpx.ok) return "npx -y wrangler";
        if (process.platform === "win32") {
          const verNpxCmd = await proc.run({ cmd: "npx.cmd -y wrangler --version", cwd });
          if (verNpxCmd.ok) return "npx.cmd -y wrangler";
        }
        const verPnpm = await proc.run({ cmd: "pnpm dlx wrangler --version", cwd });
        if (verPnpm.ok) return "pnpm dlx wrangler";
        if (process.platform === "win32") {
          const verPnpmCmd = await proc.run({ cmd: "pnpm.cmd dlx wrangler --version", cwd });
          if (verPnpmCmd.ok) return "pnpm.cmd dlx wrangler";
        }
        return "wrangler";
      }
      /** Return capability declaration used by the CLI to adapt flows */
      getCapabilities() {
        return {
          name: "Cloudflare Pages",
          supportsLocalBuild: true,
          supportsRemoteBuild: false,
          supportsStaticDeploy: true,
          supportsServerless: true,
          // via Pages Functions
          supportsEdgeFunctions: true,
          supportsSsr: true,
          hasProjectLinking: true,
          // project name
          envContexts: ["preview", "production"],
          supportsLogsFollow: false,
          supportsAliasDomains: false,
          supportsRollback: false
        };
      }
      /** Heuristic detection using our auto detector */
      async detect(cwd) {
        try {
          const det = await detectApp({ cwd });
          return { framework: det.framework, publishDir: det.publishDir ?? "dist" };
        } catch {
          return { publishDir: "dist" };
        }
      }
      /** Validate wrangler auth is ready */
      async validateAuth(cwd) {
        const bin = await this.resolveWrangler(cwd);
        const ver = await proc.run({ cmd: `${bin} --version`, cwd });
        if (!ver.ok) throw new Error("Wrangler not found. Install with: npm i -g wrangler");
        const who = await proc.run({ cmd: `${bin} whoami`, cwd });
        if (!who.ok) throw new Error("Wrangler not logged in. Run: wrangler login");
      }
      /** Linking is name-based for Pages; we accept and return the provided ref */
      async link(cwd, project) {
        const base = cwd.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "site";
        const name = (project.projectId || project.slug || base).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-").replace(/^-+|-+$/g, "") || "site";
        const bin = await this.resolveWrangler(cwd);
        const tryCreate = async (cmd) => {
          const out = await proc.run({ cmd, cwd });
          if (out.ok) return true;
          const text = (out.stderr || out.stdout || "").toLowerCase();
          if (text.includes("already exists") || text.includes("exists")) return true;
          return false;
        };
        const created = await tryCreate(`${bin} pages project create ${name} --production-branch main`);
        if (!created) {
          await tryCreate(`${bin} pages project create ${name}`);
        }
        return { projectId: name, orgId: project.orgId, slug: name };
      }
      /**
       * Build is user-project specific; we expect the caller to have built already
       * when necessary. We return an artifactDir derived from publishDirHint when available.
       */
      async build(args) {
        try {
          const wantBuild = args.noBuild !== true;
          let fw = args.framework;
          if (!fw) {
            try {
              const det = await detectApp({ cwd: args.cwd });
              fw = det.framework;
            } catch {
            }
          }
          const isNext = (fw || "").toLowerCase() === "next";
          if (wantBuild && isNext) {
            logger.note("Cloudflare Pages: building with @cloudflare/next-on-pages");
            try {
              await (0, import_promises12.rm)((0, import_node_path18.join)(args.cwd, ".vercel", "output"), { recursive: true, force: true });
            } catch {
            }
            try {
              await (0, import_promises12.rm)((0, import_node_path18.join)(args.cwd, ".next"), { recursive: true, force: true });
            } catch {
            }
            const env = { ...process.env, DEPLOY_TARGET: "cloudflare", NEXT_PUBLIC_BASE_PATH: "" };
            const localCmd = process.platform === "win32" ? "node_modules/.bin/next-on-pages.cmd" : "node_modules/.bin/next-on-pages";
            const envFile = (0, import_node_path18.join)(args.cwd, ".env.production");
            let prevEnv = null;
            let hadPrev = false;
            try {
              prevEnv = await (0, import_promises12.readFile)(envFile, "utf8");
              hadPrev = true;
            } catch {
            }
            const enforcedEnv = `DEPLOY_TARGET=cloudflare
NEXT_PUBLIC_BASE_PATH=
NEXT_IGNORE_BUILD_CACHE=1
`;
            try {
              await (0, import_promises12.writeFile)(envFile, hadPrev ? `${prevEnv}
${enforcedEnv}` : enforcedEnv, "utf8");
            } catch {
            }
            const candidates2 = [
              localCmd,
              "pnpm exec @cloudflare/next-on-pages",
              process.platform === "win32" ? "pnpm.cmd exec @cloudflare/next-on-pages" : "",
              "npx -y @cloudflare/next-on-pages@1",
              process.platform === "win32" ? "npx.cmd -y @cloudflare/next-on-pages@1" : ""
            ].filter(Boolean);
            let built = false;
            for (const cmd of candidates2) {
              const res = await proc.run({ cmd, cwd: args.cwd, env });
              try {
                handleHints({ provider: "cloudflare", text: (res.stderr || "") + " " + (res.stdout || "") });
              } catch {
              }
              if (res.ok) {
                built = true;
                break;
              }
            }
            try {
              if (hadPrev && prevEnv !== null) await (0, import_promises12.writeFile)(envFile, prevEnv, "utf8");
              else await (0, import_promises12.rm)(envFile, { force: true });
            } catch {
            }
            const cfStatic = (0, import_node_path18.join)(args.cwd, ".vercel", "output", "static");
            const exists2 = await fsx.exists(cfStatic);
            if (!built || !exists2) {
              const msg = "Next on Pages build did not produce .vercel/output/static. Ensure @cloudflare/next-on-pages is installed and compatible, and try again.";
              logger.warn(msg);
              return { ok: false, message: msg };
            }
            try {
              const want = process.env.OPD_CF_ADD_SUBPATH_REDIRECTS === "1";
              let detected = false;
              if (!want) {
                const candidates3 = [
                  (0, import_node_path18.join)(cfStatic, "index.html"),
                  (0, import_node_path18.join)(cfStatic, "docs", "index.html")
                ];
                for (const f of candidates3) {
                  try {
                    const ok = await fsx.exists(f);
                    if (!ok) continue;
                    const html = await (0, import_promises12.readFile)(f, "utf8");
                    if (html.includes("/opendeploy-cli-docs-site/")) {
                      detected = true;
                      break;
                    }
                  } catch {
                  }
                }
              }
              if (want || detected) {
                const redirects = [
                  "/opendeploy-cli-docs-site     /   301",
                  "/opendeploy-cli-docs-site/*   /:splat   301",
                  "/opendeploy-cli-docs-site/_next/*   /_next/:splat   200",
                  "/opendeploy-cli-docs-site/docs/*   /docs/:splat   200",
                  "/opendeploy-cli-docs-site/data/*   /data/:splat   200"
                ].join("\n") + "\n";
                await (0, import_promises12.writeFile)((0, import_node_path18.join)(cfStatic, "_redirects"), redirects, "utf8");
                logger.note("Added Cloudflare _redirects to normalize subpath links to root (opt-in/detected)");
              } else {
                logger.info("Skipping _redirects generation (no stale subpath references detected)");
              }
            } catch {
            }
            return { ok: true, artifactDir: cfStatic };
          }
        } catch {
        }
        const candidates = [];
        if (args.publishDirHint) candidates.push(args.publishDirHint);
        candidates.push("dist", "build", "out", "public");
        for (const c of candidates) {
          const full = (0, import_node_path18.join)(args.cwd, c);
          try {
            if (await fsx.exists(full)) return { ok: true, artifactDir: full };
          } catch {
          }
        }
        const hint = args.publishDirHint ? (0, import_node_path18.join)(args.cwd, args.publishDirHint) : (0, import_node_path18.join)(args.cwd, "dist");
        return { ok: true, artifactDir: hint };
      }
      /** Deploys using wrangler pages deploy <dir> --project-name <name> */
      async deploy(args) {
        const bin = await this.resolveWrangler(args.cwd);
        const projectName = args.project.projectId ?? args.project.slug;
        const dir = args.artifactDir || (0, import_node_path18.join)(args.cwd, "dist");
        try {
          if (!await fsx.exists(dir)) return { ok: false, message: `Artifact directory not found: ${dir}. Run your build or set publishDir.` };
        } catch {
        }
        const projFlag = projectName ? ` --project-name ${projectName}` : "";
        const cmd = `${bin} pages deploy ${dir}${projFlag}`;
        const out = await proc.run({ cmd, cwd: args.cwd });
        try {
          handleHints({ provider: "cloudflare", text: (out.stderr || "") + " " + (out.stdout || "") });
        } catch {
        }
        if (!out.ok) {
          const msg = (out.stderr || out.stdout || "").trim() || "Cloudflare deploy failed";
          return { ok: false, message: msg };
        }
        const urls = out.stdout.match(/https?:\/\/[^\s]+/g) || [];
        const deployUrl = urls.find((u) => /\.pages\.dev\b/i.test(u)) || urls[0];
        let logsUrl;
        logsUrl = urls.find((u) => /dash\.cloudflare\.com\//i.test(u));
        if (!logsUrl && projectName) {
          logsUrl = `https://dash.cloudflare.com/?to=/:account/pages/view/${projectName}`;
        }
        if (projectName) {
          try {
            const listCmd = `${bin} pages deployments list --project-name ${projectName} --limit 1`;
            const info = await proc.run({ cmd: listCmd, cwd: args.cwd });
            if (info.ok) {
              const m = info.stdout.match(/https?:\/\/[^\s]+/g);
              if (m && m.length > 0) {
                const inspect = m.find((u) => /dash\.cloudflare\.com\//i.test(u));
                if (inspect) logsUrl = inspect;
              }
            }
          } catch {
          }
        }
        return { ok: true, url: deployUrl, logsUrl };
      }
      async open(_project) {
        return;
      }
      async envList(_project) {
        return {};
      }
      async envSet(_project, _kv) {
        return;
      }
      async logs(_project) {
        return;
      }
      /**
       * Generate a minimal wrangler.toml. This file is optional for static Pages,
       * but we create it as a convenient placeholder and return its path.
       */
      async generateConfig(args) {
        void args.detection;
        const path = (0, import_node_path18.join)(args.cwd, "wrangler.toml");
        if (args.overwrite !== true) {
          try {
            const s = await (0, import_promises12.stat)(path);
            if (s.isFile()) return path;
          } catch {
          }
        }
        const base = args.cwd.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "site";
        const name = base.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-").replace(/^-+|-+$/g, "") || "site";
        const body = `# Auto-generated by OpenDeploy CLI (Cloudflare Pages)
# This minimal file is optional for static Pages.
# Add a functions directory and additional settings as needed.
name = "${name}"
`;
        await (0, import_promises12.writeFile)(path, body, "utf8");
        return path;
      }
    };
  }
});

// src/core/provider-system/providers/github-pages.ts
var github_pages_exports = {};
__export(github_pages_exports, {
  GithubPagesProvider: () => GithubPagesProvider
});
function parseGitRemote(remote) {
  const t = remote.trim();
  const httpsRe = /^https?:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/i;
  const m1 = t.match(httpsRe);
  if (m1) return { owner: m1[1], repo: m1[2] };
  const sshRe = /^git@github\.com:(.+?)\/(.+?)(?:\.git)?$/i;
  const m2 = t.match(sshRe);
  if (m2) return { owner: m2[1], repo: m2[2] };
  return {};
}
var import_node_path19, import_promises13, GithubPagesProvider;
var init_github_pages = __esm({
  "src/core/provider-system/providers/github-pages.ts"() {
    "use strict";
    import_node_path19 = require("path");
    init_process();
    init_logger();
    init_fs();
    init_auto();
    import_promises13 = require("fs/promises");
    init_hints();
    GithubPagesProvider = class {
      id = "github";
      /** Resolve a working gh-pages binary on the current platform. */
      async resolveGhPagesBin(cwd) {
        const envBin = process.env.OPD_GHPAGES_BIN;
        if (envBin && envBin.length > 0) {
          const chk = await proc.run({ cmd: `${envBin} --help`, cwd });
          if (chk.ok) return envBin;
        }
        const local = await proc.run({ cmd: "gh-pages --help", cwd });
        if (local.ok) return "gh-pages";
        if (process.platform === "win32") {
          const whereCmd = await proc.run({ cmd: "where gh-pages.cmd", cwd });
          if (whereCmd.ok) {
            const first = (whereCmd.stdout || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
            if (first) return first;
          }
          const whereExe = await proc.run({ cmd: "where gh-pages", cwd });
          if (whereExe.ok) {
            const first = (whereExe.stdout || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
            if (first) return first;
          }
        }
        const npx = await proc.run({ cmd: "npx -y gh-pages --help", cwd });
        if (npx.ok) return "npx -y gh-pages";
        if (process.platform === "win32") {
          const npxCmd = await proc.run({ cmd: "npx.cmd -y gh-pages --help", cwd });
          if (npxCmd.ok) return "npx.cmd -y gh-pages";
        }
        const dlx = await proc.run({ cmd: "pnpm dlx gh-pages --help", cwd });
        if (dlx.ok) return "pnpm dlx gh-pages";
        if (process.platform === "win32") {
          const dlxCmd = await proc.run({ cmd: "pnpm.cmd dlx gh-pages --help", cwd });
          if (dlxCmd.ok) return "pnpm.cmd dlx gh-pages";
        }
        return "gh-pages";
      }
      /** Return capabilities to help the CLI adapt flows for this provider. */
      getCapabilities() {
        return {
          name: "GitHub Pages",
          supportsLocalBuild: true,
          supportsRemoteBuild: false,
          supportsStaticDeploy: true,
          supportsServerless: false,
          supportsEdgeFunctions: false,
          supportsSsr: false,
          hasProjectLinking: false,
          envContexts: ["production"],
          supportsLogsFollow: false,
          supportsAliasDomains: false,
          supportsRollback: false
        };
      }
      /**
       * Detect framework and publish directory.
       * Falls back to 'dist' when detection is inconclusive.
       */
      async detect(cwd) {
        try {
          const det = await detectApp({ cwd });
          const fw = det.framework?.toLowerCase();
          const publish = fw === "next" ? "out" : det.publishDir ?? "dist";
          return { framework: det.framework, publishDir: publish };
        } catch {
          return { publishDir: "dist" };
        }
      }
      /** Validate Git and GitHub remote prerequisites for gh-pages deploy. */
      async validateAuth(cwd) {
        const git = await proc.run({ cmd: "git --version", cwd });
        if (!git.ok) throw new Error("Git not found. Install Git to deploy to GitHub Pages.");
        const origin = await proc.run({ cmd: "git remote get-url origin", cwd });
        if (!origin.ok) throw new Error("No GitHub remote detected. Ensure `origin` remote points to GitHub.");
      }
      /**
       * Linking for GitHub Pages is implicit; derive owner/repo from the origin remote when possible.
       * Returns a minimal project reference.
       */
      async link(cwd, project) {
        try {
          const origin = await proc.run({ cmd: "git remote get-url origin", cwd });
          if (origin.ok) {
            const { owner, repo } = parseGitRemote(origin.stdout.trim());
            if (owner && repo) return { projectId: repo, orgId: owner, slug: `${owner}/${repo}` };
          }
        } catch {
        }
        const base = cwd.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "site";
        return { projectId: base, slug: base };
      }
      /**
       * Resolve an artifact directory. Does not run a user build.
       */
      async build(args) {
        try {
          const wantBuild = args.noBuild !== true;
          let fw = args.framework;
          let publishHint = args.publishDirHint;
          if (!fw || !publishHint) {
            try {
              const det = await detectApp({ cwd: args.cwd });
              fw = fw || det.framework;
              publishHint = publishHint || det.publishDir;
            } catch {
            }
          }
          if (wantBuild) {
            const lower = (fw || "").toLowerCase();
            if (lower === "next") {
              logger.note('GitHub Pages: building Next.js for static export (next build with output: "export")');
              const b = await proc.run({ cmd: "npx -y next build", cwd: args.cwd, env: { ...process.env, DEPLOY_TARGET: "github" } });
              if (!b.ok) logger.warn(b.stderr.trim() || b.stdout.trim() || "next build failed");
              try {
                await this.checkNextHints(args.cwd);
              } catch {
              }
              const outDir = (0, import_node_path19.join)(args.cwd, "out");
              try {
                if (!await fsx.exists(outDir)) logger.warn('Next.js build did not produce ./out. Ensure next.config.js sets output: "export" and images.unoptimized: true.');
              } catch {
              }
              try {
                if (!await fsx.exists((0, import_node_path19.join)(outDir, "_next"))) logger.warn("Missing ./out/_next assets. Set basePath/assetPrefix for GitHub Pages and enable trailingSlash: true.");
              } catch {
              }
            } else if (lower === "astro") {
              logger.note("GitHub Pages: building Astro (astro build)");
              const ex = await proc.run({ cmd: "npx -y astro build", cwd: args.cwd });
              if (!ex.ok) logger.warn(ex.stderr.trim() || ex.stdout.trim() || "astro build failed");
            } else if (lower === "sveltekit") {
              logger.note("GitHub Pages: building SvelteKit (vite build)");
              const ex = await proc.run({ cmd: "npx -y vite build", cwd: args.cwd });
              if (!ex.ok) logger.warn(ex.stderr.trim() || ex.stdout.trim() || "vite build failed");
            }
          }
        } catch {
        }
        const candidates = [];
        if (args.publishDirHint) candidates.push(args.publishDirHint);
        candidates.push("dist", "build", "out", "public");
        for (const c of candidates) {
          const full = (0, import_node_path19.join)(args.cwd, c);
          try {
            if (await fsx.exists(full)) return { ok: true, artifactDir: full };
          } catch {
          }
        }
        const hint = args.publishDirHint ? (0, import_node_path19.join)(args.cwd, args.publishDirHint) : (0, import_node_path19.join)(args.cwd, "dist");
        return { ok: true, artifactDir: hint };
      }
      /**
       * Deploy by pushing the artifact directory to the gh-pages branch using gh-pages.
       * Returns the public Pages URL when it can be inferred from the origin remote.
       */
      async deploy(args) {
        const bin = await this.resolveGhPagesBin(args.cwd);
        const dir = args.artifactDir || (0, import_node_path19.join)(args.cwd, "dist");
        try {
          if (!await fsx.exists(dir)) return { ok: false, message: `Artifact directory not found: ${dir}. Run your build or set publishDir.` };
        } catch {
        }
        try {
          const marker = (0, import_node_path19.join)(dir, ".nojekyll");
          if (!await fsx.exists(marker)) await (0, import_promises13.writeFile)(marker, "", "utf8");
        } catch {
        }
        const cmd = `${bin} -d ${dir} --dotfiles`;
        const out = await proc.run({ cmd, cwd: args.cwd });
        try {
          handleHints({ provider: "github", text: (out.stderr || "") + " " + (out.stdout || "") });
        } catch {
        }
        if (!out.ok) return { ok: false, message: out.stderr.trim() || out.stdout.trim() || "GitHub Pages deploy failed" };
        let url;
        try {
          const origin = await proc.run({ cmd: "git remote get-url origin", cwd: args.cwd });
          if (origin.ok) {
            const { owner, repo } = parseGitRemote(origin.stdout.trim());
            if (owner && repo) url = `https://${owner}.github.io/${repo}/`;
          }
        } catch {
        }
        return { ok: true, url };
      }
      async open(_project) {
        return;
      }
      async envList(_project) {
        return {};
      }
      async envSet(_project, _kv) {
        return;
      }
      async logs(_project) {
        return;
      }
      /**
       * GitHub Pages generally requires no config file, but we can ensure a `.nojekyll` marker.
       * Returns the path to the marker file.
       */
      async generateConfig(args) {
        void args.detection;
        const p = (0, import_node_path19.join)(args.cwd, ".nojekyll");
        if (args.overwrite !== true) {
          try {
            const s = await (0, import_promises13.stat)(p);
            if (s.isFile()) return p;
          } catch {
          }
        }
        await (0, import_promises13.writeFile)(p, "", "utf8");
        return p;
      }
      /**
       * Emit actionable hints for Next.js static export on GitHub Pages.
       */
      async checkNextHints(cwd) {
        const files = ["next.config.ts", "next.config.js", "next.config.mjs"];
        let cfg = "";
        for (const f of files) {
          try {
            const p = (0, import_node_path19.join)(cwd, f);
            if (await fsx.exists(p)) {
              cfg = await (0, import_promises13.readFile)(p, "utf8");
              break;
            }
          } catch {
          }
        }
        if (!cfg) return;
        let expectedBase;
        try {
          const origin = await proc.run({ cmd: "git remote get-url origin", cwd });
          if (origin.ok) {
            const { repo } = parseGitRemote(origin.stdout.trim());
            if (repo) expectedBase = `/${repo}`;
          }
        } catch {
        }
        const hasExport = /\boutput\s*:\s*['"]export['"]/m.test(cfg);
        if (!hasExport) logger.warn("next.config: missing output: 'export' (required for static export)");
        const hasTrailing = /\btrailingSlash\s*:\s*true/m.test(cfg);
        if (!hasTrailing) logger.warn("next.config: trailingSlash not set to true (recommended for GitHub Pages)");
        const hasUnopt = /images\s*:\s*\{[^}]*unoptimized\s*:\s*true/m.test(cfg);
        if (!hasUnopt) logger.warn("next.config: images.unoptimized not set to true (recommended for GitHub Pages)");
        const basePathMatch = /basePath\s*:\s*['"][^'"]+['"]/m.exec(cfg);
        if (!basePathMatch) logger.warn("next.config: basePath is not set (recommended for Project Pages)");
        if (expectedBase && basePathMatch) {
          const val = (basePathMatch[0].split(":")[1] || "").replace(/['"\s]/g, "");
          if (val !== expectedBase) logger.warn(`next.config: basePath mismatch (expected ${expectedBase}, got ${val})`);
        }
        const assetPrefixMatch = /assetPrefix\s*:\s*['"][^'"]+['"]/m.exec(cfg);
        if (!assetPrefixMatch) logger.warn("next.config: assetPrefix is not set (recommended for Project Pages)");
        if (expectedBase && assetPrefixMatch) {
          const val = (assetPrefixMatch[0].split(":")[1] || "").replace(/['"\s]/g, "");
          const want = `${expectedBase}/`;
          if (val !== want) logger.warn(`next.config: assetPrefix mismatch (expected ${want}, got ${val})`);
        }
      }
    };
  }
});

// src/utils/workflows.ts
var workflows_exports = {};
__export(workflows_exports, {
  renderGithubPagesWorkflow: () => renderGithubPagesWorkflow
});
function renderGithubPagesWorkflow(args) {
  const origin = args.siteOrigin || "https://<owner>.github.io";
  return `name: Deploy Docs to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch: {}

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup PNPM
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install deps
        run: pnpm install --frozen-lockfile

      - name: Build (Next 15 static export)
        env:
          NEXT_PUBLIC_SITE_ORIGIN: ${origin}
          NEXT_PUBLIC_BASE_PATH: ${args.basePath}
          NEXT_BASE_PATH: ${args.basePath}
        run: pnpm build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: out

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;
}
var import_node_path32;
var init_workflows = __esm({
  "src/utils/workflows.ts"() {
    "use strict";
    import_node_path32 = require("path");
  }
});

// src/index.ts
var import_commander19 = require("commander");

// src/commands/detect.ts
var import_commander = require("commander");
init_auto();
init_logger();
var import_ajv = __toESM(require("ajv"), 1);

// src/schemas/detect-summary.schema.ts
var detectSummarySchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: true,
  required: ["ok", "action", "final"],
  properties: {
    ok: { type: "boolean" },
    action: { const: "detect" },
    detection: { type: "object" },
    message: { type: "string" },
    final: { type: "boolean" }
  }
};

// src/commands/detect.ts
function registerDetectCommand(program) {
  const ajv = new import_ajv.default({ allErrors: true, strict: false, validateSchema: false });
  const validate = ajv.compile(detectSummarySchema);
  const annotate = (obj) => {
    const ok = validate(obj);
    const errs = Array.isArray(validate.errors) ? validate.errors.map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim()) : [];
    if (process.env.OPD_SCHEMA_STRICT === "1" && errs.length > 0) {
      process.exitCode = 1;
    }
    return { ...obj, schemaOk: ok, schemaErrors: errs };
  };
  program.command("detect").description("Detect your app (Next, Astro, SvelteKit, Remix, Nuxt; Expo when OPD_EXPERIMENTAL=1)").option("--json", "Output JSON").action(async (opts) => {
    const cwd = process.cwd();
    try {
      if (opts.json === true || process.env.OPD_JSON === "1") logger.setJsonOnly(true);
      const result = await detectApp({ cwd });
      if (opts.json === true || process.env.OPD_JSON === "1") {
        const summary = { ok: true, action: "detect", detection: result, final: true };
        logger.jsonPrint(annotate(summary));
        return;
      }
      const candidates = await detectCandidates({ cwd });
      const mark = (fw) => candidates.has(fw) ? " (detected)" : "";
      logger.info(`Framework      : ${result.framework}`);
      logger.info(`Render Mode    : ${result.renderMode}`);
      logger.info(`Root Dir       : ${result.rootDir}`);
      logger.info(`App Dir        : ${result.appDir}`);
      logger.info(`App Router     : ${result.hasAppRouter ? "yes" : "no"}`);
      logger.info(`Package Manager: ${result.packageManager}`);
      logger.info(`Monorepo Tool  : ${result.monorepo}`);
      logger.info(`Build Command  : ${result.buildCommand}`);
      logger.info(`Output Dir     : ${result.outputDir}`);
      if (result.publishDir) logger.info(`Publish Dir    : ${result.publishDir}`);
      logger.info(`Confidence     : ${result.confidence.toFixed(2)}`);
      logger.info(`Candidates     : next${mark("next")}, astro${mark("astro")}, sveltekit${mark("sveltekit")}, remix${mark("remix")}, nuxt${mark("nuxt")}${process.env.OPD_EXPERIMENTAL === "1" ? `, expo${mark("expo")}` : ""}`);
      if (result.environmentFiles.length > 0) {
        logger.info(`Env Files      : ${result.environmentFiles.join(", ")}`);
      } else {
        logger.info("Env Files      : none");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (opts.json === true || process.env.OPD_JSON === "1") {
        logger.jsonPrint(annotate({ ok: false, action: "detect", message, final: true }));
      } else {
        logger.error(message);
      }
      process.exitCode = 1;
    }
  });
}

// src/commands/doctor.ts
var import_commander2 = require("commander");
init_logger();
init_process();
var import_node_path15 = require("path");
var import_promises7 = require("fs/promises");
init_fs();
init_monorepo();
init_package_manager();

// src/utils/errors.ts
function normalize(s) {
  return (s || "").toLowerCase();
}
function mapProviderError(provider, raw) {
  const txt = normalize(raw);
  if (txt.includes("not logged in") || txt.includes("please run: vercel login")) {
    const cli = "vercel";
    return {
      code: `${provider.toUpperCase()}_AUTH_REQUIRED`,
      message: "You are not logged in to the provider CLI.",
      remedy: `Run: ${cli} login`
    };
  }
  if (provider === "vercel" && (txt.includes("unauthorized") || txt.includes("token expired") || txt.includes("401") || txt.includes("please run `vercel login`") || txt.includes("please run: vercel login"))) {
    return {
      code: "VERCEL_AUTH_EXPIRED",
      message: "Vercel authentication expired or unauthorized.",
      remedy: "Run: vercel login (or set VERCEL_TOKEN in CI)"
    };
  }
  if (txt.includes("not linked") || txt.includes("don't appear to be in a folder that is linked") || txt.includes("project not linked")) {
    const cli = "vercel link";
    return {
      code: `${provider.toUpperCase()}_NOT_LINKED`,
      message: "The current directory is not linked to a provider project.",
      remedy: `Run: ${cli} (or pass --project/--org in CI)`
    };
  }
  if (provider === "vercel" && (txt.includes("invalid project id") || txt.includes("project not found") || txt.includes("team not found") || txt.includes("org not found") || txt.includes("scope not found"))) {
    return {
      code: "VERCEL_INVALID_PROJECT_OR_TEAM",
      message: "Invalid or unknown Vercel project/org/team.",
      remedy: "Verify VERCEL_PROJECT_ID / VERCEL_ORG_ID (or pass --project/--org) or run: vercel link"
    };
  }
  if (txt.includes("i18n configuration") && txt.includes("app router")) {
    return {
      code: "NEXT_I18N_UNSUPPORTED_IN_APP_ROUTER",
      message: "Next.js i18n in next.config.* is unsupported in App Router.",
      remedy: "Use App Router i18n via route segments. See: https://nextjs.org/docs/app/building-your-applications/routing/internationalization"
    };
  }
  if (provider === "vercel" && (txt.includes("build failed") || txt.includes("failed to compile") || txt.includes('command "vercel build"') || txt.includes("error during build"))) {
    return {
      code: "VERCEL_BUILD_FAILED",
      message: "Vercel build failed.",
      remedy: "Open deploy logs; run `next build` locally; check required env with `opendeploy env diff` and `opendeploy env validate`."
    };
  }
  if (txt.includes("eslint") || txt.includes("type error") || txt.includes("typescript error")) {
    return {
      code: "NEXT_LINT_OR_TYPES_FAILED",
      message: "Build failed due to ESLint or TypeScript errors.",
      remedy: "Fix reported lint/type errors; consider disabling lint in prod builds if necessary."
    };
  }
  if (txt.includes("missing environment") || txt.includes("not defined in process.env") || txt.includes("undefined environment variable") || txt.includes("env var") && txt.includes("missing")) {
    return {
      code: "ENV_MISSING",
      message: "A required environment variable appears to be missing.",
      remedy: "Use `opendeploy env diff` to compare local vs provider; then `opendeploy env sync` to apply."
    };
  }
  if (txt.includes("module_not_found") || txt.includes("cannot find module")) {
    return {
      code: "NODE_MODULE_NOT_FOUND",
      message: "A required package/module could not be resolved during build.",
      remedy: "Reinstall dependencies and ensure Node version compatibility (e.g., pnpm install; use Node 18/20)."
    };
  }
  if (txt.includes("permission denied") || txt.includes("access denied")) {
    return {
      code: "PERMISSION_DENIED",
      message: "Permission denied during an operation.",
      remedy: "Check file permissions and provider access rights."
    };
  }
  if (txt.includes("network") || txt.includes("etimedout") || txt.includes("econnreset")) {
    return {
      code: "NETWORK_ERROR",
      message: "A network error occurred during the operation.",
      remedy: "Retry the command. If it persists, check connectivity or provider status."
    };
  }
  return {
    code: `${provider.toUpperCase()}_UNKNOWN_ERROR`,
    message: raw.trim() || "Unknown provider error."
  };
}

// src/utils/summarize.ts
init_colors();
init_logger();
var import_promises5 = require("fs/promises");
function fmtMs(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "\u2014";
  const s = Math.round(ms / 1e3);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}
function printDeploySummary(args) {
  const lines = [];
  lines.push(colors.bold("Summary"));
  lines.push(`  \u2022 Provider: ${args.provider}`);
  lines.push(`  \u2022 Target:   ${args.target}`);
  if (args.url) lines.push(`  \u2022 URL:      ${colors.cyan(args.url)}`);
  if (args.projectId) lines.push(`  \u2022 Project:  ${args.projectId}`);
  if (args.durationMs !== void 0) lines.push(`  \u2022 Duration: ${fmtMs(args.durationMs)}`);
  if (args.logsUrl) lines.push(`  \u2022 Inspect:  ${args.logsUrl}`);
  logger.info("\n" + lines.join("\n"));
  const gh = process.env.GITHUB_STEP_SUMMARY;
  if (gh) {
    const md = [
      "## OpenDeploy \u2014 Deploy Summary",
      "",
      `- Provider: ${args.provider}`,
      `- Target: ${args.target}`,
      args.url ? `- URL: ${args.url}` : "",
      args.projectId ? `- Project: ${args.projectId}` : "",
      args.durationMs !== void 0 ? `- Duration: ${fmtMs(args.durationMs)}` : "",
      args.logsUrl ? `- Inspect: ${args.logsUrl}` : "",
      ""
    ].filter(Boolean).join("\n");
    void (0, import_promises5.appendFile)(gh, md + "\n", "utf8").catch(() => {
    });
  }
}
function printEnvPullSummary(args) {
  const lines = [];
  lines.push(colors.bold("Summary"));
  lines.push(`  \u2022 Provider: ${args.provider}`);
  if (args.env) lines.push(`  \u2022 Environment: ${args.env}`);
  lines.push(`  \u2022 Output:   ${args.out}`);
  if (typeof args.count === "number") lines.push(`  \u2022 Variables: ${args.count}`);
  logger.info("\n" + lines.join("\n"));
}
function printEnvSyncSummary(args) {
  const lines = [];
  lines.push(colors.bold("Summary"));
  lines.push(`  \u2022 Provider: ${args.provider}`);
  lines.push(`  \u2022 File:     ${args.file}`);
  lines.push(`  \u2022 Set:      ${args.setCount}`);
  lines.push(`  \u2022 Skipped:  ${args.skippedCount}`);
  if (args.failedCount > 0) lines.push(`  \u2022 Failed:   ${args.failedCount}`);
  logger.info("\n" + lines.join("\n"));
}
function printEnvDiffSummary(args) {
  const lines = [];
  lines.push(colors.bold("Summary"));
  lines.push(`  \u2022 Provider: ${args.provider}`);
  if (args.env) lines.push(`  \u2022 Environment: ${args.env}`);
  lines.push(`  \u2022 Added:    ${args.added}`);
  lines.push(`  \u2022 Removed:  ${args.removed}`);
  lines.push(`  \u2022 Changed:  ${args.changed}`);
  lines.push(`  \u2022 Status:   ${args.ok ? colors.green("OK") : colors.yellow("DIFFS")}`);
  logger.info("\n" + lines.join("\n"));
  const gh = process.env.GITHUB_STEP_SUMMARY;
  if (gh) {
    const total = args.added + args.removed + args.changed;
    const mdParts = [
      "## OpenDeploy \u2014 Env Diff Summary",
      "",
      `- Provider: ${args.provider}`,
      args.env ? `- Environment: ${args.env}` : "",
      `- Added: ${args.added}`,
      `- Removed: ${args.removed}`,
      `- Changed: ${args.changed}`,
      `- Status: ${args.ok ? "OK" : "DIFFS"}`,
      ""
    ].filter(Boolean);
    if (total > 0 && total <= 10) {
      mdParts.push("| Type | Key |");
      mdParts.push("|---|---|");
      for (const k of args.addedKeys ?? []) mdParts.push(`| added | ${k} |`);
      for (const k of args.removedKeys ?? []) mdParts.push(`| removed | ${k} |`);
      for (const k of args.changedKeys ?? []) mdParts.push(`| changed | ${k} |`);
      mdParts.push("");
    }
    const md = mdParts.join("\n");
    void (0, import_promises5.appendFile)(gh, md + "\n", "utf8").catch(() => {
    });
  }
}
function printDoctorSummary(args) {
  const lines = [];
  lines.push(colors.bold("Summary"));
  lines.push(`  \u2022 Checks:   ${args.total}`);
  lines.push(`  \u2022 Passed:   ${args.okCount}`);
  lines.push(`  \u2022 Issues:   ${args.failCount}`);
  logger.info("\n" + lines.join("\n"));
  const gh = process.env.GITHUB_STEP_SUMMARY;
  if (gh) {
    const mdParts = [
      "## OpenDeploy \u2014 Doctor Summary",
      "",
      `- Checks: ${args.total}`,
      `- Passed: ${args.okCount}`,
      `- Issues: ${args.failCount}`,
      ""
    ];
    if ((args.failSamples?.length ?? 0) > 0) {
      mdParts.push("| Check | Issue |");
      mdParts.push("|---|---|");
      for (const it of args.failSamples.slice(0, 5)) {
        mdParts.push(`| ${it.name} | ${it.message} |`);
      }
      mdParts.push("");
    }
    const md = mdParts.join("\n");
    void (0, import_promises5.appendFile)(gh, md + "\n", "utf8").catch(() => {
    });
  }
}

// src/commands/doctor.ts
var import_promises8 = require("fs/promises");
var import_ajv2 = __toESM(require("ajv"), 1);

// src/schemas/doctor-summary.schema.ts
var doctorSummarySchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: true,
  required: ["ok", "action", "final"],
  properties: {
    ok: { type: "boolean" },
    action: { const: "doctor" },
    final: { type: "boolean" }
  }
};

// src/commands/doctor.ts
var import_promises9 = require("fs/promises");

// src/core/detectors/apps.ts
var import_node_path14 = require("path");
var import_promises6 = require("fs/promises");
init_fs();
init_auto();
async function detectApps(args) {
  const root = args.cwd;
  const candidates = [];
  try {
    const appsDir = (0, import_node_path14.join)(root, "apps");
    const entries = await (0, import_promises6.readdir)(appsDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const full = (0, import_node_path14.join)(appsDir, e.name);
      try {
        const s = await (0, import_promises6.stat)(full);
        if (s.isDirectory()) candidates.push(full);
      } catch {
      }
    }
  } catch {
  }
  candidates.push(root);
  const results = [];
  for (const c of candidates) {
    try {
      const det = await detectApp({ cwd: c });
      let confidence = 0;
      const fw = det.framework?.toLowerCase();
      if (fw) confidence += 5;
      if (await fsx.exists((0, import_node_path14.join)(c, "next.config.js")) || await fsx.exists((0, import_node_path14.join)(c, "next.config.ts"))) confidence += 2;
      if (await fsx.exists((0, import_node_path14.join)(c, "astro.config.mjs")) || await fsx.exists((0, import_node_path14.join)(c, "astro.config.ts"))) confidence += 2;
      if (await fsx.exists((0, import_node_path14.join)(c, "svelte.config.js")) || await fsx.exists((0, import_node_path14.join)(c, "svelte.config.ts"))) confidence += 2;
      if (det.publishDir) confidence += 1;
      results.push({ path: c, framework: det.framework, confidence });
    } catch {
    }
  }
  results.sort((a, b) => b.confidence - a.confidence || a.path.length - b.path.length);
  const seen = /* @__PURE__ */ new Set();
  const uniq = [];
  for (const r of results) {
    if (!seen.has(r.path)) {
      uniq.push(r);
      seen.add(r.path);
    }
  }
  return uniq;
}
async function resolveAppPath(args) {
  const candidates = await detectApps({ cwd: args.cwd });
  const top = candidates[0];
  if (!top) return { path: args.cwd, candidates };
  const strong = top.confidence >= 5 && top.path !== args.cwd;
  if (args.ci === true) {
    return { path: strong ? top.path : args.cwd, candidates };
  }
  return { path: strong ? top.path : args.cwd, candidates };
}

// src/commands/doctor.ts
async function checkOpdGo(cwd, printCmd) {
  try {
    const override = process.env.OPD_GO_BIN;
    if (override && override.length > 0) {
      const exists2 = await fsx.exists(override);
      return { name: "opd-go (optional)", ok: exists2, message: exists2 ? `OPD_GO_BIN=${override}` : `OPD_GO_BIN points to missing file: ${override}` };
    }
    const exe = process.platform === "win32" ? "opd-go.exe" : "opd-go";
    const local = (0, import_node_path15.join)(cwd, ".bin", exe);
    if (await fsx.exists(local)) {
      return { name: "opd-go (optional)", ok: true, message: `local .bin/${exe}` };
    }
    const pathCmd = process.platform === "win32" ? "where opd-go" : "command -v opd-go";
    if (printCmd) logger.info(`$ ${pathCmd}`);
    const probe = await runWithRetry({ cmd: pathCmd, cwd });
    if (probe.ok && probe.stdout.trim().length > 0) {
      const first = probe.stdout.trim().split(/\r?\n/)[0] || "opd-go";
      return { name: "opd-go (optional)", ok: true, message: first };
    }
    return { name: "opd-go (optional)", ok: false, message: "not found (build with: pnpm build:go or set OPD_GO_BIN)" };
  } catch {
    return { name: "opd-go (optional)", ok: false, message: "not found (build with: pnpm build:go or set OPD_GO_BIN)" };
  }
}
async function checkNextGithubPages(cwd) {
  const results = [];
  const push = (name, ok, message) => {
    results.push({ name, ok, message });
  };
  let repo;
  try {
    try {
      const origin = await proc.run({ cmd: "git remote get-url origin", cwd });
      if (origin.ok) {
        const t = origin.stdout.trim();
        const httpsRe = /^https?:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/i;
        const sshRe = /^git@github\.com:(.+?)\/(.+?)(?:\.git)?$/i;
        const m1 = t.match(httpsRe);
        const m2 = t.match(sshRe);
        const r = (m1?.[2] || m2?.[2] || "").trim();
        if (r) repo = r;
      }
    } catch {
    }
    const hasNoJekyllPublic = await fsx.exists((0, import_node_path15.join)(cwd, "public", ".nojekyll"));
    const hasNoJekyllOut = await fsx.exists((0, import_node_path15.join)(cwd, "out", ".nojekyll"));
    push(".nojekyll (public/ or out/)", hasNoJekyllPublic || hasNoJekyllOut, hasNoJekyllPublic ? "public/.nojekyll" : hasNoJekyllOut ? "out/.nojekyll" : "missing");
  } catch {
    push(".nojekyll (public/ or out/)", false, "error reading");
  }
  try {
    let cfg = "";
    const candidates = ["next.config.ts", "next.config.js", "next.config.mjs"];
    for (const f of candidates) {
      const p = (0, import_node_path15.join)(cwd, f);
      if (await fsx.exists(p)) {
        cfg = await (0, import_promises9.readFile)(p, "utf8");
        break;
      }
    }
    if (cfg.length > 0) {
      const hasExport = /output\s*:\s*['"]export['"]/m.test(cfg);
      push("next.config: output: 'export'", hasExport, hasExport ? "ok" : "missing (set output: 'export')");
      const hasTrailing = /trailingSlash\s*:\s*true/m.test(cfg);
      push("next.config: trailingSlash", hasTrailing, hasTrailing ? "true" : "not set (recommended true)");
      const hasUnopt = /images\s*:\s*\{[^}]*unoptimized\s*:\s*true/m.test(cfg);
      push("next.config: images.unoptimized", hasUnopt, hasUnopt ? "true" : "not set (recommended true)");
      const hasBasePath = /basePath\s*:\s*['"][^'"]+['"]/m.test(cfg);
      push("next.config: basePath", hasBasePath, hasBasePath ? "present" : "not set (recommended for Project Pages)");
      if (repo) {
        const repoPath = `/${repo}`;
        const basePathMatch = new RegExp(`basePath\\s*:\\s*['"]${repoPath}['"]`, "m").test(cfg);
        push("next.config: basePath matches repo", basePathMatch, basePathMatch ? "ok" : hasBasePath ? `mismatch (expected ${repoPath})` : "not set");
        const assetPrefixPresent = /assetPrefix\s*:\s*['"][^'"]+['"]/m.test(cfg);
        const assetPrefixMatch = new RegExp(`assetPrefix\\s*:\\s*['"]${repoPath}/['"]`, "m").test(cfg);
        push("next.config: assetPrefix matches repo", assetPrefixMatch, assetPrefixPresent ? assetPrefixMatch ? "ok" : `mismatch (expected ${repoPath}/)` : "not set (recommended)");
      }
    } else {
      push("next.config.* present", false, "file not found");
    }
  } catch {
    push("next.config parse", false, "error reading next.config.*");
  }
  try {
    const outDir = (0, import_node_path15.join)(cwd, "out");
    if (await fsx.exists(outDir)) {
      const staticDir = (0, import_node_path15.join)(outDir, "_next", "static");
      const exists2 = await fsx.exists(staticDir);
      push("export assets (_next/static)", exists2, exists2 ? "found" : "missing");
    }
  } catch {
  }
  return results;
}
function parseNodeOk() {
  const version = process.versions.node;
  const [majorStr, minorStr] = version.split(".");
  const major = Number(majorStr);
  const minor = Number(minorStr);
  if (Number.isNaN(major) || Number.isNaN(minor)) return false;
  if (major > 18) return true;
  if (major === 18 && minor >= 17) return true;
  return false;
}
async function checkCmdAny(cmds, label, printCmd) {
  for (const c of cmds) {
    const cmd = `${c} --version`;
    if (printCmd) logger.info(`$ ${cmd}`);
    const out = await runWithRetry({ cmd });
    if (out.ok) return { name: `${label} --version`, ok: true, message: out.stdout.trim() };
  }
  return { name: `${label} --version`, ok: false, message: "not installed or not on PATH" };
}
async function checkVercelAuth(printCmd) {
  const candidates = process.platform === "win32" ? ["vercel", "vercel.cmd"] : ["vercel"];
  for (const c of candidates) {
    const cmd = `${c} whoami`;
    if (printCmd) logger.info(`$ ${cmd}`);
    const out = await runWithRetry({ cmd });
    if (out.ok && out.stdout.trim().length > 0) return { name: "vercel auth", ok: true, message: out.stdout.trim() };
  }
  return { name: "vercel auth", ok: false, message: "not logged in (run: vercel login)" };
}
async function checkWranglerAuth(printCmd) {
  const candidates = process.platform === "win32" ? ["wrangler", "wrangler.cmd"] : ["wrangler"];
  for (const c of candidates) {
    const verCmd = `${c} --version`;
    if (printCmd) logger.info(`$ ${verCmd}`);
    const ver = await runWithRetry({ cmd: verCmd });
    if (!ver.ok) continue;
    const whoCmd = `${c} whoami`;
    if (printCmd) logger.info(`$ ${whoCmd}`);
    const who = await runWithRetry({ cmd: whoCmd });
    if (who.ok && who.stdout.trim().length > 0) return { name: "wrangler auth", ok: true, message: who.stdout.trim() };
    return { name: "wrangler auth", ok: false, message: "not logged in (run: wrangler login)" };
  }
  return { name: "wrangler", ok: false, message: "not installed or not on PATH (install: npm i -g wrangler)" };
}
async function checkGitHubPagesSetup(cwd, printCmd) {
  const results = [];
  const remoteCmd = "git remote -v";
  if (printCmd) logger.info(`$ ${remoteCmd}`);
  const rem = await runWithRetry({ cmd: remoteCmd, cwd });
  const hasOrigin = rem.ok && /origin\s+/.test(rem.stdout);
  results.push({ name: "git origin remote", ok: hasOrigin, message: hasOrigin ? "found" : "missing (set with: git remote add origin <url>)" });
  const lsCmd = "git ls-remote --heads origin gh-pages";
  if (printCmd) logger.info(`$ ${lsCmd}`);
  const ls = await runWithRetry({ cmd: lsCmd, cwd });
  const hasGhPages = ls.ok && ls.stdout.trim().length > 0;
  results.push({ name: "gh-pages branch (remote)", ok: hasGhPages, message: hasGhPages ? "exists" : "not found (will be created on first publish)" });
  return results;
}
function registerDoctorCommand(program) {
  const ajv = new import_ajv2.default({ allErrors: true, strict: false, validateSchema: false });
  const validate = ajv.compile(doctorSummarySchema);
  const annotate = (obj) => {
    const ok = validate(obj);
    const errs = Array.isArray(validate.errors) ? validate.errors.map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim()) : [];
    if (process.env.OPD_SCHEMA_STRICT === "1" && errs.length > 0) {
      process.exitCode = 1;
    }
    return { ...obj, schemaOk: ok, schemaErrors: errs };
  };
  const doctorCmd = program.command("doctor").description("Validate local environment and provider CLIs").option("--ci", "CI mode (exit non-zero on warnings)").option("--json", "Output JSON").option("--verbose", "Verbose output").option("--fix", "Attempt to fix common issues (linking)").option("--path <dir>", "Working directory to check/fix (monorepos)").option("--project <id>", "Vercel project ID (for linking)").option("--org <id>", "Vercel org/team ID (for linking)").option("--print-cmd", "Print underlying provider commands that will be executed").option("--strict", "Exit non-zero when any checks fail").action(async (opts) => {
    try {
      const jsonMode = isJsonMode(opts.json);
      if (jsonMode) logger.setJsonOnly(true);
      const results = [];
      const suggestions = [];
      const nodeOk = parseNodeOk();
      results.push({ name: "node >= 18.17", ok: nodeOk, message: process.versions.node });
      const pnpmCandidates = process.platform === "win32" ? ["pnpm", "pnpm.cmd", "corepack pnpm"] : ["pnpm", "corepack pnpm"];
      const pnpm = await checkCmdAny(pnpmCandidates, "pnpm", opts.printCmd);
      results.push(pnpm);
      const bunCandidates = process.platform === "win32" ? ["bun", "bun.exe", "bun.cmd"] : ["bun"];
      const bunCli = await checkCmdAny(bunCandidates, "bun", opts.printCmd);
      results.push(bunCli);
      const goRunner = await checkOpdGo(process.cwd(), opts.printCmd);
      results.push(goRunner);
      const vercelCandidates = process.platform === "win32" ? ["vercel", "vercel.cmd"] : ["vercel"];
      const vercelCli = await checkCmdAny(vercelCandidates, "vercel", opts.printCmd);
      results.push(vercelCli);
      const wranglerCandidates = process.platform === "win32" ? ["wrangler", "wrangler.cmd"] : ["wrangler"];
      const wranglerCli = await checkCmdAny(wranglerCandidates, "wrangler", opts.printCmd);
      results.push(wranglerCli);
      const prismaCandidates = process.platform === "win32" ? ["pnpm exec prisma", "npx prisma", "prisma", "prisma.cmd"] : ["pnpm exec prisma", "npx prisma", "prisma"];
      const prismaCli = await checkCmdAny(prismaCandidates, "prisma (optional)", opts.printCmd);
      results.push(prismaCli);
      const drizzleCandidates = process.platform === "win32" ? ["pnpm exec drizzle-kit", "npx drizzle-kit", "drizzle-kit", "drizzle-kit.cmd"] : ["pnpm exec drizzle-kit", "npx drizzle-kit", "drizzle-kit"];
      const drizzleCli = await checkCmdAny(drizzleCandidates, "drizzle-kit (optional)", opts.printCmd);
      results.push(drizzleCli);
      const psqlCandidates = process.platform === "win32" ? ["psql", "psql.exe"] : ["psql"];
      const psqlCli = await checkCmdAny(psqlCandidates, "psql (optional)", opts.printCmd);
      results.push(psqlCli);
      const vercelAuth = await checkVercelAuth(opts.printCmd);
      results.push(vercelAuth);
      const wranglerAuth = await checkWranglerAuth(opts.printCmd);
      results.push(wranglerAuth);
      const cwdRoot = process.cwd();
      let cwd;
      if (opts.path && opts.path.length > 0) {
        cwd = (0, import_node_path15.join)(cwdRoot, opts.path);
      } else {
        const ciMode = Boolean(opts.ci) || process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true" || process.env.OPD_FORCE_CI === "1" || process.env.OPD_NDJSON === "1" || process.env.OPD_JSON === "1";
        const resolved = await resolveAppPath({ cwd: cwdRoot, ci: ciMode });
        cwd = resolved.path;
        if (isJsonMode(opts.json)) logger.json({ event: "app-path", path: cwd, candidates: resolved.candidates });
        else if (cwd !== cwdRoot) logger.note(`Detected app path: ${cwd}`);
      }
      const mono = await detectMonorepo({ cwd });
      results.push({ name: "monorepo", ok: mono !== "none", message: mono });
      if (mono !== "none") {
        const pm = await detectPackageManager({ cwd });
        if (pm === "pnpm") {
          const hasLock = await fsx.exists((0, import_node_path15.join)(cwd, "pnpm-lock.yaml"));
          results.push({ name: "pnpm lockfile at root", ok: hasLock, message: hasLock ? "found" : "missing" });
        }
        if (opts.fix === true) {
          try {
            const vercelLinked = await fsx.exists((0, import_node_path15.join)(cwd, ".vercel", "project.json"));
            if (!vercelLinked && opts.project) {
              const flags = ["--yes", `--project ${opts.project}`];
              if (opts.org) flags.push(`--org ${opts.org}`);
              const linkVercel = `vercel link ${flags.join(" ")}`;
              if (opts.printCmd) logger.info(`$ ${linkVercel}`);
              const res = await runWithRetry({ cmd: linkVercel, cwd });
              if (!res.ok) suggestions.push("vercel link --yes --project <id> [--org <id>]");
              else results.push({ name: "vercel link (fix)", ok: true, message: "linked" });
            }
          } catch {
          }
        }
        const projectJson = (0, import_node_path15.join)(cwd, ".vercel", "project.json");
        const linked = await fsx.exists(projectJson);
        results.push({ name: "vercel link (.vercel/project.json)", ok: linked, message: linked ? "linked" : "not linked (run: vercel link)" });
        const hasRootVercel = await fsx.exists((0, import_node_path15.join)(cwd, "vercel.json"));
        results.push({ name: "root vercel.json (optional)", ok: true, message: hasRootVercel ? "present" : "absent (ok). Prefer Vercel Git + Root Directory; add if CLI root deploys are needed." });
        const appsDir = (0, import_node_path15.join)(cwd, "apps");
        const existsApps = await fsx.exists(appsDir);
        if (existsApps) {
          try {
            const entries = await (0, import_promises7.readdir)(appsDir);
            const appDirs = [];
            for (const name of entries) {
              const p = (0, import_node_path15.join)(appsDir, name);
              try {
                const s = await (0, import_promises7.stat)(p);
                if (s.isDirectory()) appDirs.push(name);
              } catch {
              }
            }
            const reports = [];
            for (const app of appDirs) {
              const v = await fsx.exists((0, import_node_path15.join)(appsDir, app, ".vercel", "project.json"));
              if (v) reports.push(`${app}: vercel`);
            }
            if (reports.length > 0) {
              results.push({ name: "linked apps (apps/*)", ok: true, message: reports.join("; ") });
            } else {
              results.push({ name: "linked apps (apps/*)", ok: true, message: "none detected (ok)" });
            }
            if (appDirs.includes("web")) {
              const target = (0, import_node_path15.join)(appsDir, "web");
              const targetVercelLinked = await fsx.exists((0, import_node_path15.join)(target, ".vercel", "project.json"));
              const rootVercelLinked = await fsx.exists((0, import_node_path15.join)(cwd, ".vercel", "project.json"));
              const vercelRunCwd = targetVercelLinked ? target : rootVercelLinked && !targetVercelLinked ? cwd : target;
              const relVercel = vercelRunCwd.startsWith(cwd) ? vercelRunCwd.slice(cwd.length + 1) || "." : vercelRunCwd;
              results.push({ name: "vercel chosen cwd (path=apps/web)", ok: true, message: relVercel });
              let vercelProjId;
              try {
                const pj = await fsx.readJson((0, import_node_path15.join)(vercelRunCwd, ".vercel", "project.json"));
                if (pj && typeof pj.projectId === "string") vercelProjId = pj.projectId;
              } catch {
              }
              const vcCmd = `opendeploy deploy vercel --env prod --path ${relVercel}${vercelProjId ? ` --project ${vercelProjId}` : ""}`;
              suggestions.push(vcCmd);
            }
          } catch {
          }
        }
      }
      if (opts.fix === true) {
        try {
          const pubNoJ = (0, import_node_path15.join)(cwd, "public", ".nojekyll");
          const outDir = (0, import_node_path15.join)(cwd, "out");
          const outNoJ = (0, import_node_path15.join)(outDir, ".nojekyll");
          let wrote = false;
          try {
            if (!await fsx.exists(pubNoJ)) {
              await (0, import_promises8.writeFile)(pubNoJ, "", "utf8");
              wrote = true;
            }
          } catch {
          }
          try {
            if (await fsx.exists(outDir) && !await fsx.exists(outNoJ)) {
              await (0, import_promises8.writeFile)(outNoJ, "", "utf8");
              wrote = true;
            }
          } catch {
          }
          results.push({ name: "GitHub Pages .nojekyll (fix)", ok: true, message: wrote ? "written" : "present" });
        } catch {
          results.push({ name: "GitHub Pages .nojekyll (fix)", ok: false, message: "failed to write" });
        }
      }
      const ok = results.every((r) => r.ok);
      try {
        const ghChecks = await checkGitHubPagesSetup(cwd, opts.printCmd);
        for (const r of ghChecks) results.push(r);
        const originOk = ghChecks.find((r) => r.name === "git origin remote")?.ok === true;
        const ghBranchOk = ghChecks.find((r) => r.name === "gh-pages branch (remote)")?.ok === true;
        if (!originOk) suggestions.push("git remote add origin <url> && git push -u origin main");
        if (!ghBranchOk) suggestions.push("opendeploy deploy github");
        const nx = await checkNextGithubPages(cwd);
        for (const r of nx) results.push(r);
        const hasNoJ = nx.find((r) => r.name.startsWith(".nojekyll"))?.ok;
        const hasExport = nx.find((r) => r.name.includes("output: 'export'"))?.ok;
        const assetsOk = nx.find((r) => r.name.startsWith("export assets"))?.ok;
        const baseMatch = nx.find((r) => r.name === "next.config: basePath matches repo");
        const assetMatch = nx.find((r) => r.name === "next.config: assetPrefix matches repo");
        if (hasNoJ === false) suggestions.push("touch public/.nojekyll (or rely on CLI to add it during deploy)");
        if (hasExport === false) suggestions.push("set output: 'export' in next.config.ts/js for static export");
        if (assetsOk === false) suggestions.push("pnpm build (verify out/_next/static exists)");
        if (baseMatch && baseMatch.ok === false) suggestions.push(`set basePath in next.config to ${baseMatch.message.includes("expected") ? baseMatch.message.replace("mismatch (expected ", "").replace(")", "") : "'/<repo>'"}`);
        if (assetMatch && assetMatch.ok === false) suggestions.push(`set assetPrefix in next.config to ${assetMatch.message.includes("expected") ? assetMatch.message.replace("mismatch (expected ", "").replace(")", "") : "'/<repo>/'"} (recommended) `);
        try {
          const cnamePub = (0, import_node_path15.join)(cwd, "public", "CNAME");
          const cnameOut = (0, import_node_path15.join)(cwd, "out", "CNAME");
          let domain;
          if (await fsx.exists(cnamePub)) {
            try {
              domain = (await (0, import_promises9.readFile)(cnamePub, "utf8")).trim();
            } catch {
            }
          }
          if (!domain && await fsx.exists(cnameOut)) {
            try {
              domain = (await (0, import_promises9.readFile)(cnameOut, "utf8")).trim();
            } catch {
            }
          }
          const hasCname = typeof domain === "string" && domain.length > 0;
          results.push({ name: "github pages: CNAME file (custom domain)", ok: hasCname, message: hasCname ? domain : "absent (optional)" });
          if (hasCname) {
            let owner;
            try {
              const origin = await proc.run({ cmd: "git remote get-url origin", cwd });
              if (origin.ok) {
                const t = origin.stdout.trim();
                const httpsRe = /^https?:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/i;
                const sshRe = /^git@github\.com:(.+?)\/(.+?)(?:\.git)?$/i;
                const m1 = t.match(httpsRe);
                const m2 = t.match(sshRe);
                owner = (m1?.[1] || m2?.[1] || "").trim();
              }
            } catch {
            }
            if (owner) suggestions.push(`DNS: add CNAME record: ${domain} -> ${owner}.github.io`);
            else suggestions.push(`DNS: add CNAME record: ${domain} -> <owner>.github.io`);
          }
        } catch {
        }
      } catch {
      }
      try {
        let cfg = "";
        const nxcands = ["next.config.ts", "next.config.js", "next.config.mjs"];
        for (const f of nxcands) {
          const pth = (0, import_node_path15.join)(cwd, f);
          if (await fsx.exists(pth)) {
            try {
              cfg = await (0, import_promises9.readFile)(pth, "utf8");
            } catch {
            }
            break;
          }
        }
        const pkgPath = (0, import_node_path15.join)(cwd, "package.json");
        let hasNextDep = false;
        try {
          const raw = await (0, import_promises9.readFile)(pkgPath, "utf8");
          const js = JSON.parse(raw);
          hasNextDep = Boolean(js.dependencies?.next);
        } catch {
        }
        const isNext = cfg.length > 0 || hasNextDep;
        if (isNext) {
          if (cfg.length > 0) {
            const hasOutputExport = /output\s*:\s*['"]export['"]/m.test(cfg);
            results.push({ name: "cloudflare: next.config omits output: 'export'", ok: !hasOutputExport, message: hasOutputExport ? "found (remove for Next on Pages)" : "ok" });
            const hasAssetPrefix = /assetPrefix\s*:\s*['"][^'\"]+['"]/m.test(cfg);
            results.push({ name: "cloudflare: next.config assetPrefix absent", ok: !hasAssetPrefix, message: hasAssetPrefix ? "found (remove for root-serving)" : "ok" });
            const baseMatch = cfg.match(/basePath\s*:\s*['"]([^'\"]*)['"]/m);
            const baseEmpty = !baseMatch || baseMatch && (!baseMatch[1] || baseMatch[1] === "");
            results.push({ name: "cloudflare: next.config basePath empty", ok: baseEmpty, message: baseEmpty ? "ok" : 'non-empty (set to "")' });
            const trailingTrue = /trailingSlash\s*:\s*true/m.test(cfg);
            results.push({ name: "cloudflare: next.config trailingSlash false (recommended)", ok: !trailingTrue, message: trailingTrue ? "true (set false)" : "ok" });
            if (hasOutputExport) suggestions.push('Cloudflare Pages: remove output: "export" from next.config when using Next on Pages');
            if (hasAssetPrefix) suggestions.push("Cloudflare Pages: remove assetPrefix from next.config (serve at root)");
            if (!baseEmpty) suggestions.push('Cloudflare Pages: set basePath to empty ("") in next.config');
            if (trailingTrue) suggestions.push("Cloudflare Pages: set trailingSlash: false (recommended)");
          }
          const wranglerPath = (0, import_node_path15.join)(cwd, "wrangler.toml");
          if (await fsx.exists(wranglerPath)) {
            try {
              const raw = await (0, import_promises9.readFile)(wranglerPath, "utf8");
              const hasOut = /pages_build_output_dir\s*=\s*"\.vercel\/output\/static"/m.test(raw);
              const hasFns = /pages_functions_directory\s*=\s*"\.vercel\/output\/functions"/m.test(raw);
              const hasCompat = /compatibility_flags\s*=\s*\[.*"nodejs_compat".*\]/m.test(raw);
              results.push({ name: "cloudflare: wrangler pages_build_output_dir", ok: hasOut, message: hasOut ? "ok" : "set to .vercel/output/static" });
              results.push({ name: "cloudflare: wrangler pages_functions_directory", ok: hasFns, message: hasFns ? "ok" : "set to .vercel/output/functions" });
              results.push({ name: "cloudflare: wrangler nodejs_compat flag", ok: hasCompat, message: hasCompat ? "ok" : 'add compatibility_flags = ["nodejs_compat"]' });
              if (!hasOut) suggestions.push('Cloudflare Pages: set pages_build_output_dir = ".vercel/output/static" in wrangler.toml');
              if (!hasFns) suggestions.push('Cloudflare Pages: set pages_functions_directory = ".vercel/output/functions" in wrangler.toml');
              if (!hasCompat) suggestions.push('Cloudflare Pages: add compatibility_flags = ["nodejs_compat"] in wrangler.toml');
            } catch {
            }
          } else {
            results.push({ name: "cloudflare: wrangler.toml present", ok: false, message: "missing (generate with: opd generate cloudflare --next-on-pages)" });
            suggestions.push("opd generate cloudflare --next-on-pages");
          }
          try {
            let projectName;
            try {
              const raw = await (0, import_promises9.readFile)(wranglerPath, "utf8");
              const m = raw.match(/\bname\s*=\s*"([^"]+)"/);
              if (m && m[1]) projectName = m[1];
            } catch {
            }
            if (!projectName) {
              const base = cwd.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "site";
              projectName = base.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-").replace(/^-+|-+$/g, "");
            }
            const listCmd = "wrangler pages project list --json";
            if (opts.printCmd) logger.info(`$ ${listCmd}`);
            const ls = await runWithRetry({ cmd: listCmd, cwd });
            let exists2 = false;
            if (ls.ok) {
              try {
                const arr = JSON.parse(ls.stdout);
                exists2 = Array.isArray(arr) && arr.some((p) => (p.name || "").toLowerCase() === projectName.toLowerCase());
              } catch {
              }
            }
            results.push({ name: "cloudflare: project exists", ok: exists2, message: exists2 ? projectName : `${projectName} (create with: wrangler pages project create ${projectName})` });
            const defaultDomain = `${projectName}.pages.dev`;
            results.push({ name: "cloudflare: default domain (pages.dev)", ok: true, message: defaultDomain });
            suggestions.push(`Cloudflare DNS: point your custom domain via CNAME to ${defaultDomain} (optional)`);
          } catch {
          }
        }
      } catch {
      }
      if (jsonMode) {
        logger.jsonPrint(annotate({ ok, action: "doctor", results, suggestions, final: true }));
        process.exitCode = ok ? 0 : 1;
        return;
      }
      for (const r of results) {
        if (r.ok) logger.success(`${r.name}: ${r.message}`);
        else logger.warn(`${r.name}: ${r.message}`);
      }
      if (suggestions.length > 0) {
        logger.info("Suggested commands:");
        for (const s of suggestions) logger.info(`  ${s}`);
      }
      const total = results.length;
      const okCount = results.filter((r) => r.ok).length;
      const failCount = total - okCount;
      const failSamples = results.filter((r) => !r.ok).slice(0, 5).map((r) => ({ name: r.name, message: r.message }));
      if (opts.strict === true) {
        if (!ok) process.exitCode = 1;
      }
      try {
        const exe = process.platform === "win32" ? "opd-go.exe" : "opd-go";
        const local = (0, import_node_path15.join)(cwd, ".bin", exe);
        const localExists = await fsx.exists(local);
        const envOverride = process.env.OPD_GO_BIN;
        let onPath = false;
        try {
          const pathCmd = process.platform === "win32" ? "where opd-go" : "command -v opd-go";
          const probe = await runWithRetry({ cmd: pathCmd, cwd });
          onPath = probe.ok && probe.stdout.trim().length > 0;
        } catch {
          onPath = false;
        }
        if (localExists && !onPath && (!envOverride || envOverride.length === 0)) {
          const ps = `$env:OPD_GO_BIN = "$PWD\\.bin\\${exe}"`;
          const sh = `export OPD_GO_BIN="$PWD/.bin/${exe}"`;
          suggestions.push(`Set OPD_GO_BIN (PowerShell): ${ps}`);
          suggestions.push(`Set OPD_GO_BIN (Bash): ${sh}`);
        }
      } catch {
      }
      try {
        const hasOpdGo = results.find((r) => r.name === "opd-go (optional)")?.ok === true;
        if (!hasOpdGo) suggestions.push("pnpm run build:go");
      } catch {
      }
      printDoctorSummary({ total, okCount, failCount, failSamples });
      if (!ok) {
        logger.warn("Some checks failed. Run the suggested login/install commands and re-run doctor.");
        if (opts.ci === true) process.exitCode = 1;
        if (opts.ci === true || process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
          for (const r of results.filter((r2) => !r2.ok)) {
            console.log(`::warning ::${r.name} - ${r.message}`);
          }
        }
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const info = mapProviderError("doctor", raw);
      if (isJsonMode(opts.json)) {
        logger.jsonPrint(annotate({ ok: false, action: "doctor", code: info.code, message: info.message, remedy: info.remedy, error: raw, final: true }));
      }
      logger.error(`${info.message} (${info.code})`);
      if (info.remedy) logger.info(`Try: ${info.remedy}`);
      process.exitCode = 1;
    }
  });
  doctorCmd.command("env-snapshot").description("Capture a deterministic environment snapshot for parity checks").option("--out <file>", "Output file path", ".artifacts/env.snapshot.json").action(async (opts) => {
    try {
      const snap = buildEnvSnapshot();
      const json = JSON.stringify(snap, null, 2) + "\n";
      const outDir = (0, import_node_path15.dirname)(opts.out);
      await (0, import_promises7.mkdir)(outDir, { recursive: true });
      await (0, import_promises8.writeFile)(opts.out, json, "utf8");
      logger.success(`Environment snapshot written to ${opts.out}`);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      logger.error(`env-snapshot failed: ${raw}`);
      process.exitCode = 1;
    }
  });
  doctorCmd.command("env-compare").description("Compare two environment snapshots and print differences").option("--a <file>", "Snapshot A file path").option("--b <file>", "Snapshot B file path").action(async (opts) => {
    try {
      if (!opts.a || !opts.b) {
        logger.error("Provide both --a and --b snapshot file paths");
        process.exitCode = 1;
        return;
      }
      const a = await fsx.readJson(opts.a) ?? {};
      const b = await fsx.readJson(opts.b) ?? {};
      const diff = diffSnapshots(a, b);
      const ok = diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0;
      logger.jsonPrint(annotate({ ok, action: "doctor", subcommand: "env-compare", diff, final: true }));
      if (!ok) process.exitCode = 1;
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      logger.error(`env-compare failed: ${raw}`);
      process.exitCode = 1;
    }
  });
}
function pickEnv(keys) {
  const out = {};
  for (const k of keys) {
    const v = process.env[k];
    if (typeof v === "string") out[k] = v;
  }
  return out;
}
function buildEnvSnapshot() {
  const core = {
    platform: process.platform,
    release: typeof process.getSystemVersion === "function" ? process.getSystemVersion() ?? "" : process.release.name,
    arch: process.arch,
    node: process.versions.node,
    pnpm: process.env.npm_config_user_agent,
    ...pickEnv(["PATH", "PATHEXT", "TZ", "LC_ALL", "FORCE_COLOR", "TERM"])
  };
  return core;
}
function diffSnapshots(a, b) {
  const keys = /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(b)]);
  const added = [];
  const removed = [];
  const changed = [];
  for (const k of keys) {
    const va = a[k];
    const vb = b[k];
    if (!(k in a)) {
      added.push(k);
      continue;
    }
    if (!(k in b)) {
      removed.push(k);
      continue;
    }
    if (JSON.stringify(va) !== JSON.stringify(vb)) changed.push({ key: k, a: va, b: vb });
  }
  return { added, removed, changed };
}

// src/commands/generate.ts
var import_commander3 = require("commander");
var import_promises14 = require("fs/promises");
var import_node_path20 = require("path");
init_logger();
init_auto();

// src/core/provider-system/provider.ts
async function loadProvider(id) {
  const normalized = id.toLowerCase();
  if ((process.env.OPD_PROVIDER_MODE ?? "").toLowerCase() === "virtual") {
    const mod = await Promise.resolve().then(() => (init_virtual(), virtual_exports));
    return new mod.VirtualProvider(normalized);
  }
  if (normalized === "vercel") {
    const mod = await Promise.resolve().then(() => (init_vercel(), vercel_exports));
    return new mod.VercelProvider();
  }
  if (normalized === "netlify") {
    throw new Error("Netlify is not supported by OpenDeploy. Please use the official Netlify CLI.");
  }
  if (normalized === "cloudflare" || normalized === "cloudflare-pages") {
    const mod = await Promise.resolve().then(() => (init_cloudflare_pages(), cloudflare_pages_exports));
    return new mod.CloudflarePagesProvider();
  }
  if (normalized === "github" || normalized === "github-pages") {
    const mod = await Promise.resolve().then(() => (init_github_pages(), github_pages_exports));
    return new mod.GithubPagesProvider();
  }
  try {
    const mod = await import(`@opendeploy/provider-${normalized}`);
    return mod.default;
  } catch {
    throw new Error(`Unknown provider: ${id}`);
  }
}

// src/commands/generate.ts
function registerGenerateCommand(program) {
  program.command("generate").description("Generate configuration files for the detected app (Vercel/Cloudflare/GitHub Pages) or Turborepo pipeline").argument("<provider>", "Target: vercel | cloudflare | github | turbo").option("--overwrite", "Overwrite existing files").option("--json", "Output JSON with generated file path").option("--next-on-pages", "For Cloudflare: scaffold wrangler.toml configured for Next on Pages").option("--reusable", "Generate a per-app caller workflow that uses a reusable workflow").option("--app <path>", "App path to use in reusable workflow (defaults to auto-detected)").option("--project-name <name>", "Cloudflare Pages project name for reusable workflow").action(async (provider, opts) => {
    const cwd = process.cwd();
    try {
      const jsonMode = isJsonMode(opts.json);
      if (jsonMode) logger.setJsonOnly(true);
      const detection = await detectApp({ cwd });
      if (provider === "vercel") {
        const plugin = await loadProvider("vercel");
        const writtenPath = await plugin.generateConfig({ detection, cwd, overwrite: opts.overwrite === true });
        if (jsonMode) {
          const summary = { ok: true, action: "generate", provider: "vercel", path: writtenPath, final: true };
          logger.jsonPrint(summary);
          return;
        }
        logger.success(`Generated Vercel config at ${writtenPath}`);
        return;
      }
      if (provider === "cloudflare") {
        if (opts.nextOnPages === true) {
          const path = (0, import_node_path20.join)(cwd, "wrangler.toml");
          const exists2 = async () => {
            try {
              const s = await (0, import_promises14.stat)(path);
              return s.isFile();
            } catch {
              return false;
            }
          };
          if (opts.overwrite === true || !await exists2()) {
            const base = cwd.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "site";
            const name = base.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-").replace(/^-+|-+$/g, "") || "site";
            const body = `# Auto-generated by OpenDeploy CLI (Cloudflare Pages \u2014 Next on Pages)
# Install the builder:
#   pnpm add -D @cloudflare/next-on-pages
# Build locally:
#   npx @cloudflare/next-on-pages@1
# Deploy locally:
#   wrangler pages deploy .vercel/output/static --project-name ${name}
name = "${name}"
pages_build_output_dir = ".vercel/output/static"
pages_functions_directory = ".vercel/output/functions"
compatibility_date = "2024-01-01"
`;
            await (0, import_promises14.writeFile)(path, body, "utf8");
          }
          if (jsonMode) {
            logger.jsonPrint({ ok: true, action: "generate", provider: "cloudflare", mode: "next-on-pages", path, final: true });
            return;
          }
          logger.success("Generated Cloudflare wrangler.toml for Next on Pages");
          logger.note("Install: pnpm add -D @cloudflare/next-on-pages");
          logger.note("Build:   npx @cloudflare/next-on-pages@1");
          logger.note("Deploy:  wrangler pages deploy .vercel/output/static");
          return;
        }
        if (opts.reusable === true) {
          let appPath = opts.app && opts.app.length > 0 ? opts.app : "";
          if (!appPath) {
            const resolved = await resolveAppPath({ cwd, ci: true });
            appPath = resolved.path === cwd ? "." : resolved.path.replace(cwd + (cwd.endsWith("\\") || cwd.endsWith("/") ? "" : process.platform === "win32" ? "\\" : "/"), "");
            appPath = appPath.replace(/\\/g, "/");
          }
          const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-").replace(/^-+|-+$/g, "");
          const projName = opts.projectName && opts.projectName.length > 0 ? opts.projectName : slugify((appPath === "." ? cwd : appPath).split("/").filter(Boolean).pop() || "site");
          const relDir = ".github/workflows";
          const file = (0, import_node_path20.join)(cwd, relDir, "deploy-app-cloudflare.yml");
          try {
            await (await import("fs/promises")).mkdir((0, import_node_path20.join)(cwd, relDir), { recursive: true });
          } catch {
          }
          const body = `name: Deploy App (Cloudflare Pages)

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    uses: ./.github/workflows/_reusable-cloudflare-pages.yml
    with:
      app_path: ${appPath}
      project_name: ${projName}
`;
          await (0, import_promises14.writeFile)(file, body, "utf8");
          if (jsonMode) {
            logger.jsonPrint({ ok: true, action: "generate", provider: "cloudflare", mode: "reusable", path: file, app_path: appPath, project_name: projName, final: true });
            return;
          }
          logger.success(`Generated Cloudflare per-app workflow at ${file}`);
          logger.note(`Project: ${projName} | App: ${appPath}`);
          return;
        }
        const plugin = await loadProvider("cloudflare");
        const writtenPath = await plugin.generateConfig({ detection, cwd, overwrite: opts.overwrite === true });
        if (jsonMode) {
          logger.jsonPrint({ ok: true, action: "generate", provider: "cloudflare", path: writtenPath, final: true });
          return;
        }
        logger.success(`Generated Cloudflare config at ${writtenPath}`);
        return;
      }
      if (provider === "github") {
        const relDir = ".github/workflows";
        const dir = (0, import_node_path20.join)(cwd, relDir);
        try {
          await (await import("fs/promises")).mkdir(dir, { recursive: true });
        } catch {
        }
        if (opts.reusable === true) {
          let appPath = opts.app && opts.app.length > 0 ? opts.app : "";
          if (!appPath) {
            const resolved = await resolveAppPath({ cwd, ci: true });
            appPath = resolved.path === cwd ? "." : resolved.path.replace(cwd + (cwd.endsWith("\\") || cwd.endsWith("/") ? "" : process.platform === "win32" ? "\\" : "/"), "");
            appPath = appPath.replace(/\\/g, "/");
          }
          const file2 = (0, import_node_path20.join)(dir, "deploy-app-gh-pages.yml");
          const body2 = `name: Deploy App (GitHub Pages)

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    uses: ./.github/workflows/_reusable-gh-pages.yml
    with:
      app_path: ${appPath}
`;
          await (0, import_promises14.writeFile)(file2, body2, "utf8");
          if (jsonMode) {
            logger.jsonPrint({ ok: true, action: "generate", provider: "github", mode: "reusable", path: file2, app_path: appPath, final: true });
            return;
          }
          logger.success(`Generated GitHub Pages per-app workflow at ${file2}`);
          logger.note(`App: ${appPath}`);
          return;
        }
        const outDir = (() => {
          const pub = detection.publishDir?.trim();
          if (pub && pub.length > 0) return pub;
          const fw = (detection.framework || "").toLowerCase();
          if (fw === "astro") return "dist";
          if (fw === "sveltekit") return "build";
          if (fw === "next") return "out";
          return "dist";
        })();
        const file = (0, import_node_path20.join)(dir, "deploy-pages.yml");
        const body = `name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ${outDir}
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
`;
        await (0, import_promises14.writeFile)(file, body, "utf8");
        if (jsonMode) {
          logger.jsonPrint({ ok: true, action: "generate", provider: "github", path: file, final: true });
          return;
        }
        logger.success(`Generated GitHub Pages workflow at ${file}`);
        if ((detection.framework || "").toLowerCase() === "next") {
          logger.note('Next.js \u2192 GitHub Pages: set next.config output: "export" and run next export to produce out/.');
        }
        return;
      }
      if (provider === "turbo") {
        const path = (0, import_node_path20.join)(cwd, "turbo.json");
        const exists2 = async () => {
          try {
            const s = await (0, import_promises14.stat)(path);
            return s.isFile();
          } catch {
            return false;
          }
        };
        if (opts.overwrite === true || !await exists2()) {
          const turbo = {
            tasks: {
              build: {
                dependsOn: ["^build"],
                outputs: [".next/**", "!.next/cache/**", "dist/**"]
              }
            }
          };
          await (0, import_promises14.writeFile)(path, `${JSON.stringify(turbo, null, 2)}
`, "utf8");
        }
        if (jsonMode) {
          logger.jsonPrint({ ok: true, action: "generate", provider: "turbo", path, final: true });
          return;
        }
        logger.success(`Generated Turborepo config at ${path}`);
        return;
      }
      logger.error(`Unknown provider: ${provider}`);
      process.exitCode = 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message);
      process.exitCode = 1;
    }
  });
}

// src/commands/deploy.ts
var import_commander5 = require("commander");
init_logger();
init_next();
var import_node_path25 = require("path");
var import_promises18 = require("fs/promises");
init_fs();
init_process();

// src/utils/progress.ts
init_colors();
init_logger();
function startHeartbeat(opts) {
  const isNdjson = process.env.OPD_NDJSON === "1";
  const isJsonOnly = process.env.OPD_JSON === "1";
  const isQuiet = process.env.OPD_QUIET === "1";
  const isTty = Boolean(process.stdout && process.stdout.isTTY);
  const intervalMs = opts.intervalMs ?? (isNdjson ? 5e3 : 1e4);
  if (isQuiet) return () => {
  };
  if (isTty) return () => {
  };
  if (isJsonOnly && !isNdjson) return () => {
  };
  const t0 = Date.now();
  if (isNdjson) {
    const tick2 = () => {
      const elapsed = Date.now() - t0;
      logger.json({ event: "heartbeat", label: opts.label, elapsedMs: elapsed, hint: opts.hint });
    };
    const timer2 = setInterval(tick2, intervalMs);
    return () => {
      clearInterval(timer2);
    };
  }
  const tick = () => {
    const elapsed = Date.now() - t0;
    const mins = Math.floor(elapsed / 6e4);
    const secs = Math.floor(elapsed % 6e4 / 1e3);
    process.stdout.write(`
${colors.dim("\u2026")} ${opts.label} still running (${mins}m ${secs}s). ${opts.hint ?? ""}
`);
  };
  const timer = setInterval(tick, intervalMs);
  return () => {
    clearInterval(timer);
  };
}

// src/utils/ui.ts
function canSpin() {
  if (process.env.OPD_JSON === "1" || process.env.OPD_NDJSON === "1" || process.env.OPD_QUIET === "1") return false;
  return Boolean(process.stdout && process.stdout.isTTY);
}
var FRAMES = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
function spinner(label) {
  if (!canSpin()) {
    return {
      succeed: (_msg) => {
      },
      fail: (_msg) => {
      },
      stop: (_msg) => {
      },
      update: (_msg) => {
      }
    };
  }
  let i = 0;
  let text = label;
  const tick = () => {
    const frame = FRAMES[i = (i + 1) % FRAMES.length];
    const line = `${frame} ${text}`;
    process.stdout.write(`\r${line}`);
  };
  const timer = setInterval(tick, 120);
  tick();
  const clear = () => {
    clearInterval(timer);
    process.stdout.write("\r");
  };
  const writeLine = (line) => {
    process.stdout.write(`${line}
`);
  };
  return {
    succeed: (msg) => {
      clear();
      writeLine(msg ?? `${label} done`);
    },
    fail: (msg) => {
      clear();
      writeLine(msg ?? `${label} failed`);
    },
    stop: (msg) => {
      clear();
      if (msg) writeLine(msg);
    },
    update: (msg) => {
      text = msg;
    }
  };
}

// src/commands/env.ts
var import_commander4 = require("commander");
var import_node_path23 = require("path");
var import_promises16 = require("fs/promises");
var import_node_os = require("os");

// src/core/secrets/env.ts
var import_dotenv = require("dotenv");
var import_node_path21 = require("path");
var import_promises15 = require("fs/promises");
init_fs();
var EnvLoader = class {
  load() {
    const cwd = process.cwd();
    const envPath = (0, import_node_path21.join)(cwd, ".env");
    const envLocalPath = (0, import_node_path21.join)(cwd, ".env.local");
    (0, import_dotenv.config)({ path: envPath });
    if (fsx.exists(envLocalPath) instanceof Promise) {
    }
    (0, import_dotenv.config)({ path: envLocalPath, override: true });
    const out = {};
    for (const [k, v] of Object.entries(process.env)) if (typeof v === "string") out[k] = v;
    return out;
  }
};
async function parseEnvFile(args) {
  try {
    const buf = await (0, import_promises15.readFile)(args.path, "utf8");
    const parsed = (0, import_dotenv.parse)(buf);
    const trimmed = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v !== "string") continue;
      const tv = v.trim();
      if (tv.length > 0) trimmed[k] = tv;
    }
    const expanded = {};
    const varRe = /\$\{([A-Z0-9_]+)\}|\$([A-Z0-9_]+)/g;
    const resolveVar = (name) => {
      if (Object.prototype.hasOwnProperty.call(trimmed, name)) return trimmed[name];
      const pe = process.env[name];
      return typeof pe === "string" ? pe : void 0;
    };
    const expandOnce = (value) => {
      return value.replace(varRe, (_m, g1, g2) => {
        const key = g1 ?? g2 ?? "";
        const rep = key !== "" ? resolveVar(key) : void 0;
        return rep !== void 0 ? rep : "";
      });
    };
    const MAX_PASSES = 5;
    for (const [k, v] of Object.entries(trimmed)) {
      let cur = v;
      for (let i = 0; i < MAX_PASSES; i++) {
        const next = expandOnce(cur);
        if (next === cur) break;
        cur = next;
      }
      expanded[k] = cur;
    }
    return expanded;
  } catch {
    return {};
  }
}

// src/commands/env.ts
init_logger();

// src/utils/format.ts
init_colors();
function mask(value) {
  if (value.length <= 4) return "***";
  const head = value.slice(0, 3);
  const tail = value.slice(-2);
  return `${head}***${tail}`;
}
function section(title, lines) {
  if (lines.length === 0) return [];
  const out = [];
  out.push(colors.bold(title));
  for (const ln of lines) out.push(`  \u2022 ${ln}`);
  return out;
}
function formatDiffHuman(args) {
  const addedLines = args.added.map((k) => colors.green(k));
  const removedLines = args.removed.map((k) => colors.yellow(k));
  const changedLines = args.changed.map((c) => `${colors.cyan(c.key)} ${colors.dim("(local:")} ${mask(c.local)}${colors.dim(", remote:")} ${mask(c.remote)}${colors.dim(")")}`);
  const parts = [];
  parts.push(...section(`Added only locally (${args.added.length})`, addedLines));
  parts.push(...section(`Missing locally (${args.removed.length})`, removedLines));
  parts.push(...section(`Changed (${args.changed.length})`, changedLines));
  return parts.join("\n");
}

// src/commands/env.ts
init_logger();

// src/utils/prompt.ts
var import_node_readline = require("readline");
function normalize2(answer) {
  return answer.trim().toLowerCase();
}
async function confirm(question, opts = {}) {
  const rl = (0, import_node_readline.createInterface)({ input: process.stdin, output: process.stdout });
  const suffix = opts.defaultYes === false ? " [y/N] " : " [Y/n] ";
  const q = `${question}${suffix}`;
  const result = await new Promise((resolve) => {
    rl.question(q, (ans) => {
      const val = normalize2(ans);
      if (val === "" && (opts.defaultYes === void 0 || opts.defaultYes === true)) return resolve(true);
      if (val === "y" || val === "yes") return resolve(true);
      resolve(false);
    });
  });
  rl.close();
  return result;
}

// src/commands/env.ts
init_process();
init_fs();

// src/utils/cache.ts
var import_node_path22 = require("path");
init_fs();
var CACHE_FILE = ".opendeploy/cache.json";
async function getCached(args) {
  try {
    const path = (0, import_node_path22.join)(args.cwd, CACHE_FILE);
    const data = await fsx.readJson(path);
    if (!data) return void 0;
    const entry = data[args.key];
    if (!entry) return void 0;
    if (typeof entry.ts !== "number") return void 0;
    if (Date.now() - entry.ts > args.ttlMs) return void 0;
    return entry.value;
  } catch {
    return void 0;
  }
}
async function setCached(args) {
  const path = (0, import_node_path22.join)(args.cwd, CACHE_FILE);
  try {
    const data = await fsx.readJson(path) ?? {};
    data[args.key] = { value: args.value, ts: Date.now() };
    await fsx.writeJson(path, data);
  } catch {
    try {
      await fsx.writeJson(path, { [args.key]: { value: args.value, ts: Date.now() } });
    } catch {
    }
  }
}

// src/commands/env.ts
var import_ajv3 = __toESM(require("ajv"), 1);

// src/schemas/env-summary.schema.ts
var envSummarySchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: true,
  required: ["ok", "action", "final"],
  properties: {
    ok: { type: "boolean" },
    action: { const: "env" },
    subcommand: { type: "string" },
    provider: { type: "string" },
    final: { type: "boolean" }
  }
};

// src/commands/env.ts
var envAjv = new import_ajv3.default({ allErrors: true, strict: false, validateSchema: false });
var envSchemaValidate = envAjv.compile(envSummarySchema);
function annotateEnv(obj) {
  const ok = envSchemaValidate(obj);
  const errs = Array.isArray(envSchemaValidate.errors) ? envSchemaValidate.errors.map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim()) : [];
  if (process.env.OPD_SCHEMA_STRICT === "1" && errs.length > 0) {
    process.exitCode = 1;
  }
  return { ...obj, schemaOk: ok, schemaErrors: errs };
}
async function getCfProjectName(cwd, projectName) {
  if (projectName && projectName.length > 0) return projectName;
  try {
    const raw = await (await import("fs/promises")).readFile((0, import_node_path23.join)(cwd, "wrangler.toml"), "utf8");
    const m = raw.match(/\bname\s*=\s*"([^"]+)"/);
    if (m && m[1]) return m[1];
  } catch {
  }
  const base = cwd.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "site";
  return base.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-").replace(/^-+|-+$/g, "");
}
async function syncCloudflare(args) {
  const envPath = (0, import_node_path23.join)(args.cwd, args.file);
  const original = await parseEnvFile({ path: envPath });
  const kv = await applyEnvMapping({ cwd: args.cwd, kv: original, mapFile: args.mapFile });
  const entriesAll = Object.entries(kv);
  const entries = entriesAll.filter(([k]) => allowKey(k, args.only ?? [], args.ignore ?? []));
  if (entries.length === 0) {
    logger.warn(`No variables found in ${args.file}. Nothing to sync.`);
    return;
  }
  const project = await getCfProjectName(args.cwd, args.projectName);
  const results = [];
  for (const [key, value] of entries) {
    const go = args.yes === true || args.ci === true || args.dryRun === true ? true : await confirm(`Set ${key}=${mask2(value)} to Cloudflare Pages?`, { defaultYes: true });
    if (!go) continue;
    if (args.dryRun === true) {
      logger.info(`[dry-run] wrangler pages project secret put ${key} --project-name ${project}`);
      results.push({ key, status: "skipped" });
      continue;
    }
    const cmd = `wrangler pages project secret put ${key} --project-name ${project} --value ${JSON.stringify(value)}`;
    if (args.printCmd) logger.info(`$ ${cmd}`);
    const res = await runWithRetry({ cmd, cwd: args.cwd });
    if (res.ok) {
      logger.success(`Set ${key}`);
      results.push({ key, status: "set" });
    } else {
      const errMsg = res.stderr.trim() || res.stdout.trim();
      logger.warn(`Failed to set ${key}: ${errMsg}`);
      results.push({ key, status: "failed", error: errMsg });
    }
  }
  if (args.json === true) {
    const ok = results.every((r) => r.status !== "failed");
    logger.jsonPrint(annotateEnv({ ok, action: "env", subcommand: "sync", provider: "cloudflare", file: args.file, envs: results, final: true }));
  } else {
    const setCount = results.filter((r) => r.status === "set").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;
    const failedCount = results.filter((r) => r.status === "failed").length;
    printEnvSyncSummary({ provider: "cloudflare", file: args.file, setCount, skippedCount, failedCount });
  }
}
async function envSync(opts) {
  if (opts.provider === "vercel") {
    await syncVercel({
      cwd: opts.cwd,
      file: opts.file,
      env: opts.env,
      yes: opts.yes === true,
      dryRun: opts.dryRun === true,
      json: opts.json === true,
      ci: opts.ci === true,
      projectId: opts.projectId,
      orgId: opts.orgId,
      ignore: opts.ignore,
      only: opts.only,
      failOnAdd: opts.failOnAdd,
      failOnRemove: opts.failOnRemove,
      optimizeWrites: opts.optimizeWrites,
      mapFile: opts.mapFile
    });
    return;
  }
  await syncCloudflare({
    cwd: opts.cwd,
    file: opts.file,
    yes: opts.yes === true,
    dryRun: opts.dryRun === true,
    json: opts.json === true,
    ci: opts.ci === true,
    projectName: opts.projectId,
    ignore: opts.ignore,
    only: opts.only,
    mapFile: opts.mapFile
  });
}
async function envDiff(opts) {
  await diffVercel({
    cwd: opts.cwd,
    file: opts.file,
    env: opts.env,
    json: opts.json === true,
    ci: opts.ci === true,
    projectId: opts.projectId,
    orgId: opts.orgId,
    ignore: opts.ignore,
    only: opts.only,
    failOnAdd: opts.failOnAdd,
    failOnRemove: opts.failOnRemove
  });
}
async function ensureLinked(args) {
  const flags = ["--yes"];
  if (args.projectId) flags.push(`--project ${args.projectId}`);
  if (args.orgId) flags.push(`--org ${args.orgId}`);
  const linkCmd = `vercel link ${flags.join(" ")}`.trim();
  if (args.printCmd) logger.info(`$ ${linkCmd}`);
  const res = await runWithRetry({ cmd: linkCmd, cwd: args.cwd });
  if (!res.ok && !res.stdout.toLowerCase().includes("already linked")) {
    throw new Error("Project not linked to Vercel. Run: vercel link");
  }
}
async function pullVercel(args) {
  const sp = spinner("Vercel: pulling env");
  const vercelEnv = args.env === "prod" ? "production" : args.env === "preview" ? "preview" : "development";
  const outFile = args.out ?? defaultOutFile(args.env);
  await ensureLinked({ cwd: args.cwd, projectId: args.projectId, orgId: args.orgId, printCmd: args.printCmd });
  const pullCmd = `vercel env pull ${outFile} --environment ${vercelEnv}`;
  if (args.printCmd) logger.info(`$ ${pullCmd}`);
  const res = await runWithRetry({ cmd: pullCmd, cwd: args.cwd });
  if (!res.ok) throw new Error(res.stderr.trim() || res.stdout.trim() || "Failed to pull env from Vercel");
  if (args.json === true) logger.jsonPrint(annotateEnv({ ok: true, action: "env", subcommand: "pull", provider: "vercel", environment: vercelEnv, out: outFile, final: true }));
  else {
    sp.succeed(`Vercel: pulled to ${outFile}`);
    logger.success(`Pulled ${vercelEnv} env to ${outFile}`);
    try {
      const parsed = await parseEnvFile({ path: (0, import_node_path23.join)(args.cwd, outFile) });
      printEnvPullSummary({ provider: "vercel", env: args.env === "prod" ? "prod" : args.env === "preview" ? "preview" : "development", out: outFile, count: Object.keys(parsed).length });
    } catch {
    }
  }
}
function toVercelEnv(t) {
  if (t === "all") return ["production", "preview"];
  if (t === "prod") return ["production"];
  if (t === "preview") return ["preview"];
  return ["development"];
}
function defaultOutFile(t) {
  if (t === "prod") return ".env.production.local";
  if (t === "preview") return ".env.preview.local";
  if (t === "development") return ".env.local";
  return ".env.local";
}
function mask2(val) {
  if (val.length <= 4) return "*".repeat(val.length);
  return `${val.slice(0, 2)}****${val.slice(-2)}`;
}
function toPatterns(list) {
  if (!list) return [];
  return list.split(",").map((s) => s.trim()).filter(Boolean);
}
function matchPattern(str, pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const re = new RegExp(`^${escaped}$`, "i");
  return re.test(str);
}
function allowKey(key, only, ignore) {
  if (only.length > 0 && !only.some((p) => matchPattern(key, p))) return false;
  if (ignore.length > 0 && ignore.some((p) => matchPattern(key, p))) return false;
  return true;
}
async function applyEnvMapping(args) {
  if (!args.mapFile) return args.kv;
  const p = (0, import_node_path23.join)(args.cwd, args.mapFile);
  let spec = null;
  try {
    spec = await fsx.readJson(p);
  } catch {
  }
  if (spec === null) return args.kv;
  const out = {};
  const ren = spec.rename ?? {};
  const tf = spec.transform ?? {};
  for (const [k, v] of Object.entries(args.kv)) {
    const preT = tf[k] ? applyTransform(v, tf[k]) : v;
    const newKey = ren[k] ?? k;
    const postT = tf[newKey] ? applyTransform(preT, tf[newKey]) : preT;
    out[newKey] = postT;
  }
  return out;
}
function applyTransform(val, kind) {
  if (kind === "base64") return Buffer.from(val, "utf8").toString("base64");
  if (kind === "trim") return val.trim();
  if (kind === "upper") return val.toUpperCase();
  if (kind === "lower") return val.toLowerCase();
  return val;
}
async function syncVercel(args) {
  const envPath = (0, import_node_path23.join)(args.cwd, args.file);
  const original = await parseEnvFile({ path: envPath });
  const kv = await applyEnvMapping({ cwd: args.cwd, kv: original, mapFile: args.mapFile });
  const entriesAll = Object.entries(kv);
  const entries = entriesAll.filter(([k]) => allowKey(k, args.only ?? [], args.ignore ?? []));
  if (entries.length === 0) {
    logger.warn(`No variables found in ${args.file}. Nothing to sync.`);
    return;
  }
  if (!args.dryRun) {
    try {
      await ensureLinked({ cwd: args.cwd, projectId: args.projectId, orgId: args.orgId, printCmd: args.printCmd });
    } catch (e) {
      logger.warn("Project may not be linked. Run `vercel link` if sync fails.");
    }
  }
  if ((args.failOnAdd || args.failOnRemove) && !args.dryRun) {
    const vercelEnv = args.env === "prod" ? "production" : args.env === "preview" ? "preview" : "development";
    const tmpDir = await (0, import_promises16.mkdtemp)((0, import_node_path23.join)((0, import_node_os.tmpdir)(), "opendeploy-"));
    const tmpFile = (0, import_node_path23.join)(tmpDir, `.env.remote.${vercelEnv}`);
    const pullCmd = `vercel env pull ${tmpFile} --environment ${vercelEnv}`;
    if (args.printCmd) logger.info(`$ ${pullCmd}`);
    const pulled = await runWithRetry({ cmd: pullCmd, cwd: args.cwd });
    if (pulled.ok) {
      const remote = await parseEnvFile({ path: tmpFile });
      await (0, import_promises16.rm)(tmpDir, { recursive: true, force: true });
      const localMap = Object.fromEntries(entries);
      const keys = /* @__PURE__ */ new Set([...Object.keys(localMap), ...Object.keys(remote)]);
      let addCount = 0;
      let removeCount = 0;
      for (const k of keys) {
        const inLocal = localMap[k] !== void 0;
        const inRemote = remote[k] !== void 0;
        if (inLocal && !inRemote) addCount++;
        if (!inLocal && inRemote) removeCount++;
      }
      if (args.failOnAdd && addCount > 0 || args.failOnRemove && removeCount > 0) {
        process.exitCode = 1;
      }
    }
  }
  const targets = toVercelEnv(args.env);
  const remoteByEnv = {};
  if (args.optimizeWrites === true && !args.dryRun) {
    for (const t of targets) {
      try {
        const cacheKey = `vercel:env:${t}`;
        const cached = await getCached({ cwd: args.cwd, key: cacheKey, ttlMs: 6e4 });
        if (cached) {
          remoteByEnv[t] = cached;
          continue;
        }
        const tmpDir = await (0, import_promises16.mkdtemp)((0, import_node_path23.join)((0, import_node_os.tmpdir)(), "opendeploy-remote-"));
        const tmpFile = (0, import_node_path23.join)(tmpDir, `.env.remote.${t}`);
        const pullCmd = `vercel env pull ${tmpFile} --environment ${t}`;
        if (args.printCmd) logger.info(`$ ${pullCmd}`);
        const pulled = await runWithRetry({ cmd: pullCmd, cwd: args.cwd });
        if (pulled.ok) {
          const m = await parseEnvFile({ path: tmpFile });
          remoteByEnv[t] = m;
          await setCached({ cwd: args.cwd, key: cacheKey, value: m });
        }
        await (0, import_promises16.rm)(tmpDir, { recursive: true, force: true });
      } catch {
      }
    }
  }
  const results = [];
  for (const [key, value] of entries) {
    const go = args.yes === true || args.ci === true || args.dryRun === true ? true : await confirm(`Set ${key}=${mask2(value)} to Vercel?`, { defaultYes: true });
    if (!go) continue;
    const touched = [];
    for (const t of targets) {
      if (args.dryRun === true) {
        logger.info(`[dry-run] vercel env set ${key} (${t}) \u2190 ${mask2(value)}`);
        touched.push(t);
        continue;
      }
      if (args.optimizeWrites === true && remoteByEnv[t] && remoteByEnv[t][key] === value) {
        logger.info(`Skip (same) ${key} in ${t}`);
        touched.push(t);
        continue;
      }
      const rmCmd = `vercel env rm ${key} ${t} -y`;
      if (args.printCmd) logger.info(`$ ${rmCmd}`);
      await runWithRetry({ cmd: rmCmd, cwd: args.cwd });
      const addCmd = `vercel env add ${key} ${t}`;
      if (args.printCmd) logger.info(`$ ${addCmd}`);
      const res = await runWithRetry({ cmd: addCmd, cwd: args.cwd, stdin: `${value}` });
      if (res.ok) {
        logger.success(`Set ${key} in ${t}`);
        touched.push(t);
      } else {
        const errMsg = res.stderr.trim() || res.stdout.trim();
        logger.warn(`Failed to set ${key} in ${t}: ${errMsg}`);
      }
    }
    results.push({ key, environments: touched, status: touched.length > 0 ? args.dryRun ? "skipped" : "set" : "failed" });
  }
  if (args.json === true) {
    const ok = results.every((r) => r.status !== "failed");
    logger.jsonPrint(annotateEnv({ ok, action: "env", subcommand: "sync", provider: "vercel", file: args.file, envs: results, final: true }));
  } else {
    const setCount = results.filter((r) => r.status === "set").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;
    const failedCount = results.filter((r) => r.status === "failed").length;
    printEnvSyncSummary({ provider: "vercel", file: args.file, setCount, skippedCount, failedCount });
  }
}
async function diffVercel(args) {
  const sp = spinner("Vercel: diffing env");
  const localPath = (0, import_node_path23.join)(args.cwd, args.file);
  const allLocal = await parseEnvFile({ path: localPath });
  const local = {};
  for (const [k, v] of Object.entries(allLocal)) {
    if (allowKey(k, args.only ?? [], args.ignore ?? [])) local[k] = v;
  }
  await ensureLinked({ cwd: args.cwd, projectId: args.projectId, orgId: args.orgId });
  const vercelEnv = args.env === "prod" ? "production" : args.env === "preview" ? "preview" : "development";
  const tmpDir = await (0, import_promises16.mkdtemp)((0, import_node_path23.join)((0, import_node_os.tmpdir)(), "opendeploy-"));
  const tmpFile = (0, import_node_path23.join)(tmpDir, `.env.remote.${vercelEnv}`);
  const pulled = await proc.run({ cmd: `vercel env pull ${tmpFile} --environment ${vercelEnv}`, cwd: args.cwd });
  if (!pulled.ok) throw new Error(pulled.stderr.trim() || pulled.stdout.trim() || "Failed to pull remote env");
  const remote = await parseEnvFile({ path: tmpFile });
  await (0, import_promises16.rm)(tmpDir, { recursive: true, force: true });
  const keys = Array.from(/* @__PURE__ */ new Set([...Object.keys(local), ...Object.keys(remote)])).sort();
  const added = [];
  const removed = [];
  const changed = [];
  for (const k of keys) {
    const l = local[k];
    const r = remote[k];
    if (l === void 0 && r !== void 0) removed.push(k);
    else if (l !== void 0 && r === void 0) added.push(k);
    else if (l !== void 0 && r !== void 0 && l !== r) changed.push({ key: k, local: l, remote: r });
  }
  const ok = added.length === 0 && removed.length === 0 && changed.length === 0;
  if (args.json === true) {
    logger.jsonPrint(annotateEnv({ ok, action: "env", subcommand: "diff", provider: "vercel", env: vercelEnv, added, removed, changed, final: true }));
  } else {
    sp.stop();
    if (ok) logger.success("No differences between local file and remote environment.");
    else logger.info("\n" + formatDiffHuman({ added, removed, changed }));
    const mappedEnv = vercelEnv === "production" ? "prod" : vercelEnv;
    const total = added.length + removed.length + changed.length;
    printEnvDiffSummary({
      provider: "vercel",
      env: mappedEnv,
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      ok,
      addedKeys: total <= 10 ? added : void 0,
      removedKeys: total <= 10 ? removed : void 0,
      changedKeys: total <= 10 ? changed.map((c) => c.key) : void 0
    });
    const inCI = args.ci === true || process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
    if (!ok && inCI) {
      const addIsError = args.ci === true || args.failOnAdd === true;
      const removeIsError = args.ci === true || args.failOnRemove === true;
      const addTag = addIsError ? "error" : "warning";
      const removeTag = removeIsError ? "error" : "warning";
      const changedTag = args.ci === true ? "error" : "warning";
      for (const k of added) console.log(`::${addTag} ::Only local: ${k}`);
      for (const k of removed) console.log(`::${removeTag} ::Only remote: ${k}`);
      for (const c of changed) console.log(`::${changedTag} ::Changed: ${c.key}`);
    }
  }
  if (!ok && (args.ci === true || args.failOnAdd === true || args.failOnRemove === true)) {
    const addHit = args.failOnAdd === true && added.length > 0;
    const removeHit = args.failOnRemove === true && removed.length > 0;
    if (args.ci === true || addHit || removeHit) process.exitCode = 1;
  }
}
function registerEnvCommand(program) {
  const env = program.command("env").description("Manage environment variables on providers");
  env.command("sync").description("Sync variables from a .env file to a provider").argument("<provider>", "Target provider: vercel | cloudflare").option("--file <path>", "Path to .env file", ".env").option("--env <target>", "Environment: prod|preview|development|all", "preview").option("--yes", "Accept all prompts").option("--dry-run", "Print changes without applying them").option("--json", "Output JSON summary").option("--print-cmd", "Print underlying provider commands that will be executed").option("--ci", "CI mode (non-interactive, fail fast)").option("--project-id <id>", "Provider project ID for non-interactive link").option("--org-id <id>", "Provider org ID for non-interactive link").option("--ignore <patterns>", "Comma-separated glob patterns to ignore (e.g. NEXT_PUBLIC_*)").option("--only <patterns>", "Comma-separated glob patterns to include").option("--fail-on-add", "Exit non-zero if new keys would be added").option("--fail-on-remove", "Exit non-zero if keys are missing remotely").option("--optimize-writes", "Only update keys that differ remotely (reduces API calls)").option("--map <file>", "Mapping file for key rename and value transforms").option("--retries <n>", "Retries for provider commands (default 2)").option("--timeout-ms <ms>", "Timeout per provider command in milliseconds (default 120000)").option("--base-delay-ms <ms>", "Base delay for exponential backoff with jitter (default 300)").action(async (provider, opts) => {
    const cwd = process.cwd();
    try {
      if (opts.retries) process.env.OPD_RETRIES = String(Math.max(0, Number(opts.retries) || 0));
      if (opts.timeoutMs) process.env.OPD_TIMEOUT_MS = String(Math.max(0, Number(opts.timeoutMs) || 0));
      if (opts.baseDelayMs) process.env.OPD_BASE_DELAY_MS = String(Math.max(0, Number(opts.baseDelayMs) || 0));
      const jsonMode = isJsonMode(opts.json);
      if (jsonMode) logger.setJsonOnly(true);
      const envTarget = opts.env ?? "preview";
      const prov = provider === "cloudflare" ? "cloudflare" : provider === "vercel" ? "vercel" : void 0;
      if (!prov) {
        logger.error(`Unknown provider: ${provider}`);
        process.exitCode = 1;
        return;
      }
      if (prov === "vercel") {
        await syncVercel({ cwd, file: opts.file ?? ".env", env: envTarget, yes: opts.yes === true, dryRun: opts.dryRun === true, json: jsonMode, ci: opts.ci === true, projectId: opts.projectId, orgId: opts.orgId, ignore: toPatterns(opts.ignore), only: toPatterns(opts.only), failOnAdd: opts.failOnAdd === true, failOnRemove: opts.failOnRemove === true, optimizeWrites: opts.optimizeWrites === true, mapFile: opts.map, printCmd: opts.printCmd === true });
      } else {
        await syncCloudflare({ cwd, file: opts.file ?? ".env", yes: opts.yes === true, dryRun: opts.dryRun === true, json: jsonMode, ci: opts.ci === true, projectName: opts.projectId, ignore: toPatterns(opts.ignore), only: toPatterns(opts.only), mapFile: opts.map, printCmd: opts.printCmd === true });
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const prov = provider === "cloudflare" ? "cloudflare" : provider === "vercel" ? "vercel" : provider;
      const info = mapProviderError(prov, raw);
      if (isJsonMode(opts.json)) {
        logger.jsonPrint({ ok: false, action: "env", subcommand: "sync", provider: prov, code: info.code, message: info.message, remedy: info.remedy, error: raw, final: true });
      }
      logger.error(`${info.message} (${info.code})`);
      if (info.remedy) logger.info(`Try: ${info.remedy}`);
      process.exitCode = 1;
    }
  });
  env.command("pull").description("Pull variables from a provider into a local .env file").argument("<provider>", "Target provider: vercel").option("--env <target>", "Environment: prod|preview|development", "preview").option("--out <path>", "Output file path (default depends on env)").option("--json", "Output JSON summary").option("--ci", "CI mode (non-interactive)").option("--project-id <id>", "Provider project ID for non-interactive link").option("--org-id <id>", "Provider org ID for non-interactive link").option("--ignore <patterns>", "Comma-separated glob patterns to ignore (e.g. NEXT_PUBLIC_*)").option("--only <patterns>", "Comma-separated glob patterns to include").option("--print-cmd", "Print underlying provider commands that will be executed").option("--retries <n>", "Retries for provider commands (default 2)").option("--timeout-ms <ms>", "Timeout per provider command in milliseconds (default 120000)").option("--base-delay-ms <ms>", "Base delay for exponential backoff with jitter (default 300)").action(async (provider, opts) => {
    const cwd = process.cwd();
    try {
      if (opts.retries) process.env.OPD_RETRIES = String(Math.max(0, Number(opts.retries) || 0));
      if (opts.timeoutMs) process.env.OPD_TIMEOUT_MS = String(Math.max(0, Number(opts.timeoutMs) || 0));
      if (opts.baseDelayMs) process.env.OPD_BASE_DELAY_MS = String(Math.max(0, Number(opts.baseDelayMs) || 0));
      const jsonMode = isJsonMode(opts.json);
      if (jsonMode) logger.setJsonOnly(true);
      const prov = provider === "vercel" ? "vercel" : void 0;
      if (!prov) {
        logger.error(`Unknown provider: ${provider}`);
        process.exitCode = 1;
        return;
      }
      const envTarget = opts.env ?? "preview";
      await pullVercel({ cwd, env: envTarget, out: opts.out, json: jsonMode, ci: opts.ci === true, projectId: opts.projectId, orgId: opts.orgId, printCmd: opts.printCmd === true });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const provName = provider === "vercel" ? "vercel" : provider;
      const info = mapProviderError(provName, raw);
      if (isJsonMode(opts.json)) {
        logger.jsonPrint({ ok: false, action: "env", subcommand: "pull", provider: provName, code: info.code, message: info.message, remedy: info.remedy, error: raw, final: true });
      }
      logger.error(`${info.message} (${info.code})`);
      if (info.remedy) logger.info(`Try: ${info.remedy}`);
      process.exitCode = 1;
    }
  });
  env.command("diff").description("Compare local .env values to provider environment (no changes)").argument("<provider>", "Target provider: vercel").option("--file <path>", "Path to local .env file", ".env").option("--env <target>", "Environment: prod|preview|development", "preview").option("--json", "Output JSON diff").option("--print-cmd", "Print underlying provider commands that will be executed").option("--ci", "CI mode (exit non-zero on differences)").option("--project-id <id>", "Provider project ID for non-interactive link").option("--org-id <id>", "Provider org ID for non-interactive link").option("--ignore <patterns>", "Comma-separated glob patterns to ignore (e.g. NEXT_PUBLIC_*)").option("--only <patterns>", "Comma-separated glob patterns to include").option("--fail-on-add", "Exit non-zero if new keys would be added").option("--fail-on-remove", "Exit non-zero if keys are missing remotely").option("--retries <n>", "Retries for provider commands (default 2)").option("--timeout-ms <ms>", "Timeout per provider command in milliseconds (default 120000)").option("--base-delay-ms <ms>", "Base delay for exponential backoff with jitter (default 300)").action(async (provider, opts) => {
    const cwd = process.cwd();
    try {
      if (opts.retries) process.env.OPD_RETRIES = String(Math.max(0, Number(opts.retries) || 0));
      if (opts.timeoutMs) process.env.OPD_TIMEOUT_MS = String(Math.max(0, Number(opts.timeoutMs) || 0));
      if (opts.baseDelayMs) process.env.OPD_BASE_DELAY_MS = String(Math.max(0, Number(opts.baseDelayMs) || 0));
      const jsonMode = isJsonMode(opts.json);
      if (jsonMode) logger.setJsonOnly(true);
      const prov = provider === "vercel" ? "vercel" : void 0;
      if (!prov) {
        logger.error(`Unknown provider: ${provider}`);
        process.exitCode = 1;
        return;
      }
      const envTarget = opts.env ?? "preview";
      await diffVercel({ cwd, file: opts.file ?? ".env", env: envTarget, json: jsonMode, ci: opts.ci === true, projectId: opts.projectId, orgId: opts.orgId, ignore: toPatterns(opts.ignore), only: toPatterns(opts.only), failOnAdd: opts.failOnAdd === true, failOnRemove: opts.failOnRemove === true, printCmd: opts.printCmd === true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message);
      process.exitCode = 1;
    }
  });
  env.command("validate").description("[experimental] Validate a local .env against a schema of required keys").option("--file <path>", "Path to local .env file", ".env").option("--schema <path>", "Path to schema JSON or builtin:<name>").option("--schema-type <type>", "Schema type: keys | rules | jsonschema", "keys").option("--json", "Output JSON report").option("--ci", "CI mode (exit non-zero on violations)").action(async (opts) => {
    const cwd = process.cwd();
    try {
      if (opts.json === true) logger.setJsonOnly(true);
      const report = await envValidate({ cwd, file: opts.file ?? ".env", schema: opts.schema, schemaType: opts.schemaType ?? "keys" });
      if (opts.json === true) logger.json(report);
      else {
        if (report.ok) logger.success("Validation passed: all required keys present");
        else logger.warn(`Missing required keys: ${report.missing.join(", ")}`);
      }
      if (!report.ok && opts.ci === true) process.exitCode = 1;
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const info = mapProviderError("env", raw);
      if (process.env.OPD_JSON === "1" || process.env.OPD_NDJSON === "1" || opts.json === true) {
        logger.jsonPrint({ ok: false, action: "env", subcommand: "validate", provider: "env", code: info.code, message: info.message, remedy: info.remedy, error: raw, final: true });
      }
      logger.error(`${info.message} (${info.code})`);
      if (info.remedy) logger.info(`Try: ${info.remedy}`);
      process.exitCode = 1;
    }
  });
}
async function envValidate(args) {
  const filePath = (0, import_node_path23.join)(args.cwd, args.file);
  if (!args.schema) throw new Error("Missing --schema <path>");
  const builtins = {
    "next-basic": ["DATABASE_URL", "NEXT_PUBLIC_SITE_URL"],
    "next-prisma": ["DATABASE_URL", "DIRECT_URL"],
    "next-auth": ["NEXTAUTH_SECRET", "NEXTAUTH_URL"],
    "better-auth": ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"],
    // New builtins
    "drizzle": ["DATABASE_URL"],
    "supabase": ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    "stripe": ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
    "paypal": ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_MODE", "PAYPAL_WEBHOOK_ID"],
    // Storage / providers
    "s3": ["AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BUCKET"],
    "r2": ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"],
    "cloudinary": ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_PUBLIC_BASE_URL"],
    "cloudinary-next": ["NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"],
    // Email / analytics / auth / cache / upload
    "resend": ["RESEND_API_KEY"],
    "posthog": ["NEXT_PUBLIC_POSTHOG_KEY", "POSTHOG_HOST"],
    "clerk": ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
    "upstash-redis": ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    "uploadthing": ["UPLOADTHING_SECRET", "NEXT_PUBLIC_UPLOADTHING_APP_ID"],
    // OAuth
    "google-oauth": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    "github-oauth": ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
    // SMTP & Email basics
    "smtp-basic": ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS"],
    "email-basic": ["EMAIL_FROM"],
    // Utility
    "admin-emails": ["ADMIN_EMAILS"],
    "email-provider": ["MAIL_PROVIDER"],
    // S3-compatible naming variant and app-specific bundles
    "s3-compat": ["S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_ENDPOINT", "S3_PUBLIC_BASE_URL", "S3_FORCE_PATH_STYLE"],
    "media-worker": ["FFMPEG_PATH", "MEDIA_PREVIEW_SECONDS", "MEDIA_WORKER_POLL_MS", "MEDIA_WORKER_LOOKBACK_MS"],
    "upload-limits": ["MAX_UPLOAD_MB", "MEDIA_DAILY_LIMIT"],
    "resend-plus": ["RESEND_API_KEY", "RESEND_AUDIENCE_ID"],
    // Profiles (composed)
    "blogkit": [
      // DB + ORM
      "DATABASE_URL",
      // Auth & OAuth
      ...["BETTER_AUTH_SECRET"],
      ...["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
      // Email
      ...["MAIL_PROVIDER", "EMAIL_FROM", "RESEND_API_KEY", "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS"]
    ],
    "ecommercekit": [
      // DB
      "DATABASE_URL",
      // Payment
      ...["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_MODE", "PAYPAL_WEBHOOK_ID"],
      // Storage
      ...["AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BUCKET"],
      // Email
      ...["MAIL_PROVIDER", "EMAIL_FROM", "RESEND_API_KEY", "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS"]
    ]
  };
  const parts = args.schema.split(",").map((s) => s.trim()).filter(Boolean);
  const requiredSet = /* @__PURE__ */ new Set();
  const schemaPathsUsed = [];
  const regexRules = [];
  const allowedValues = {};
  const oneOfGroups = [];
  const requireIfRules = [];
  for (const part of parts) {
    if (part.startsWith("builtin:")) {
      const name = part.slice("builtin:".length);
      const arr = builtins[name];
      if (!arr) throw new Error(`Unknown builtin schema: ${name}`);
      for (const k of arr) requiredSet.add(k);
    } else {
      const p = (0, import_node_path23.join)(args.cwd, part);
      schemaPathsUsed.push(p);
      const type = args.schemaType;
      if (type === "jsonschema") {
        const js = await fsx.readJson(p);
        if (js === null) throw new Error(`Schema not found or invalid: ${p}`);
        for (const k of Array.isArray(js.required) ? js.required : []) requiredSet.add(k);
      } else if (type === "rules") {
        const rules = await fsx.readJson(p);
        if (rules === null) throw new Error(`Schema not found or invalid: ${p}`);
        for (const k of Array.isArray(rules.required) ? rules.required : []) requiredSet.add(k);
        if (rules.regex) {
          for (const [key, pattern] of Object.entries(rules.regex)) regexRules.push({ key, pattern });
        }
        if (rules.allowed) {
          for (const [key, vals] of Object.entries(rules.allowed)) allowedValues[key] = vals;
        }
        if (Array.isArray(rules.oneOf)) {
          oneOfGroups.push(...rules.oneOf);
        }
        if (Array.isArray(rules.requireIf)) {
          for (const ri of rules.requireIf) {
            const [k, v] = ri.if.split("=");
            requireIfRules.push({ if: { key: k, value: v }, then: ri.then });
          }
        }
      } else {
        const keysSchema = await fsx.readJson(p);
        if (keysSchema === null) throw new Error(`Schema not found or invalid: ${p}`);
        for (const k of Array.isArray(keysSchema.required) ? keysSchema.required : []) requiredSet.add(k);
      }
    }
  }
  const required = Array.from(requiredSet);
  const schemaPath = schemaPathsUsed.length > 0 ? schemaPathsUsed.join(",") : void 0;
  const envMap = await parseEnvFile({ path: filePath });
  const presentKeys = Object.keys(envMap);
  const missing = required.filter((k) => !(k in envMap));
  const unknown = required.length > 0 ? presentKeys.filter((k) => !required.includes(k)) : [];
  const violations = [];
  for (const rr of regexRules) {
    const val = envMap[rr.key];
    if (val !== void 0) {
      const re = new RegExp(rr.pattern);
      if (!re.test(val)) violations.push(`regex:${rr.key} does not match ${rr.pattern}`);
    }
  }
  for (const [k, vals] of Object.entries(allowedValues)) {
    const val = envMap[k];
    if (val !== void 0 && !vals.includes(val)) violations.push(`allowed:${k} must be one of ${vals.join("|")}`);
  }
  for (const group of oneOfGroups) {
    const okGroup = group.some((k) => envMap[k] !== void 0);
    if (!okGroup) violations.push(`oneOf: one of [${group.join(", ")}] must be present`);
  }
  for (const ri of requireIfRules) {
    const actual = envMap[ri.if.key];
    const cond = ri.if.value ? actual === ri.if.value : actual !== void 0;
    if (cond) {
      for (const need of ri.then) {
        if (envMap[need] === void 0) {
          violations.push(`requireIf: ${need} is required when ${ri.if.key}${ri.if.value ? `=${ri.if.value}` : ""}`);
          if (!missing.includes(need)) missing.push(need);
        }
      }
    }
  }
  const ok = missing.length === 0 && violations.length === 0;
  return {
    ok,
    file: filePath,
    schemaPath,
    required,
    missing,
    unknown,
    violations: violations.length > 0 ? violations : void 0,
    requiredCount: required.length,
    presentCount: presentKeys.length,
    missingCount: missing.length,
    unknownCount: unknown.length,
    violationCount: violations.length > 0 ? violations.length : void 0
  };
}

// src/utils/redaction.ts
var import_promises17 = require("fs/promises");
var import_node_path24 = require("path");
init_fs();
function escapeRegExp2(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function parseDotenv(content) {
  const out = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"') || v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}
function valueToPatterns(val) {
  const patterns = [];
  if (typeof val !== "string") return patterns;
  if (val.length < 4) return patterns;
  const trivial = /* @__PURE__ */ new Set(["true", "false", "null", "undefined", "on", "off", "yes", "no"]);
  if (trivial.has(val.toLowerCase())) return patterns;
  patterns.push(new RegExp(escapeRegExp2(val), "g"));
  try {
    const b64 = Buffer.from(val, "utf8").toString("base64");
    if (b64.length >= 8) patterns.push(new RegExp(escapeRegExp2(b64), "g"));
  } catch {
  }
  return patterns;
}
async function computeRedactors(args) {
  const patterns = [];
  const files = [];
  if (args.envFiles && args.envFiles.length > 0) {
    for (const f of args.envFiles) files.push(f);
  }
  if (files.length === 0) files.push(".env", ".env.local");
  for (const name of files) {
    const p = (0, import_node_path24.join)(args.cwd, name);
    if (!await fsx.exists(p)) continue;
    try {
      const content = await (0, import_promises17.readFile)(p, "utf8");
      const kv = parseDotenv(content);
      for (const [k, v] of Object.entries(kv)) {
        if (!k) continue;
        if (k.startsWith("PUBLIC_") || k.startsWith("NEXT_PUBLIC_")) continue;
        for (const re of valueToPatterns(v)) patterns.push(re);
      }
    } catch {
    }
  }
  try {
    const confPath = (0, import_node_path24.join)(args.cwd, "opendeploy.redaction.json");
    if (await fsx.exists(confPath)) {
      const raw = await (0, import_promises17.readFile)(confPath, "utf8");
      const json = JSON.parse(raw);
      const rc = json.redaction;
      if (rc) {
        if (Array.isArray(rc.literals)) {
          for (const lit of rc.literals) {
            if (typeof lit === "string" && lit.length > 0) patterns.push(new RegExp(escapeRegExp2(lit), "g"));
          }
        }
        if (Array.isArray(rc.regex)) {
          for (const entry of rc.regex) {
            if (typeof entry === "string") {
              try {
                patterns.push(new RegExp(entry, "g"));
              } catch {
              }
            } else if (entry && typeof entry.pattern === "string") {
              try {
                patterns.push(new RegExp(entry.pattern, entry.flags ?? "g"));
              } catch {
              }
            }
          }
        }
      }
    }
  } catch {
  }
  if (args.includeProcessEnv === true) {
    for (const [k, v] of Object.entries(process.env)) {
      if (!k) continue;
      if (k.startsWith("PUBLIC_") || k.startsWith("NEXT_PUBLIC_")) continue;
      if (typeof v === "string" && v.length >= 4) {
        for (const re of valueToPatterns(v)) patterns.push(re);
      }
    }
  }
  return patterns;
}

// src/commands/deploy.ts
function registerDeployCommand(program) {
  program.command("deploy").description("Deploy the detected app to a provider").argument("<provider>", "Target provider: vercel | cloudflare | github").option("--env <env>", "Environment: prod | preview", "preview").option("--project <id>", "Provider project/site ID").option("--org <id>", "Provider org/team ID").option("--dry-run", "Do not execute actual deployment").option("--json", "Output JSON result").option("--path <dir>", "Path to app directory (for monorepos)").option("--ci", "CI mode (non-interactive)").option("--sync-env", "Sync environment variables from a local .env before deploy").option("--alias <domain>", "After deploy, assign this alias to the deployment (vercel only)").action(async (provider, opts) => {
    const rootCwd = process.cwd();
    let targetCwd;
    if (opts.path && opts.path.length > 0) {
      targetCwd = (0, import_node_path25.isAbsolute)(opts.path) ? opts.path : (0, import_node_path25.join)(rootCwd, opts.path);
    } else {
      const ciMode = Boolean(opts.ci) || process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true" || process.env.OPD_FORCE_CI === "1" || process.env.OPD_NDJSON === "1" || process.env.OPD_JSON === "1";
      const resolved = await resolveAppPath({ cwd: rootCwd, ci: ciMode });
      targetCwd = resolved.path;
      if (process.env.OPD_NDJSON === "1") logger.json({ event: "app-path", path: targetCwd, candidates: resolved.candidates, provider });
      else if (targetCwd !== rootCwd) logger.note(`Detected app path: ${targetCwd}`);
    }
    try {
      const jsonMode = isJsonMode(opts.json);
      if (jsonMode) logger.setJsonOnly(true);
      const ndjsonOn = process.env.OPD_NDJSON === "1";
      if (ndjsonOn) logger.setNdjson(true);
      if (jsonMode || opts.ci === true || ndjsonOn) {
        process.env.OPD_FORCE_CI = "1";
      }
      if (process.env.OPD_LEGACY !== "1") {
        if (opts.dryRun === true) {
          if (jsonMode) {
            const payload = { provider, target: opts.env === "prod" ? "prod" : "preview", mode: "dry-run", final: true };
            logger.jsonPrint(payload);
            try {
              console.log(JSON.stringify(payload));
            } catch {
            }
            return;
          }
          logger.info(`[dry-run] ${provider} deploy (plugins) (cwd=${targetCwd})`);
          return;
        }
        const p = await loadProvider(provider);
        if (process.env.OPD_SKIP_VALIDATE !== "1") {
          await p.validateAuth(targetCwd);
        }
        const wantSync2 = opts.syncEnv === true || process.env.OPD_SYNC_ENV === "1";
        if (wantSync2 && provider === "vercel") {
          const envTarget2 = opts.env === "prod" ? "prod" : "preview";
          const candidates = envTarget2 === "prod" ? [".env.production.local", ".env"] : [".env", ".env.local"];
          let chosenFile;
          for (const f of candidates) {
            if (await fsx.exists((0, import_node_path25.join)(targetCwd, f))) {
              chosenFile = f;
              break;
            }
          }
          if (chosenFile) {
            logger.section("Environment");
            logger.note(`Syncing ${chosenFile} \u2192 ${provider}`);
            try {
              try {
                const patterns = await computeRedactors({ cwd: targetCwd, envFiles: [chosenFile], includeProcessEnv: true });
                if (patterns.length > 0) logger.setRedactors(patterns);
              } catch {
              }
              await envSync({ provider: "vercel", cwd: targetCwd, file: chosenFile, env: envTarget2, yes: true, ci: Boolean(opts.ci), json: false, projectId: opts.project, orgId: opts.org, ignore: [], only: [] });
              logger.success("Environment sync complete");
            } catch (e) {
              logger.warn(`Env sync skipped: ${e.message}`);
            }
          }
        }
        const linked = await p.link(targetCwd, { projectId: opts.project, orgId: opts.org });
        const envTarget = opts.env === "prod" ? "production" : "preview";
        let publishDirHint;
        let frameworkHint;
        try {
          const d = await p.detect(targetCwd);
          publishDirHint = d.publishDir;
          frameworkHint = d.framework;
        } catch {
        }
        const t0 = Date.now();
        const buildRes = await p.build({ cwd: targetCwd, framework: frameworkHint, envTarget, publishDirHint, noBuild: false });
        const deployRes = await p.deploy({ cwd: targetCwd, envTarget, project: linked, artifactDir: buildRes.artifactDir, alias: opts.alias });
        const durationMs = Date.now() - t0;
        if (jsonMode && !deployRes.ok) {
          const message = deployRes.message || "Deploy failed";
          logger.jsonPrint({ ok: false, action: "deploy", provider, target: opts.env === "prod" ? "prod" : "preview", url: deployRes.url, logsUrl: deployRes.logsUrl, projectId: linked.projectId ?? opts.project, durationMs, message, final: true });
          return;
        }
        if (jsonMode) {
          logger.jsonPrint({ ok: true, action: "deploy", provider, target: opts.env === "prod" ? "prod" : "preview", url: deployRes.url, logsUrl: deployRes.logsUrl, projectId: linked.projectId ?? opts.project, durationMs, final: true });
          return;
        }
        if (deployRes.ok) {
          if (deployRes.url) logger.success(`Deployed: ${deployRes.url}`);
          else logger.success("Deployed");
          printDeploySummary({ provider, target: opts.env === "prod" ? "prod" : "preview", url: deployRes.url, projectId: linked.projectId ?? opts.project, durationMs, logsUrl: deployRes.logsUrl });
        } else {
          const message = deployRes.message || "Deploy failed";
          if (deployRes.logsUrl) logger.info(`Logs: ${deployRes.logsUrl}`);
          throw new Error(message);
        }
        return;
      }
      const detection = await detectNextApp({ cwd: targetCwd });
      const wantSync = opts.syncEnv === true || process.env.OPD_SYNC_ENV === "1";
      if (!opts.dryRun && wantSync) {
        const envTarget = opts.env === "prod" ? "prod" : "preview";
        const candidates = envTarget === "prod" ? [".env.production.local", ".env"] : [".env", ".env.local"];
        let chosenFile;
        for (const f of candidates) {
          if (await fsx.exists((0, import_node_path25.join)(targetCwd, f))) {
            chosenFile = f;
            break;
          }
        }
        if (chosenFile) {
          logger.section("Environment");
          logger.note(`Syncing ${chosenFile} \u2192 ${provider}`);
          try {
            try {
              const patterns = await computeRedactors({ cwd: targetCwd, envFiles: [chosenFile], includeProcessEnv: true });
              if (patterns.length > 0) logger.setRedactors(patterns);
            } catch {
            }
            await envSync({ provider: "vercel", cwd: targetCwd, file: chosenFile, env: envTarget, yes: true, ci: Boolean(opts.ci), json: false, projectId: opts.project, orgId: opts.org, ignore: [], only: [] });
            logger.success("Environment sync complete");
          } catch (e) {
            logger.warn(`Env sync skipped: ${e.message}`);
          }
        } else {
          logger.note("No local .env file found to sync");
        }
      }
      if (provider === "vercel") {
        const plugin = await loadProvider("vercel");
        await plugin.validateAuth(targetCwd);
        const targetLink = (0, import_node_path25.join)(targetCwd, ".vercel", "project.json");
        const rootLink = (0, import_node_path25.join)(rootCwd, ".vercel", "project.json");
        const targetIsLinked = await fsx.exists(targetLink);
        const rootIsLinked = await fsx.exists(rootLink);
        const runCwd = targetIsLinked ? targetCwd : rootIsLinked && !targetIsLinked ? rootCwd : targetCwd;
        if (runCwd !== targetCwd) logger.info(`Using linked directory for Vercel deploy: ${runCwd}`);
        if (!opts.dryRun) {
          const sp = spinner("Vercel: preparing");
          if (process.env.OPD_NDJSON === "1") logger.json({ event: "phase", phase: "prepare", provider: "vercel", path: runCwd });
          if (runCwd === targetCwd && (opts.project || opts.org)) {
            const linkFlags = ["--yes"];
            if (opts.project) linkFlags.push(`--project ${opts.project}`);
            if (opts.org) linkFlags.push(`--org ${opts.org}`);
            await proc.run({ cmd: `vercel link ${linkFlags.join(" ")}`, cwd: runCwd });
          }
          let cmd = opts.env === "prod" ? "vercel deploy --prod --yes" : "vercel deploy --yes";
          let usedPrebuilt = false;
          try {
            const hasWorkspace = await fsx.exists((0, import_node_path25.join)(rootCwd, "pnpm-workspace.yaml"));
            const targetHasLock = await fsx.exists((0, import_node_path25.join)(runCwd, "pnpm-lock.yaml"));
            const wantLocalBuild = process.env.OPD_LOCAL_BUILD === "1" || hasWorkspace && !targetHasLock;
            if (wantLocalBuild) {
              sp.update("Vercel: local build");
              const buildCmd = "vercel build";
              const build = await proc.run({ cmd: buildCmd, cwd: runCwd });
              if (!build.ok) {
                throw new Error(build.stderr.trim() || build.stdout.trim() || "Vercel local build failed");
              }
              cmd = opts.env === "prod" ? "vercel deploy --prebuilt --prod --yes" : "vercel deploy --prebuilt --yes";
              usedPrebuilt = true;
            }
          } catch {
          }
          const deployTimeout = Number.isFinite(Number(process.env.OPD_TIMEOUT_MS)) ? Number(process.env.OPD_TIMEOUT_MS) : 9e5;
          const t0 = Date.now();
          if (process.env.OPD_NDJSON === "1") logger.json({ event: "phase", phase: "deploy", provider: "vercel", command: cmd, cwd: runCwd, prebuilt: usedPrebuilt });
          sp.update("Vercel: deploying");
          const stop = startHeartbeat({ label: "vercel deploy", hint: "Tip: opendeploy open vercel --path apps/web", intervalMs: process.env.OPD_NDJSON === "1" ? 5e3 : 1e4 });
          let capturedUrl;
          let capturedInspect;
          const urlRe = /https?:\/\/[^\s]+vercel\.app/g;
          const inspectRe = /https?:\/\/[^\s]*vercel\.com[^\s]*/g;
          const controller = proc.spawnStream({
            cmd,
            cwd: runCwd,
            timeoutMs: deployTimeout,
            onStdout: (chunk) => {
              if (process.env.OPD_NDJSON === "1") logger.json({ event: "vc:stdout", line: chunk });
              const m = chunk.match(urlRe);
              if (!capturedUrl && m && m.length > 0) capturedUrl = m[0];
              if (process.env.OPD_NDJSON !== "1" && process.env.OPD_JSON !== "1") {
                const t = chunk.replace(/\s+$/, "");
                if (t.length > 0) logger.info(t);
              }
            },
            onStderr: (chunk) => {
              if (process.env.OPD_NDJSON === "1") logger.json({ event: "vc:stderr", line: chunk });
              if (!capturedInspect) {
                const im = chunk.match(inspectRe);
                if (im && im.length > 0) capturedInspect = im[0];
              }
              if (process.env.OPD_NDJSON !== "1" && process.env.OPD_JSON !== "1") {
                const s = chunk.toLowerCase();
                if (s.includes("queued")) sp.update("Vercel: queued");
                else if (s.includes("building")) sp.update("Vercel: building");
                else if (s.includes("completing")) sp.update("Vercel: completing");
              }
            }
          });
          const res = await controller.done;
          stop();
          const durationMs = Date.now() - t0;
          if (!res.ok) throw new Error("Vercel deploy failed");
          const url = capturedUrl;
          const logsUrl = capturedInspect;
          let finalLogsUrl = logsUrl;
          if (!finalLogsUrl && url) {
            try {
              const insp = await proc.run({ cmd: `vercel inspect ${url}`.trim(), cwd: runCwd });
              const text = (insp.stdout || "") + "\n" + (insp.stderr || "");
              const m = text.match(inspectRe);
              if (m && m.length > 0) finalLogsUrl = m[0];
            } catch {
            }
          }
          let projectId;
          try {
            const p = (0, import_node_path25.join)(runCwd, ".vercel", "project.json");
            const buf = await (0, import_promises18.readFile)(p, "utf8");
            const js = JSON.parse(buf);
            if (typeof js.projectId === "string") projectId = js.projectId;
          } catch {
          }
          let aliasUrl;
          if (url && opts.alias) {
            try {
              const al = await proc.run({ cmd: `vercel alias set ${url} ${opts.alias}`.trim(), cwd: runCwd });
              if (al.ok) aliasUrl = `https://${opts.alias}`;
            } catch {
            }
          }
          if (opts.json === true || process.env.OPD_NDJSON === "1") {
            logger.json({ url, logsUrl: finalLogsUrl, aliasUrl, projectId, provider: "vercel", target: opts.env === "prod" ? "prod" : "preview", durationMs, final: true });
            return;
          }
          sp.succeed(url ? `Vercel: deployed ${url}` : "Vercel: deployed");
          if (url !== void 0) logger.success(`Deployed: ${url}`);
          if (aliasUrl) logger.success(`Aliased: ${aliasUrl}`);
          printDeploySummary({ provider: "vercel", target: opts.env === "prod" ? "prod" : "preview", url, projectId, durationMs, logsUrl: finalLogsUrl });
          return;
        }
        if (opts.dryRun === true) {
          const flags = opts.env === "prod" ? "--prod --yes" : "--yes";
          logger.info(`[dry-run] vercel ${flags} (cwd=${targetCwd})`);
          if (opts.json === true || process.env.OPD_NDJSON === "1") {
            logger.json({ provider: "vercel", target: opts.env === "prod" ? "prod" : "preview", mode: "dry-run", final: true });
          }
          return;
        }
        return;
      }
      logger.error(`Unknown provider: ${provider}`);
      process.exitCode = 1;
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const info = mapProviderError(provider, raw);
      if (process.env.OPD_JSON === "1" || process.env.OPD_NDJSON === "1") {
        logger.json({ ok: false, command: "deploy", provider, target: opts.env ?? "preview", path: opts.path, code: info.code, message: info.message, remedy: info.remedy, error: raw, final: true });
      }
      logger.error(`${info.message} (${info.code})`);
      if (info.remedy) logger.info(`Try: ${info.remedy}`);
      const annMode = process.env.OPD_GHA_ANN;
      const inCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
      if (inCI && annMode !== "off") {
        const sev = annMode === "error" ? "error" : "warning";
        console.log(`::${sev} ::${info.message}${info.remedy ? ` | Try: ${info.remedy}` : ""}`);
      }
      process.exitCode = 1;
    }
  });
  program.command("logs").description("Open or tail provider logs for the last deployment").argument("<provider>", "Target provider: vercel | cloudflare").option("--env <env>", "Environment: prod | preview", "prod").option("--follow", "Tail runtime logs (best-effort)").option("--path <dir>", "Path to app directory (for monorepos)").option("--project <id>", "Vercel project ID or name").option("--org <id>", "Vercel org/team ID or slug").option("--limit <n>", "Look back N recent deployments (default: 1)", "1").option("--sha <commit>", "Prefer deployment matching this commit SHA (prefix allowed)").option("--json", "Output JSON result").option("--since <duration>", "Since duration for provider logs (e.g., 1h, 15m)").option("--open", "Open the Inspect URL in the browser after resolving it").action(async (provider, opts) => {
    const rootCwd = process.cwd();
    const targetCwd = opts.path ? (0, import_node_path25.isAbsolute)(opts.path) ? opts.path : (0, import_node_path25.join)(rootCwd, opts.path) : rootCwd;
    try {
      if (opts.json === true) logger.setJsonOnly(true);
      const ndjsonOn = process.env.OPD_NDJSON === "1";
      if (ndjsonOn) logger.setNdjson(true);
      if (opts.json === true || ndjsonOn) process.env.OPD_FORCE_CI = "1";
      if (provider !== "vercel" && provider !== "cloudflare") {
        logger.error(`Unknown provider: ${provider}`);
        process.exitCode = 1;
        return;
      }
      if (provider === "cloudflare") {
        const isNd = process.env.OPD_NDJSON === "1";
        const stepTimeoutV2 = Number.isFinite(Number(process.env.OPD_TIMEOUT_MS)) ? Number(process.env.OPD_TIMEOUT_MS) : 12e4;
        const wranglerPath = (0, import_node_path25.join)(targetCwd, "wrangler.toml");
        let projectName;
        try {
          if (await fsx.exists(wranglerPath)) {
            const raw = await (await import("fs/promises")).readFile(wranglerPath, "utf8");
            const m = raw.match(/\bname\s*=\s*"([^"]+)"/);
            if (m && m[1]) projectName = m[1];
          }
        } catch {
        }
        if (!projectName) {
          const base = targetCwd.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "site";
          projectName = base.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-").replace(/^-+|-+$/g, "");
        }
        let depUrlCf;
        let inspectUrlCf;
        try {
          const ls2 = await runWithRetry({ cmd: `wrangler pages deployments list --project-name ${projectName} --json`, cwd: targetCwd }, { timeoutMs: stepTimeoutV2 });
          if (ls2.ok) {
            try {
              const arr = JSON.parse(ls2.stdout);
              const chosen = Array.isArray(arr) && arr.length > 0 ? arr.find((d) => d.is_current === true) || arr[0] : void 0;
              if (chosen?.url && typeof chosen.url === "string") depUrlCf = chosen.url;
              let accountId;
              try {
                const who = await runWithRetry({ cmd: "wrangler whoami", cwd: targetCwd }, { timeoutMs: 6e4 });
                if (who.ok) {
                  const text = (who.stdout + "\n" + who.stderr).trim();
                  const m = text.match(/account\s*id\s*[:=]\s*([a-z0-9]+)/i);
                  if (m && m[1]) accountId = m[1];
                }
              } catch {
              }
              const depId = chosen.id;
              if (accountId && depId) inspectUrlCf = `https://dash.cloudflare.com/${accountId}/pages/view/${projectName}/${depId}`;
              else if (accountId) inspectUrlCf = `https://dash.cloudflare.com/${accountId}/pages/view/${projectName}`;
            } catch {
            }
          }
        } catch {
        }
        if (opts.json === true || isNd) {
          logger.json({ ok: true, action: "logs", provider: "cloudflare", env: opts.env ?? "prod", url: depUrlCf, inspectUrl: inspectUrlCf, project: projectName, final: true });
          return;
        }
        if (inspectUrlCf) logger.success(`Inspect: ${inspectUrlCf}`);
        if (depUrlCf) logger.success(`URL: ${depUrlCf}`);
        if (!inspectUrlCf && !depUrlCf) logger.info("Could not resolve Cloudflare deployment info. Ensure wrangler and project are configured.");
        if (opts.open === true && inspectUrlCf) {
          const opener = process.platform === "win32" ? `start "" "${inspectUrlCf}"` : process.platform === "darwin" ? `open "${inspectUrlCf}"` : `xdg-open "${inspectUrlCf}"`;
          void proc.run({ cmd: opener, cwd: targetCwd });
        }
        return;
      }
      const isNdjson = process.env.OPD_NDJSON === "1";
      const targetLink = (0, import_node_path25.join)(targetCwd, ".vercel", "project.json");
      const rootLink = (0, import_node_path25.join)(rootCwd, ".vercel", "project.json");
      const targetIsLinked = await fsx.exists(targetLink);
      const rootIsLinked = await fsx.exists(rootLink);
      const runCwd = targetIsLinked ? targetCwd : rootIsLinked && !targetIsLinked ? rootCwd : targetCwd;
      const n = Math.max(1, parseInt(opts.limit ?? "1", 10) || 1);
      const flags = ["list", "--json", "-n", String(n)];
      if (opts.env === "prod") flags.push("--prod");
      if (opts.project) {
        flags.push("--project", opts.project);
      }
      if (opts.org) {
        flags.push("--org", opts.org);
      }
      const listCmd = `vercel ${flags.join(" ")}`;
      const stepTimeoutV = Number.isFinite(Number(process.env.OPD_TIMEOUT_MS)) ? Number(process.env.OPD_TIMEOUT_MS) : 12e4;
      const ls = await runWithRetry({ cmd: listCmd, cwd: runCwd }, { timeoutMs: stepTimeoutV });
      if (!ls.ok) throw new Error(ls.stderr.trim() || ls.stdout.trim() || "Failed to list deployments");
      let depUrl;
      try {
        const arr = JSON.parse(ls.stdout);
        let chosen;
        if (Array.isArray(arr) && arr.length > 0) {
          if (opts.sha) {
            const needle = opts.sha.toLowerCase();
            chosen = arr.find((it) => JSON.stringify(it).toLowerCase().includes(needle));
          }
          if (!chosen) chosen = arr[0];
          const urlFrag = chosen.url;
          if (typeof urlFrag === "string") depUrl = urlFrag.startsWith("http") ? urlFrag : `https://${urlFrag}`;
        }
      } catch {
        const m = ls.stdout.match(/https?:\/\/[^\s]+vercel\.app/);
        if (m) depUrl = m[0];
      }
      if (!depUrl) throw new Error("No recent deployment found");
      const insp = await runWithRetry({ cmd: `vercel inspect ${depUrl}`, cwd: runCwd }, { timeoutMs: stepTimeoutV });
      if (!insp.ok) throw new Error(insp.stderr.trim() || insp.stdout.trim() || "Failed to fetch inspect info");
      const inspectRe2 = /https?:\/\/[^\s]*vercel\.com[^\s]*/g;
      const im = insp.stdout.match(inspectRe2);
      const inspectUrl = im?.[0];
      const isNdjsonV = process.env.OPD_NDJSON === "1";
      if (opts.follow === true) {
        if (isNdjsonV) logger.json({ event: "logs:start", provider: "vercel", url: depUrl, inspectUrl });
        const spV = !isNdjsonV && process.env.OPD_JSON !== "1" ? spinner("Vercel: logs") : null;
        try {
          const envFlag = opts.env === "prod" ? "--prod" : "";
          const since = opts.since ? ` --since ${opts.since}` : "";
          const follow = " -f";
          const cmd = `vercel logs ${depUrl}${follow}${since} ${envFlag}`.trim();
          const ctrl = proc.spawnStream({ cmd, cwd: runCwd });
          await ctrl.done;
          if (spV) spV.succeed("Vercel: logs end");
          if (isNdjsonV) logger.json({ event: "logs:end", ok: true, final: true });
          process.exitCode = 0;
        } catch (e) {
          if (spV) spV.fail("Vercel: logs error");
          if (isNdjsonV) logger.json({ event: "logs:end", ok: false, error: String(e instanceof Error ? e.message : e), final: true });
          process.exitCode = 1;
        }
        return;
      }
      if (opts.json === true || isNdjsonV) {
        logger.json({ ok: true, command: "logs", provider: "vercel", env: opts.env ?? "prod", url: depUrl, inspectUrl, project: opts.project, org: opts.org, final: true });
      } else {
        if (inspectUrl) logger.success(`Inspect: ${inspectUrl}`);
        else logger.info("Inspect information printed above.");
      }
      if (opts.open === true && inspectUrl) {
        const opener = process.platform === "win32" ? `start "" "${inspectUrl}"` : process.platform === "darwin" ? `open "${inspectUrl}"` : `xdg-open "${inspectUrl}"`;
        void proc.run({ cmd: opener, cwd: runCwd });
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const info = mapProviderError(provider, raw);
      if (process.env.OPD_JSON === "1" || process.env.OPD_NDJSON === "1") {
        logger.json({ ok: false, command: "logs", provider, code: info.code, message: info.message, remedy: info.remedy, error: raw, final: true });
      }
      logger.error(`${info.message} (${info.code})`);
      if (info.remedy) logger.info(`Try: ${info.remedy}`);
      process.exitCode = 1;
    }
  });
  program.command("open").description("Open the project dashboard on the provider").argument("<provider>", "Target provider: vercel | github | cloudflare").option("--project <id>", "Provider project/site ID").option("--org <id>", "Provider org/team ID (vercel)").option("--path <dir>", "Path to app directory (for monorepos)").action(async (provider, opts) => {
    const rootCwd = process.cwd();
    const targetCwd = opts.path ? (0, import_node_path25.join)(rootCwd, opts.path) : rootCwd;
    try {
      if (provider === "vercel") {
        const targetLink = (0, import_node_path25.join)(targetCwd, ".vercel", "project.json");
        const rootLink = (0, import_node_path25.join)(rootCwd, ".vercel", "project.json");
        const targetIsLinked = await fsx.exists(targetLink);
        const rootIsLinked = await fsx.exists(rootLink);
        const runCwd = targetIsLinked ? targetCwd : rootIsLinked && !targetIsLinked ? rootCwd : targetCwd;
        if (opts.project || opts.org) {
          const linkFlags = ["--yes"];
          if (opts.project) linkFlags.push(`--project ${opts.project}`);
          if (opts.org) linkFlags.push(`--org ${opts.org}`);
          await proc.run({ cmd: `vercel link ${linkFlags.join(" ")}`, cwd: runCwd });
        }
        const plugin = await loadProvider("vercel");
        await plugin.open({ projectId: opts.project, orgId: opts.org });
        logger.success("Opened Vercel dashboard");
        return;
      }
      if (provider === "cloudflare") {
        const wranglerPath = (0, import_node_path25.join)(targetCwd, "wrangler.toml");
        let projectName;
        try {
          if (await fsx.exists(wranglerPath)) {
            const raw = await (await import("fs/promises")).readFile(wranglerPath, "utf8");
            const m = raw.match(/\bname\s*=\s*"([^"]+)"/);
            if (m && m[1]) projectName = m[1];
          }
        } catch {
        }
        if (!projectName) {
          const base = targetCwd.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "site";
          projectName = base.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-").replace(/^-+|-+$/g, "");
        }
        let accountId;
        try {
          const who = await runWithRetry({ cmd: "wrangler whoami", cwd: targetCwd }, { timeoutMs: 6e4 });
          if (who.ok) {
            const text = (who.stdout + "\n" + who.stderr).trim();
            const m = text.match(/account\s*id\s*[:=]\s*([a-z0-9]+)/i);
            if (m && m[1]) accountId = m[1];
          }
        } catch {
        }
        if (!accountId) {
          logger.error("Could not determine Cloudflare account id (run: wrangler login)");
          process.exitCode = 1;
          return;
        }
        const dashUrl = `https://dash.cloudflare.com/${accountId}/pages/view/${projectName}`;
        const opener = process.platform === "win32" ? `start "" "${dashUrl}"` : process.platform === "darwin" ? `open "${dashUrl}"` : `xdg-open "${dashUrl}"`;
        void proc.run({ cmd: opener, cwd: targetCwd });
        logger.success(`Opened Cloudflare Pages dashboard: ${dashUrl}`);
        return;
      }
      if (provider === "github") {
        const ghEnv = process.env.GITHUB_REPOSITORY;
        let owner;
        let repo;
        if (ghEnv && ghEnv.includes("/")) {
          const [o, r] = ghEnv.split("/");
          owner = o;
          repo = r;
        }
        if (!owner || !repo) {
          try {
            const origin = await proc.run({ cmd: "git remote get-url origin", cwd: targetCwd });
            if (origin.ok) {
              const t = origin.stdout.trim();
              const httpsRe = /^https?:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/i;
              const sshRe = /^git@github\.com:(.+?)\/(.+?)(?:\.git)?$/i;
              const m1 = t.match(httpsRe);
              const m2 = t.match(sshRe);
              owner = (m1?.[1] || m2?.[1] || "").trim();
              repo = (m1?.[2] || m2?.[2] || "").trim();
            }
          } catch {
          }
        }
        if (!owner || !repo) {
          logger.error("Could not infer GitHub repository (set GITHUB_REPOSITORY or ensure origin remote).");
          process.exitCode = 1;
          return;
        }
        const siteUrl = repo.toLowerCase() === `${owner.toLowerCase()}.github.io` ? `https://${owner}.github.io/` : `https://${owner}.github.io/${repo}/`;
        const opener = process.platform === "win32" ? `start "" "${siteUrl}"` : process.platform === "darwin" ? `open "${siteUrl}"` : `xdg-open "${siteUrl}"`;
        void proc.run({ cmd: opener, cwd: targetCwd });
        logger.success(`Opened: ${siteUrl}`);
        return;
      }
      logger.error(`Unknown provider: ${provider}`);
      process.exitCode = 1;
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const info = mapProviderError(provider, raw);
      if (process.env.OPD_JSON === "1" || process.env.OPD_NDJSON === "1") {
        logger.json({ ok: false, command: "logs", provider, code: info.code, message: info.message, remedy: info.remedy, error: raw, final: true });
      }
      logger.error(`${info.message} (${info.code})`);
      if (info.remedy) logger.info(`Try: ${info.remedy}`);
      process.exitCode = 1;
    }
  });
}

// src/commands/seed.ts
var import_commander6 = require("commander");

// src/core/seed/postgres.ts
var import_promises19 = require("fs/promises");
var import_node_path26 = require("path");
var import_pg = require("pg");
init_fs();
init_logger();
function maskUrl(url) {
  try {
    const u = new URL(url);
    const user = u.username;
    const host = u.hostname;
    const db = u.pathname.replace(/^\//, "");
    return `postgres://${user !== "" ? user : "user"}@${host}/${db}`;
  } catch {
    return "postgres://***";
  }
}
function needsSsl(dbUrl) {
  return dbUrl.includes("sslmode=require") || dbUrl.includes("neon.tech") || dbUrl.includes("render.com") || dbUrl.includes("vercel-storage.com");
}
var PostgresSeeder = class {
  async seed(args) {
    const filePath = await this.resolveFilePath({ cwd: args.cwd, file: args.file });
    if (filePath === null) throw new Error("No seed file found. Provide --file or add prisma/seed.sql or seed.sql");
    const sql = await this.readSql({ path: filePath });
    if (args.dryRun === true) {
      logger.info(`Dry-run: would execute ${sql.length} characters of SQL on ${maskUrl(args.dbUrl)}`);
      return;
    }
    await this.execute({ dbUrl: args.dbUrl, sql });
    logger.success(`Seed complete on ${maskUrl(args.dbUrl)}`);
  }
  async resolveFilePath(args) {
    if (args.file !== void 0) return (0, import_node_path26.join)(args.cwd, args.file);
    const p1 = (0, import_node_path26.join)(args.cwd, "prisma", "seed.sql");
    if (await fsx.exists(p1)) return p1;
    const p2 = (0, import_node_path26.join)(args.cwd, "seed.sql");
    if (await fsx.exists(p2)) return p2;
    return null;
  }
  async readSql(args) {
    const buf = await (0, import_promises19.readFile)(args.path, "utf8");
    return buf.replace(/^\uFEFF/, "").trim();
  }
  async execute(args) {
    const client = new import_pg.Client({ connectionString: args.dbUrl, ssl: needsSsl(args.dbUrl) ? { rejectUnauthorized: false } : void 0 });
    try {
      await client.connect();
      await client.query("BEGIN");
      await client.query(args.sql);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {
      });
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Seed failed: ${message}`);
    } finally {
      await client.end().catch(() => {
      });
    }
  }
};

// src/core/seed/prisma.ts
init_package_manager();
init_process();
init_logger();
function maskUrl2(url) {
  try {
    const u = new URL(url);
    const user = u.username;
    const host = u.hostname;
    const db = u.pathname.replace(/^\//, "");
    return `postgres://${user !== "" ? user : "user"}@${host}/${db}`;
  } catch {
    return "postgres://***";
  }
}
function commandForPm(pm) {
  if (pm === "pnpm") return "pnpm exec prisma db seed";
  if (pm === "yarn") return "yarn prisma db seed";
  if (pm === "bun") return "bunx prisma db seed";
  return "npx prisma db seed";
}
var PrismaSeeder = class {
  async seed(args) {
    const pm = await detectPackageManager({ cwd: args.cwd });
    const cmd = commandForPm(pm);
    if (args.dryRun === true) {
      logger.info(`Dry-run: would execute "${cmd}" with DATABASE_URL=${maskUrl2(args.dbUrl)}`);
      return;
    }
    const mergedEnv = { ...args.env ?? {}, DATABASE_URL: args.dbUrl };
    const out = await proc.run({ cmd, cwd: args.cwd, env: mergedEnv });
    if (!out.ok) throw new Error(out.stderr.trim() || out.stdout.trim() || "Prisma seed failed");
    logger.success("Prisma seed complete");
  }
};

// src/core/seed/script.ts
init_package_manager();
init_process();
init_logger();
function maskUrl3(url) {
  try {
    const u = new URL(url);
    const user = u.username;
    const host = u.hostname;
    const db = u.pathname.replace(/^\//, "");
    return `postgres://${user !== "" ? user : "user"}@${host}/${db}`;
  } catch {
    return "postgres://***";
  }
}
function pmRun(pm, script) {
  if (pm === "pnpm") return `pnpm run ${script}`;
  if (pm === "yarn") return `yarn ${script}`;
  if (pm === "bun") return `bun run ${script}`;
  return `npm run ${script}`;
}
var ScriptSeeder = class {
  async seed(args) {
    const pm = await detectPackageManager({ cwd: args.cwd });
    const script = args.script ?? "db:seed";
    const cmd = pmRun(pm, script);
    if (args.dryRun === true) {
      const target = args.dbUrl ? maskUrl3(args.dbUrl) : "(inherited)";
      logger.info(`Dry-run: would execute "${cmd}" with DATABASE_URL=${target}`);
      return;
    }
    const mergedEnv = { ...args.env ?? {} };
    if (args.dbUrl) mergedEnv.DATABASE_URL = args.dbUrl;
    const out = await proc.run({ cmd, cwd: args.cwd, env: Object.keys(mergedEnv).length ? mergedEnv : void 0 });
    if (!out.ok) throw new Error(out.stderr.trim() || out.stdout.trim() || `Seeding script failed: ${script}`);
    logger.success("Script seed complete");
  }
};

// src/commands/seed.ts
init_logger();
function resolveDbUrl(opts) {
  if (typeof opts.dbUrl === "string" && opts.dbUrl.length > 0) return opts.dbUrl;
  const env = new EnvLoader().load();
  const url = env.DATABASE_URL;
  return typeof url === "string" && url.length > 0 ? url : null;
}
function isPostgresUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "postgres:" || u.protocol === "postgresql:";
  } catch {
    return false;
  }
}
function registerSeedCommand(program) {
  program.command("seed").description("Seed a database (SQL, Prisma, or package.json script)").option("--db-url <url>", "Postgres connection string (defaults to DATABASE_URL)").option("--file <path>", "SQL file path (defaults to prisma/seed.sql or seed.sql)").option("--env <env>", "Target environment: prod | preview | development", "preview").option("--schema <schema>", "Seed schema: sql | prisma | script", "sql").option("--script <name>", "Package.json script name to run (when --schema script)", "db:seed").option("--dry-run", "Print what would happen without executing SQL").option("--yes", "Skip confirmation prompts").option("--env-file <path>", "Load additional env vars from a .env file and pass to the seed process").option("--json", "Output JSON summary").option("--ci", "CI mode (non-interactive, safer defaults)").action(async (opts) => {
    const cwd = process.cwd();
    try {
      if (opts.json === true) logger.setJsonOnly(true);
      const schema = opts.schema ?? "sql";
      const dbUrl = resolveDbUrl(opts);
      if (schema !== "script") {
        if (dbUrl === null) throw new Error("Missing database URL. Pass --db-url or set DATABASE_URL in environment/.env");
        if (!isPostgresUrl(dbUrl)) throw new Error("Only Postgres is supported for now. Expect protocol postgres:// or postgresql://");
      }
      if (opts.env === "prod" && opts.yes !== true && opts.ci !== true) {
        const ok = await confirm("You are about to run seed against PROD. Continue?", { defaultYes: false });
        if (!ok) {
          logger.warn("Seed aborted by user");
          return;
        }
      }
      let extraEnv;
      if (typeof opts.envFile === "string" && opts.envFile.length > 0) {
        extraEnv = await parseEnvFile({ path: opts.envFile });
      }
      const dry = opts.dryRun === true;
      const result = { mode: schema, ok: false };
      if (schema === "prisma") {
        const prisma = new PrismaSeeder();
        await prisma.seed({ cwd, dbUrl, dryRun: dry, env: extraEnv });
        result.ok = true;
      } else if (schema === "script") {
        const script = new ScriptSeeder();
        await script.seed({ cwd, dbUrl: dbUrl ?? void 0, script: opts.script, dryRun: dry, env: extraEnv });
        result.ok = true;
      } else {
        const seeder = new PostgresSeeder();
        await seeder.seed({ dbUrl, cwd, file: opts.file, dryRun: dry });
        result.ok = true;
      }
      if (opts.json === true) logger.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message);
      process.exitCode = 1;
    }
  });
}

// src/index.ts
init_logger();
init_colors();

// src/commands/run.ts
var import_commander7 = require("commander");
var import_node_path27 = require("path");
init_fs();
init_logger();
var import_ajv4 = __toESM(require("ajv"), 1);

// src/schemas/run-summary.schema.ts
var runSummarySchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: true,
  required: ["ok", "action", "final"],
  properties: {
    ok: { type: "boolean" },
    action: { const: "run" },
    final: { type: "boolean" }
  }
};

// src/utils/concurrency.ts
async function mapLimit(items, limit, worker) {
  const n = Math.max(1, Math.floor(limit) || 1);
  const results = new Array(items.length);
  let next = 0;
  async function start() {
    const idx = next++;
    if (idx >= items.length) return;
    try {
      results[idx] = await worker(items[idx], idx);
    } finally {
      await start();
    }
  }
  const runners = [];
  for (let i = 0; i < Math.min(n, items.length); i++) runners.push(start());
  await Promise.all(runners);
  return results;
}

// src/commands/run.ts
function pickProjects(cfg, opts) {
  const all = cfg.projects;
  const byName = (names) => new Set((names ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const wantedNames = byName(opts.projects);
  const wantedTags = byName(opts.tags);
  if (opts.all === true && wantedNames.size === 0 && wantedTags.size === 0) return all;
  let sel = all;
  if (wantedNames.size > 0) sel = sel.filter((p) => wantedNames.has(p.name));
  if (wantedTags.size > 0) sel = sel.filter((p) => (p.tags ?? []).some((t) => wantedTags.has(t)));
  return sel;
}
function isStringArray(val) {
  return Array.isArray(val) && val.every((v) => typeof v === "string");
}
async function loadConfig(cwd, file) {
  const path = (0, import_node_path27.join)(cwd, file ?? "opendeploy.config.json");
  const data = await fsx.readJson(path);
  if (data === null || !Array.isArray(data.projects)) {
    throw new Error(`Config not found or invalid: ${path}`);
  }
  for (let i = 0; i < data.projects.length; i++) {
    const p = data.projects[i];
    const prefix = `projects[${i}]`;
    if (typeof p.name !== "string" || p.name.trim() === "") throw new Error(`${prefix}.name must be a non-empty string`);
    if (typeof p.path !== "string" || p.path.trim() === "") throw new Error(`${prefix}.path must be a non-empty string`);
    if (p.provider !== "vercel") throw new Error(`${prefix}.provider must be "vercel"`);
    if (p.envOnly !== void 0 && !isStringArray(p.envOnly)) throw new Error(`${prefix}.envOnly must be an array of strings`);
    if (p.envIgnore !== void 0 && !isStringArray(p.envIgnore)) throw new Error(`${prefix}.envIgnore must be an array of strings`);
    if (p.failOnAdd !== void 0 && typeof p.failOnAdd !== "boolean") throw new Error(`${prefix}.failOnAdd must be a boolean`);
    if (p.failOnRemove !== void 0 && typeof p.failOnRemove !== "boolean") throw new Error(`${prefix}.failOnRemove must be a boolean`);
    if (p.tags !== void 0 && !isStringArray(p.tags)) throw new Error(`${prefix}.tags must be an array of strings`);
    if (p.dependsOn !== void 0 && !isStringArray(p.dependsOn)) throw new Error(`${prefix}.dependsOn must be an array of strings`);
  }
  return data;
}
function registerRunCommand(program) {
  const ajv = new import_ajv4.default({ allErrors: true, strict: false, validateSchema: false });
  const validate = ajv.compile(runSummarySchema);
  const annotateRun = (obj) => {
    const ok = validate(obj);
    const errs = Array.isArray(validate.errors) ? validate.errors.map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim()) : [];
    if (process.env.OPD_SCHEMA_STRICT === "1" && errs.length > 0) {
      process.exitCode = 1;
    }
    return { ...obj, schemaOk: ok, schemaErrors: errs };
  };
  program.command("run").description("Orchestrate env+seed tasks across multiple projects from config").option("--env <env>", "Environment: prod | preview", "preview").option("--projects <names>", "Comma-separated project names to run").option("--tags <tags>", "Comma-separated tags to filter projects").option("--all", "Run for all projects").option("--concurrency <n>", "Max concurrent projects", (v) => Number.parseInt(v, 10), 2).option("--dry-run", "Dry-run mode").option("--json", "Output JSON summary only").option("--ci", "CI mode (non-interactive)").option("--config <path>", "Path to opendeploy.config.json").option("--sync-env", "Sync env to provider before seeding").option("--diff-env", "Diff env against provider before seeding").option("--project-id <id>", "Provider project ID for non-interactive link").option("--org-id <id>", "Provider org ID for non-interactive link").option("--ignore <patterns>", "Comma-separated glob patterns to ignore (e.g. NEXT_PUBLIC_*)").option("--only <patterns>", "Comma-separated glob patterns to include").option("--fail-on-add", "Exit non-zero if new keys would be added").option("--fail-on-remove", "Exit non-zero if keys are missing remotely").action(async (opts) => {
    const cwd = process.cwd();
    try {
      if (opts.json === true) logger.setJsonOnly(true);
      const env = opts.env ?? "preview";
      const cfg = await loadConfig(cwd, opts.config);
      const selected = pickProjects(cfg, opts);
      if (selected.length === 0) throw new Error("No matching projects in config");
      const results = [];
      const byName = new Map(selected.map((p) => [p.name, p]));
      const indeg = /* @__PURE__ */ new Map();
      for (const p of selected) {
        const deps = (p.dependsOn ?? []).filter((d) => byName.has(d));
        indeg.set(p.name, (indeg.get(p.name) ?? 0) + 0);
        for (const d of deps) indeg.set(p.name, (indeg.get(p.name) ?? 0) + 1);
      }
      const layers = [];
      const remaining = new Set(selected.map((p) => p.name));
      while (remaining.size > 0) {
        const layer = [];
        for (const n of Array.from(remaining)) {
          if ((indeg.get(n) ?? 0) === 0) layer.push(n);
        }
        if (layer.length === 0) throw new Error("Cycle detected in dependsOn graph");
        layers.push(layer);
        for (const n of layer) {
          remaining.delete(n);
          for (const p of selected) {
            if ((p.dependsOn ?? []).includes(n)) indeg.set(p.name, Math.max(0, (indeg.get(p.name) ?? 0) - 1));
          }
        }
      }
      const worker = async (p) => {
        const projCwd = (0, import_node_path27.join)(cwd, p.path);
        const envFile = env === "prod" ? p.envFileProd : p.envFilePreview;
        const extraEnv = envFile ? await parseEnvFile({ path: (0, import_node_path27.join)(projCwd, envFile) }) : void 0;
        const envRes = { ok: true };
        try {
          if (opts.diffEnv === true || opts.syncEnv === true) {
            if (!envFile) throw new Error("env file not configured for this environment in config");
            const filePath = envFile;
            const polOnly = (opts.only ?? (p.envOnly?.join(",") ?? (cfg.policy?.envOnly?.join(",") ?? ""))).split(",").map((s) => s.trim()).filter(Boolean);
            const polIgnore = (opts.ignore ?? (p.envIgnore?.join(",") ?? (cfg.policy?.envIgnore?.join(",") ?? ""))).split(",").map((s) => s.trim()).filter(Boolean);
            const polFailOnAdd = opts.failOnAdd ?? p.failOnAdd ?? cfg.policy?.failOnAdd ?? false;
            const polFailOnRemove = opts.failOnRemove ?? p.failOnRemove ?? cfg.policy?.failOnRemove ?? false;
            const common = {
              provider: "vercel",
              cwd: projCwd,
              file: filePath,
              env,
              json: opts.json === true,
              ci: opts.ci === true,
              projectId: opts.projectId,
              orgId: opts.orgId,
              ignore: polIgnore,
              only: polOnly,
              failOnAdd: polFailOnAdd,
              failOnRemove: polFailOnRemove
            };
            if (opts.diffEnv === true) {
              await envDiff(common);
              envRes.mode = "diff";
            }
            if (opts.syncEnv === true) {
              await envSync({ ...common, yes: true, dryRun: opts.dryRun === true });
              envRes.mode = "sync";
            }
          }
        } catch (e) {
          envRes.ok = false;
          envRes.error = e instanceof Error ? e.message : String(e);
        }
        const seedRes = { ok: true };
        try {
          if (p.seed) {
            const mode2 = p.seed.schema;
            seedRes.mode = mode2;
            if (mode2 === "script") {
              const script = new ScriptSeeder();
              await script.seed({ cwd: projCwd, script: p.seed.script, dryRun: opts.dryRun === true, env: extraEnv });
            } else if (mode2 === "prisma") {
              const dbUrl = extraEnv?.DATABASE_URL ?? process.env.DATABASE_URL ?? "";
              if (!dbUrl) throw new Error("DATABASE_URL missing for prisma seed");
              const prisma = new PrismaSeeder();
              await prisma.seed({ cwd: projCwd, dbUrl, dryRun: opts.dryRun === true, env: extraEnv });
            } else if (mode2 === "sql") {
              const dbUrl = extraEnv?.DATABASE_URL ?? process.env.DATABASE_URL ?? "";
              if (!dbUrl) throw new Error("DATABASE_URL missing for SQL seed");
              const pg = new PostgresSeeder();
              await pg.seed({ cwd: projCwd, dbUrl, dryRun: opts.dryRun === true });
            }
          }
        } catch (e) {
          seedRes.ok = false;
          seedRes.error = e instanceof Error ? e.message : String(e);
        }
        results.push({ name: p.name, env: envRes, seed: seedRes });
      };
      const conc = opts.concurrency ?? 2;
      for (const layer of layers) {
        const projs = layer.map((name) => byName.get(name)).filter(Boolean);
        await mapLimit(projs, conc, async (p) => {
          await worker(p);
        });
      }
      if (opts.json === true) {
        logger.json(annotateRun({ ok: results.every((r) => r.seed?.ok !== false && r.env?.ok !== false), action: "run", results, final: true }));
      } else {
        for (const r of results) {
          if (r.env?.mode) {
            if (r.env.ok) logger.success(`[${r.name}] env ${r.env.mode} ok`);
            else logger.error(`[${r.name}] env ${r.env.mode} failed: ${r.env.error ?? "unknown"}`);
          }
          if (r.seed?.ok) logger.success(`[${r.name}] seed ok (${r.seed.mode})`);
          else logger.error(`[${r.name}] seed failed: ${r.seed?.error ?? "unknown"}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message);
      process.exitCode = 1;
    }
  });
}

// src/commands/init.ts
var import_commander8 = require("commander");
var import_node_path28 = require("path");
var import_promises20 = require("fs/promises");
init_logger();
init_next();
function registerInitCommand(program) {
  program.command("init").description("Initialize OpenDeploy in this project (choose provider, generate configs, set defaults)").option("--json", "Output JSON summary").action(async (_opts) => {
    const cwd = process.cwd();
    try {
      const detection = await detectNextApp({ cwd });
      logger.section("OpenDeploy Init");
      const useVercel = await confirm("Use Vercel as a deployment provider?", { defaultYes: true });
      if (!useVercel) {
        logger.warn("No provider selected. Nothing to do.");
        return;
      }
      const autoSyncEnv = await confirm("Auto-sync .env before deploy (recommended)?", { defaultYes: true });
      const cfg = {
        providers: [
          ...useVercel ? ["vercel"] : []
        ],
        env: {
          autoSync: autoSyncEnv,
          ignore: [],
          only: [],
          failOnAdd: false,
          failOnRemove: false
        }
      };
      if (useVercel) {
        const ver = await loadProvider("vercel");
        await ver.validateAuth(cwd).catch(() => {
        });
        await ver.generateConfig({ detection, cwd, overwrite: false }).catch(() => {
        });
        logger.success("Vercel configuration ready");
      }
      const path = (0, import_node_path28.join)(cwd, "opendeploy.config.json");
      await (0, import_promises20.writeFile)(path, JSON.stringify(cfg, null, 2), "utf8");
      logger.success(`Wrote ${path}`);
      logger.note('Tip: run "opendeploy deploy <provider> --sync-env --env prod" for single-command prod deploy');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message);
      process.exitCode = 1;
    }
  });
}

// src/commands/completion.ts
var import_commander9 = require("commander");
function scriptFor(shell) {
  const cmds = [
    "detect",
    "doctor",
    "generate",
    "deploy",
    "logs",
    "open",
    "env",
    "seed",
    "run",
    "init",
    "up",
    "completion"
  ];
  const providers = ["vercel", "cloudflare", "github"];
  const envSub = ["sync", "pull", "diff", "validate"];
  if (shell === "bash") {
    return `# bash completion for opendeploy
_opendeploy_completions() {
  local cur prev words cword
  _get_comp_words_by_ref -n : cur prev words cword 2>/dev/null || { cur=${"$"}COMP_WORDS[${"$"}COMP_CWORD]; prev=${"$"}COMP_WORDS[${"$"}COMP_CWORD-1]; }
  case ${"$"}COMP_CWORD in
    1) COMPREPLY=( $(compgen -W "${cmds.join(" ")}" -- "${"$"}cur") ); return ;;
    2) case ${"$"}prev in
         deploy|logs|open|up) COMPREPLY=( $(compgen -W "${providers.join(" ")}" -- "${"$"}cur") ); return ;;
         env) COMPREPLY=( $(compgen -W "${envSub.join(" ")}" -- "${"$"}cur") ); return ;;
       esac;;
  esac
}
complete -F _opendeploy_completions opendeploy
`;
  }
  if (shell === "zsh") {
    return `#compdef opendeploy
_arguments 
  '1: :->sub' 
  '2: :->arg'
case ${"$"}state in
  sub) _values 'subcommands' ${cmds.map((c) => `'${c}'`).join(" ")};;
  arg) case ${"$"}words[2] in
    deploy|logs|open|up) _values 'providers' ${providers.map((p) => `'${p}'`).join(" ")};;
    env) _values 'envsub' ${envSub.map((s) => `'${s}'`).join(" ")};;
  esac;;
esac
`;
  }
  return `# PowerShell completion (basic) for opendeploy
Register-ArgumentCompleter -CommandName opendeploy -ScriptBlock {
  param(${"$"}wordToComplete, ${"$"}commandAst, ${"$"}cursorPosition)
  ${"$"}subs = @(${cmds.map((c) => `'${c}'`).join(",")})
  foreach (${"$"}s in ${"$"}subs) { if (${"$"}s -like "${"$"}wordToComplete*") { [System.Management.Automation.CompletionResult]::new(${"$"}s, ${"$"}s, 'ParameterValue', ${"$"}s) } }
}
`;
}
function registerCompletionCommand(program) {
  program.command("completion").description("Print shell completion script").option("--shell <name>", "Shell: bash | zsh | pwsh", "bash").action(async (opts) => {
    const sh = opts.shell === "zsh" ? "zsh" : opts.shell === "pwsh" ? "pwsh" : "bash";
    process.stdout.write(scriptFor(sh));
  });
}

// src/commands/promote.ts
var import_commander10 = require("commander");
var import_node_path29 = require("path");
init_logger();
init_process();
init_fs();
var import_ajv5 = __toESM(require("ajv"), 1);

// src/schemas/promote-summary.schema.ts
var promoteSummarySchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: true,
  required: ["ok", "action", "provider", "final"],
  properties: {
    ok: { type: "boolean" },
    action: { const: "promote" },
    provider: { type: "string" },
    target: { type: "string" },
    from: { type: "string" },
    url: { type: "string" },
    alias: { type: "string" },
    siteId: { type: "string" },
    cmdPlan: { type: "array", items: { type: "string" } },
    message: { type: "string" },
    final: { type: "boolean" }
  }
};

// src/commands/promote.ts
function registerPromoteCommand(program) {
  const ajv = new import_ajv5.default({ allErrors: true, strict: false, validateSchema: false });
  const validate = ajv.compile(promoteSummarySchema);
  const annotate = (obj) => {
    const ok = validate(obj);
    const errs = Array.isArray(validate.errors) ? validate.errors.map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim()) : [];
    if (process.env.OPD_SCHEMA_STRICT === "1" && errs.length > 0) {
      process.exitCode = 1;
    }
    return { ...obj, schemaOk: ok, schemaErrors: errs };
  };
  program.command("promote").description("Promote a preview to production (Vercel)").argument("<provider>", "Target provider: vercel").option("--alias <domain>", "Production alias/domain (Vercel)").option("--from <urlOrSha>", "Vercel: preview URL or commit SHA to promote; Netlify: deployId to restore").option("--path <dir>", "Path to app directory (for monorepos)").option("--json", "Output JSON result").option("--dry-run", "Do not execute actual promotion").option("--project <id>", "Provider project/site ID").option("--org <id>", "Provider org/team ID (Vercel)").option("--print-cmd", "Print underlying provider commands that will be executed").option("--retries <n>", "Retries for provider commands (default 2)").option("--timeout-ms <ms>", "Timeout per provider command in milliseconds (default 120000)").option("--base-delay-ms <ms>", "Base delay for exponential backoff with jitter (default 300)").action(async (provider, opts) => {
    const rootCwd = process.cwd();
    const targetCwd = opts.path ? (0, import_node_path29.join)(rootCwd, opts.path) : rootCwd;
    try {
      if (opts.retries) process.env.OPD_RETRIES = String(Math.max(0, Number(opts.retries) || 0));
      if (opts.timeoutMs) process.env.OPD_TIMEOUT_MS = String(Math.max(0, Number(opts.timeoutMs) || 0));
      if (opts.baseDelayMs) process.env.OPD_BASE_DELAY_MS = String(Math.max(0, Number(opts.baseDelayMs) || 0));
      const jsonMode = isJsonMode(opts.json);
      if (jsonMode) logger.setJsonOnly(true);
      const ndjsonOn = process.env.OPD_NDJSON === "1";
      if (ndjsonOn) logger.setNdjson(true);
      if (jsonMode || ndjsonOn) process.env.OPD_FORCE_CI = "1";
      if (opts.dryRun === true) {
        const base = { ok: true, provider: "vercel", action: "promote", target: "prod" };
        const cmdPlan = opts.alias ? [
          opts.from ? `vercel alias set ${opts.from} ${opts.alias}` : `vercel alias set <preview-url> ${opts.alias}`,
          ...opts.from ? [] : [`vercel list --json -n 10`]
        ] : [`vercel list --json -n 10`];
        if (jsonMode) {
          logger.jsonPrint(annotate({ ...base, from: opts.from, alias: opts.alias ? `https://${opts.alias}` : void 0, cmdPlan, final: true }));
        } else {
          logger.info(`[dry-run] promote vercel (alias=${opts.alias ?? "none"})`);
        }
        return;
      }
      if (provider === "vercel") {
        if (!opts.alias) {
          const msg = "Missing --alias <domain>. Provide the production domain to point to the preview.";
          if (jsonMode) {
            logger.jsonPrint(annotate({ ok: false, action: "promote", provider: "vercel", message: msg, final: true }));
            return;
          }
          logger.error(msg);
          return;
        }
        let previewUrl;
        if (opts.from) {
          if (opts.from.startsWith("http")) {
            previewUrl = opts.from;
          } else {
            try {
              const insp = await proc.run({ cmd: `vercel inspect ${opts.from}`, cwd: targetCwd });
              const text = (insp.stdout || "") + "\n" + (insp.stderr || "");
              const m = text.match(/https?:\/\/[^\s]+vercel\.app/g);
              if (m && m.length > 0) previewUrl = m[0];
            } catch {
            }
            if (!previewUrl) throw new Error(`Could not resolve preview URL from --from=${opts.from}. Provide a preview URL or a resolvable ref.`);
          }
        } else {
          const sp = spinner("Vercel: resolving latest preview");
          try {
            const listRes = await proc.run({ cmd: "vercel list --json -n 10", cwd: targetCwd });
            if (listRes.ok) {
              try {
                const arr = JSON.parse(listRes.stdout);
                const previews = arr.filter((d) => (d.target ?? "").toLowerCase() !== "production" && (d.readyState ?? "").toLowerCase() === "ready");
                previewUrl = previews[0]?.url ? previews[0].url.startsWith("http") ? previews[0].url : `https://${previews[0].url}` : void 0;
              } catch {
              }
            }
          } finally {
            sp.stop();
          }
        }
        if (!previewUrl) throw new Error("Could not resolve a recent preview deployment URL");
        const aliasCmd = `vercel alias set ${previewUrl} ${opts.alias}`.trim();
        if (opts.printCmd) logger.info(`$ ${aliasCmd}`);
        const set = await runWithRetry({ cmd: aliasCmd, cwd: targetCwd });
        if (!set.ok) throw new Error(set.stderr.trim() || set.stdout.trim() || "Failed to set alias for preview");
        if (jsonMode) {
          logger.jsonPrint(annotate({ ok: true, provider: "vercel", action: "promote", target: "prod", from: previewUrl, url: `https://${opts.alias}`, alias: `https://${opts.alias}`, final: true }));
          return;
        }
        logger.success(`Promoted preview \u2192 ${opts.alias}`);
        printDeploySummary({ provider: "vercel", target: "prod", url: `https://${opts.alias}` });
        return;
      }
      logger.error(`Unknown provider: ${provider}`);
      process.exitCode = 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isJsonMode(opts.json)) logger.jsonPrint(annotate({ ok: false, action: "promote", provider, message: msg, final: true }));
      logger.error(msg);
      process.exitCode = 1;
    }
  });
}

// src/commands/explain.ts
var import_commander11 = require("commander");
var import_node_path30 = require("path");
init_logger();
init_auto();
init_fs();
function registerExplainCommand(program) {
  const printJson = (val) => {
    try {
      console.log(JSON.stringify(val));
    } catch {
    }
  };
  program.command("explain").description("Show what will happen for a deploy, without executing anything").argument("<provider>", "Target provider: vercel | cloudflare | github").option("--env <env>", "Environment: prod | preview", "preview").option("--path <dir>", "Path to app directory (for monorepos)").option("--json", "Output JSON plan").option("--ci", "CI mode (assume strict guards)").option("--project <id>", "Provider project/site ID").option("--org <id>", "Provider org/team ID (Vercel)").option("--sync-env", "Plan an environment sync prior to deploy").action(async (provider, opts) => {
    const rootCwd = process.cwd();
    const targetCwd = opts.path ? (0, import_node_path30.join)(rootCwd, opts.path) : rootCwd;
    try {
      if (opts.json === true) logger.setJsonOnly(true);
      const allowed = /* @__PURE__ */ new Set(["vercel", "cloudflare", "github"]);
      if (!allowed.has(provider)) {
        if (opts.json === true) {
          const o = { ok: false, action: "explain", provider, message: `Unknown provider: ${provider}`, final: true };
          logger.jsonPrint(o);
          printJson(o);
          return;
        }
        logger.error(`Unknown provider: ${provider}`);
        process.exitCode = 1;
        return;
      }
      const detection = await detectApp({ cwd: targetCwd });
      let runCwd = targetCwd;
      if (provider === "vercel") {
        const targetLink = (0, import_node_path30.join)(targetCwd, ".vercel", "project.json");
        const rootLink = (0, import_node_path30.join)(rootCwd, ".vercel", "project.json");
        const targetIsLinked = await fsx.exists(targetLink);
        const rootIsLinked = await fsx.exists(rootLink);
        runCwd = targetIsLinked ? targetCwd : rootIsLinked ? rootCwd : targetCwd;
      }
      const target = opts.env === "prod" ? "prod" : "preview";
      const candidates = target === "prod" ? [".env.production.local", ".env"] : [".env", ".env.local"];
      let envFile;
      for (const f of candidates) {
        if (await fsx.exists((0, import_node_path30.join)(runCwd, f))) {
          envFile = f;
          break;
        }
      }
      const planSteps = [];
      planSteps.push({ id: "detect", title: "Detect app and project metadata", kind: "detect" });
      if (provider === "vercel") {
        planSteps.push({ id: "link", title: "Ensure Vercel link (project/org)", kind: "link" });
      } else if (provider === "cloudflare") {
        planSteps.push({ id: "link", title: "Ensure Pages project (name)", kind: "link" });
      } else if (provider === "github") {
        planSteps.push({ id: "link", title: "Ensure repo origin and gh-pages branch config", kind: "link" });
      }
      const wantSync = opts.syncEnv === true || Boolean(envFile);
      if (wantSync) {
        planSteps.push({ id: "env", title: `Sync environment from ${envFile ?? "local .env"} (optimized writes)`, kind: "env" });
      }
      if (provider === "vercel") {
        planSteps.push({ id: "deploy", title: `vercel deploy (${target === "prod" ? "production" : "preview"})`, kind: "deploy" });
      } else if (provider === "cloudflare") {
        const pub = detection.publishDir ?? "dist";
        planSteps.push({ id: "deploy", title: `wrangler pages deploy ${pub}`, kind: "deploy" });
      } else if (provider === "github") {
        planSteps.push({ id: "deploy", title: "static export (NEXT_EXPORT=1) \u2192 gh-pages publish", kind: "deploy" });
      }
      const plan = {
        provider,
        target,
        cwd: runCwd,
        steps: planSteps,
        envSummary: {
          plannedSync: wantSync,
          file: envFile,
          strictGuards: opts.ci ? ["fail-on-add", "fail-on-remove"] : []
        }
      };
      if (opts.json === true) {
        const o = { ok: true, action: "explain", plan, final: true };
        logger.jsonPrint(o);
        printJson(o);
        return;
      }
      logger.section("Plan");
      logger.note(`${provider} | ${target} | cwd=${runCwd}`);
      for (const s of plan.steps) logger.info(`\u2022 ${s.title}`);
      if (plan.envSummary.plannedSync) logger.info(`Env: from ${plan.envSummary.file ?? "local .env"} (optimized writes)`);
      if (plan.envSummary.strictGuards.length > 0) logger.info(`Strict: ${plan.envSummary.strictGuards.join(", ")}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (opts.json === true) {
        const o = { ok: false, action: "explain", message: msg, final: true };
        logger.jsonPrint(o);
        printJson(o);
        return;
      }
      logger.error(msg);
      process.exitCode = 1;
    }
  });
}

// src/commands/rollback.ts
var import_commander12 = require("commander");
var import_node_path31 = require("path");
init_logger();
init_process();
init_fs();
var import_ajv6 = __toESM(require("ajv"), 1);

// src/schemas/rollback-summary.schema.ts
var rollbackSummarySchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: true,
  required: ["ok", "action", "provider", "final"],
  properties: {
    ok: { type: "boolean" },
    action: { const: "rollback" },
    provider: { type: "string" },
    target: { type: "string" },
    to: { type: "string" },
    candidate: { type: "string" },
    needsAlias: { type: "boolean" },
    deployId: { type: "string" },
    dashboard: { type: "string" },
    cmdPlan: { type: "array", items: { type: "string" } },
    message: { type: "string" },
    final: { type: "boolean" }
  }
};

// src/commands/rollback.ts
function registerRollbackCommand(program) {
  const ajv = new import_ajv6.default({ allErrors: true, strict: false, validateSchema: false });
  const validate = ajv.compile(rollbackSummarySchema);
  const annotate = (obj) => {
    const ok = validate(obj);
    const errs = Array.isArray(validate.errors) ? validate.errors.map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim()) : [];
    if (process.env.OPD_SCHEMA_STRICT === "1" && errs.length > 0) {
      process.exitCode = 1;
    }
    return { ...obj, schemaOk: ok, schemaErrors: errs };
  };
  program.command("rollback").description("Rollback production to a previous successful deployment (Vercel)").argument("<provider>", "Target provider: vercel").option("--alias <domain>", "Production alias/domain (Vercel)").option("--to <urlOrSha>", "Specific deployment URL or commit SHA to rollback to (provider-dependent)").option("--path <dir>", "Path to app directory (for monorepos)").option("--json", "Output JSON result").option("--dry-run", "Do not execute actual rollback").option("--project <id>", "Provider project/site ID (Netlify siteId; optional)").option("--org <id>", "Provider org/team ID (Vercel)").option("--print-cmd", "Print underlying provider commands that will be executed").option("--retries <n>", "Retries for provider commands (default 2)").option("--timeout-ms <ms>", "Timeout per provider command in milliseconds (default 120000)").option("--base-delay-ms <ms>", "Base delay for exponential backoff with jitter (default 300)").action(async (provider, opts) => {
    const rootCwd = process.cwd();
    const targetCwd = opts.path ? (0, import_node_path31.join)(rootCwd, opts.path) : rootCwd;
    try {
      if (opts.retries) process.env.OPD_RETRIES = String(Math.max(0, Number(opts.retries) || 0));
      if (opts.timeoutMs) process.env.OPD_TIMEOUT_MS = String(Math.max(0, Number(opts.timeoutMs) || 0));
      if (opts.baseDelayMs) process.env.OPD_BASE_DELAY_MS = String(Math.max(0, Number(opts.baseDelayMs) || 0));
      const jsonMode = isJsonMode(opts.json);
      if (jsonMode) logger.setJsonOnly(true);
      const ndjsonOn = process.env.OPD_NDJSON === "1";
      if (ndjsonOn) logger.setNdjson(true);
      if (jsonMode || ndjsonOn) process.env.OPD_FORCE_CI = "1";
      if (opts.dryRun === true) {
        const base = { ok: true, provider: "vercel", action: "rollback", target: "prod" };
        const cmdPlan = [
          `vercel list --json -n 20`,
          ...opts.alias ? [`vercel alias set ${opts.to ?? "<deployment-url>"} ${opts.alias}`] : []
        ];
        if (jsonMode) {
          logger.jsonPrint(annotate({ ...base, cmdPlan, final: true }));
        } else {
          logger.info(`[dry-run] rollback vercel`);
        }
        return;
      }
      if (provider === "vercel") {
        if (!opts.alias && !opts.to) {
          const msg = "Provide --alias <domain> (required for repoint) and/or --to <url|sha> to target a specific deployment.";
          if (jsonMode) {
            logger.jsonPrint(annotate({ ok: false, action: "rollback", provider: "vercel", message: msg, final: true }));
            return;
          }
          logger.error(msg);
          return;
        }
        const targetLink = (0, import_node_path31.join)(targetCwd, ".vercel", "project.json");
        const rootLink = (0, import_node_path31.join)(rootCwd, ".vercel", "project.json");
        const targetIsLinked = await fsx.exists(targetLink);
        const rootIsLinked = await fsx.exists(rootLink);
        const runCwd = targetIsLinked ? targetCwd : rootIsLinked ? rootCwd : targetCwd;
        let url = opts.to;
        const sp = spinner("Vercel: resolving production history");
        try {
          if (!url) {
            const listCmd = "vercel list --json -n 20";
            if (opts.printCmd) logger.info(`$ ${listCmd}`);
            const ls = await runWithRetry({ cmd: listCmd, cwd: runCwd });
            if (ls.ok) {
              try {
                const arr = JSON.parse(ls.stdout);
                const prod = arr.filter((d) => String(d.target ?? "").toLowerCase() === "production" && String(d.state ?? "").toLowerCase() === "ready");
                const prev = prod.length >= 2 ? prod[1] : prod[0];
                const frag = prev ? prev.url : void 0;
                if (typeof frag === "string" && frag.length > 0) url = frag.startsWith("http") ? frag : `https://${frag}`;
              } catch {
              }
              if (!url) {
                const m = ls.stdout.match(/https?:\/\/[^\s]+vercel\.app/);
                url = m?.[0];
              }
            }
          }
          if (url && !/^https?:\/\//i.test(url)) {
            try {
              const insp = await proc.run({ cmd: `vercel inspect ${url}`, cwd: runCwd });
              const text = (insp.stdout || "") + "\n" + (insp.stderr || "");
              const m = text.match(/https?:\/\/[^\s]+vercel\.app/g);
              if (m && m.length > 0) url = m[0];
            } catch {
            }
            if (!/^https?:\/\//i.test(url)) throw new Error(`Could not resolve URL from --to=${opts.to}. Provide a URL or a resolvable ref.`);
          }
        } finally {
          sp.stop();
        }
        if (!url) throw new Error("Could not resolve a previous production deployment");
        if (!opts.alias) {
          const msg = `Resolved candidate: ${url}. Provide --alias <domain> to repoint production.`;
          if (jsonMode) {
            logger.jsonPrint(annotate({ ok: true, provider: "vercel", action: "rollback", target: "prod", candidate: url, needsAlias: true, final: true }));
            return;
          }
          logger.info(msg);
          return;
        }
        const aliasCmd = `vercel alias set ${url} ${opts.alias}`.trim();
        if (opts.printCmd) logger.info(`$ ${aliasCmd}`);
        const res = await runWithRetry({ cmd: aliasCmd, cwd: runCwd });
        if (!res.ok) throw new Error(res.stderr.trim() || res.stdout.trim() || "Failed to point alias to previous deployment");
        if (jsonMode) {
          logger.jsonPrint(annotate({ ok: true, provider: "vercel", action: "rollback", target: "prod", to: url, url: `https://${opts.alias}`, alias: `https://${opts.alias}`, final: true }));
          return;
        }
        logger.success(`Rolled back production \u2192 ${opts.alias}`);
        if (opts.alias) printDeploySummary({ provider: "vercel", target: "prod", url: `https://${opts.alias}` });
        return;
      }
      logger.error(`Unknown provider: ${provider}`);
      process.exitCode = 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isJsonMode(opts.json)) logger.jsonPrint(annotate({ ok: false, action: "rollback", provider, message: msg, final: true }));
      logger.error(msg);
      process.exitCode = 1;
    }
  });
}

// src/commands/providers.ts
var import_commander13 = require("commander");
init_logger();
var import_node_path33 = require("path");
var import_promises21 = require("fs/promises");
init_fs();
init_workflows();
function registerProvidersCommand(program) {
  program.command("providers").description("List and inspect provider plugins").option("--json", "Output JSON").option("--id <name>", "Show info for a specific provider (e.g., vercel, cloudflare, github)").option("--emit-workflow", "When --id=github, write a GitHub Pages deploy workflow to .github/workflows/deploy-pages.yml").option("--base-path <path>", "Base path for site (e.g., /repo). Overrides auto-inference from package name").option("--site-origin <url>", "Public site origin (e.g., https://<owner>.github.io)").action(async (opts) => {
    try {
      const jsonMode = isJsonMode(opts.json);
      if (jsonMode) logger.setJsonOnly(true);
      const candidates = opts.id ? [opts.id] : ["vercel", "cloudflare", "github"];
      const results = [];
      for (const id of candidates) {
        try {
          if (id.toLowerCase() === "netlify") throw new Error("Netlify is not supported by OpenDeploy. Please use the official Netlify CLI.");
          const p = await loadProvider(id);
          results.push({ id, ok: true, capabilities: p.getCapabilities() });
        } catch (e) {
          results.push({ id, ok: false, error: e.message });
        }
      }
      const wantWorkflow = opts.emitWorkflow === true || opts["emit-workflow"] === true;
      if (wantWorkflow) {
        const id = (opts.id || "").toLowerCase();
        if (id !== "github") throw new Error("--emit-workflow currently only supports --id=github");
        const cwd = process.cwd();
        const pkgPath = (0, import_node_path33.join)(cwd, "package.json");
        let basePath = typeof opts.basePath === "string" ? String(opts.basePath).trim() : "";
        if (basePath.length === 0) {
          try {
            const pkg = await fsx.readJson(pkgPath);
            const name = String(pkg?.name || "").replace(/^@[^/]+\//, "");
            if (name) basePath = `/${name}`;
          } catch {
          }
          if (basePath.length === 0) basePath = "/site";
        }
        const siteOrigin = typeof opts.siteOrigin === "string" ? String(opts.siteOrigin).trim() : void 0;
        const wfDir = (0, import_node_path33.join)(cwd, ".github", "workflows");
        await (0, import_promises21.mkdir)(wfDir, { recursive: true });
        const wfPath = (0, import_node_path33.join)(wfDir, "deploy-pages.yml");
        const content = renderGithubPagesWorkflow({ basePath, siteOrigin });
        await (0, import_promises21.writeFile)(wfPath, content, "utf8");
        if (jsonMode) {
          logger.json({ ok: true, action: "emit-workflow", provider: "github", path: wfPath, basePath, siteOrigin, final: true });
          return;
        }
        logger.info(`Wrote GitHub Pages workflow: ${wfPath}`);
        logger.info(`Base path: ${basePath}${siteOrigin ? ` \u2022 Site origin: ${siteOrigin}` : ""}`);
      }
      if (jsonMode) {
        logger.json({ ok: true, providers: results, final: true });
        return;
      }
      logger.section("Providers");
      for (const r of results) {
        if (r.ok) logger.info(`${r.id}: ready`);
        else logger.warn(`${r.id}: ${r.error}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isJsonMode(opts.json)) logger.json({ ok: false, message: msg, final: true });
      logger.error(msg);
      process.exitCode = 1;
    }
  });
}

// src/commands/plan.ts
var import_commander14 = require("commander");
var import_node_path34 = require("path");
init_logger();
function registerPlanCommand(program) {
  program.command("plan").description("Compute a provider-aware build and deploy plan (does not execute)").argument("<provider>", "Target provider: vercel | cloudflare | github").option("--env <env>", "Environment: prod | preview", "preview").option("--project <id>", "Provider project/site identifier (name or ID)").option("--org <id>", "Provider org/team ID or slug").option("--path <dir>", "Path to app directory (for monorepos)").option("--json", "Output JSON (recommended for CI)").action(async (provider, opts) => {
    const rootCwd = process.cwd();
    const targetCwd = opts.path ? (0, import_node_path34.isAbsolute)(opts.path) ? opts.path : (0, import_node_path34.join)(rootCwd, opts.path) : rootCwd;
    try {
      const jsonMode = isJsonMode(opts.json);
      if (jsonMode) logger.setJsonOnly(true);
      const p = await loadProvider(provider);
      const caps = p.getCapabilities();
      const envTarget = opts.env === "prod" ? "production" : "preview";
      let publishDir;
      let framework;
      try {
        const d = await p.detect(targetCwd);
        publishDir = d.publishDir;
        framework = d.framework;
      } catch {
      }
      const cmdPlan = [];
      if (provider === "vercel") {
        cmdPlan.push(envTarget === "production" ? "vercel deploy --prod --yes" : "vercel deploy --yes");
        if (opts.project) cmdPlan.unshift(`vercel link --yes${opts.project ? ` --project ${opts.project}` : ""}${opts.org ? ` --org ${opts.org}` : ""}`.trim());
      } else if (provider === "cloudflare") {
        const fw = (framework || "").toLowerCase();
        let dir = publishDir;
        if (!dir) {
          if (fw === "astro") dir = "dist";
          else if (fw === "sveltekit") dir = "build";
          else if (fw === "next") dir = "out";
          else dir = "dist";
        }
        if (fw === "next") cmdPlan.push("# Next.js on Cloudflare Pages requires static export or next-on-pages for SSR.");
        cmdPlan.push(`wrangler pages deploy ${dir}${opts.project ? ` --project-name ${opts.project}` : ""}`.trim());
      } else if (provider === "github") {
        const fw = (framework || "").toLowerCase();
        if (fw === "astro") {
          cmdPlan.push("gh-pages -d dist");
        } else if (fw === "sveltekit") {
          cmdPlan.push("gh-pages -d build");
        } else if (fw === "next") {
          cmdPlan.push('# Next.js on GitHub Pages requires static export (next.config.js: output: "export").');
          cmdPlan.push("next build && gh-pages -d out");
        } else {
          const dir = publishDir ?? "dist";
          cmdPlan.push(`gh-pages -d ${dir}`);
        }
      } else {
        cmdPlan.push(`# unknown provider: ${provider}`);
      }
      const plan = {
        ok: true,
        action: "plan",
        provider,
        capabilities: caps,
        target: envTarget,
        cwd: targetCwd,
        framework,
        publishDir,
        cmdPlan,
        final: true
      };
      logger.jsonPrint(plan);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isJsonMode(opts.json)) logger.json({ ok: false, action: "plan", provider, message: msg, final: true });
      logger.error(msg);
      process.exitCode = 1;
    }
  });
}

// src/commands/up.ts
var import_commander16 = require("commander");
var import_node_path37 = require("path");
init_logger();
init_fs();
var import_promises23 = require("fs/promises");
init_process();

// src/utils/inspect.ts
function extractVercelInspectUrl(text) {
  if (!text) return void 0;
  const re = /https?:\/\/[^\s]*vercel\.com[^\s]*/g;
  const m = text.match(re);
  return m && m.length > 0 ? m[0] : void 0;
}

// src/commands/start.ts
var import_commander15 = require("commander");
var import_node_path36 = require("path");
init_logger();
init_process();

// src/utils/process-pref.ts
init_process();

// src/utils/process-go.ts
var import_node_child_process2 = require("child_process");
var import_node_fs = require("fs");
var import_node_path35 = require("path");
function resolveGoBin() {
  const override = process.env.OPD_GO_BIN;
  if (override && override.length > 0) return override;
  const exe = process.platform === "win32" ? "opd-go.exe" : "opd-go";
  const local = (0, import_node_path35.join)(process.cwd(), ".bin", exe);
  if ((0, import_node_fs.existsSync)(local)) return local;
  return "opd-go";
}
function defaultPty() {
  if (process.env.OPD_PTY === "1") return true;
  if (process.env.OPD_PTY === "0") return false;
  const stdoutWs = typeof process.stdout !== "undefined" ? process.stdout : void 0;
  const interactive = Boolean(stdoutWs && typeof stdoutWs.isTTY === "boolean" && stdoutWs.isTTY);
  const ci = process.env.CI === "1" || process.env.CI === "true";
  const jsonMode = process.env.OPD_JSON === "1" || process.env.OPD_NDJSON === "1";
  return interactive && !ci && !jsonMode;
}
function buildRequest(args) {
  const wantPty = typeof args.pty === "boolean" ? args.pty : defaultPty();
  const req = {
    action: "run-stream",
    cmd: args.cmd,
    cwd: args.cwd ?? "",
    timeoutSec: args.timeoutSeconds ?? 0,
    idleTimeoutSec: args.idleTimeoutSeconds ?? 0,
    env: args.env ?? {},
    pty: wantPty,
    cols: Number.isFinite(Number(args.cols)) ? Number(args.cols) : void 0,
    rows: Number.isFinite(Number(args.rows)) ? Number(args.rows) : void 0
  };
  return JSON.stringify(req);
}
function goSpawnStream(args) {
  const bin = resolveGoBin();
  const { file, argv } = getSpawnCommand(bin);
  const cp = (0, import_node_child_process2.spawn)(file, argv, { stdio: ["pipe", "pipe", "pipe"], cwd: args.cwd, windowsHide: true });
  cp.stdin.setDefaultEncoding("utf8");
  const req = buildRequest(args);
  cp.stdin.write(req + "\n");
  cp.stdin.end();
  let resolveFn;
  const done = new Promise((resolve) => {
    resolveFn = resolve;
  });
  let protocolVersion;
  const handleLine = (line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;
    try {
      const js = JSON.parse(trimmed);
      if (js.event === "hello") {
        const pv = typeof js.extra?.protocolVersion === "string" ? String(js.extra?.protocolVersion) : void 0;
        protocolVersion = pv;
        return;
      }
      if (js.event === "stdout" && typeof js.data === "string") args.onStdout?.(js.data + "\n");
      else if (js.event === "stderr" && typeof js.data === "string") args.onStderr?.(js.data + "\n");
      else if (js.event === "done" && js.final === true) {
        const ok = js.ok === true;
        const exitCode = Number.isFinite(js.exitCode) ? js.exitCode : ok ? 0 : 1;
        resolveFn?.({ ok, exitCode, reason: js.reason });
      }
    } catch {
      args.onStderr?.(line + "\n");
    }
  };
  let bufOut = "";
  let bufErr = "";
  cp.stdout.setEncoding("utf8");
  cp.stderr.setEncoding("utf8");
  cp.stdout.on("data", (d) => {
    bufOut += d;
    let idx;
    while ((idx = bufOut.indexOf("\n")) !== -1) {
      const part = bufOut.slice(0, idx);
      bufOut = bufOut.slice(idx + 1);
      handleLine(part);
    }
  });
  cp.stderr.on("data", (d) => {
    bufErr += d;
    let idx;
    while ((idx = bufErr.indexOf("\n")) !== -1) {
      const part = bufErr.slice(0, idx);
      bufErr = bufErr.slice(idx + 1);
      args.onStderr?.(part + "\n");
    }
  });
  cp.on("close", (code) => {
    const ok = (code ?? 1) === 0;
    resolveFn?.({ ok, exitCode: code ?? 1 });
  });
  const stop = () => {
    try {
      cp.kill();
    } catch {
    }
  };
  return { stop, done };
}
function getSpawnCommand(bin) {
  const lower = bin.toLowerCase();
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
    const nodeExe = process.execPath || "node";
    return { file: nodeExe, argv: [bin] };
  }
  return { file: bin, argv: [] };
}

// src/utils/process-pref.ts
var import_node_child_process3 = require("child_process");
function spawnStreamPreferred(args) {
  const forceGo = process.env.OPD_GO_FORCE === "1";
  const useGo = process.env.OPD_GO_DISABLE !== "1" && (forceGo || hasGoSidecar());
  if (useGo) {
    const goArgs = {
      ...args,
      timeoutSeconds: args.timeoutSeconds,
      idleTimeoutSeconds: args.idleTimeoutSeconds
    };
    return goSpawnStream(goArgs);
  }
  return proc.spawnStream(args);
}
var goAvailableCached;
function hasGoSidecar() {
  if (typeof goAvailableCached === "boolean") return goAvailableCached;
  try {
    const cp = (0, import_node_child_process3.spawn)("opd-go", ["-v"], { stdio: "ignore", windowsHide: true });
    let decided = false;
    cp.once("error", (err) => {
      if (!decided) {
        decided = true;
        goAvailableCached = err?.code !== "ENOENT";
      }
    });
    cp.once("close", () => {
      if (!decided) {
        decided = true;
        goAvailableCached = true;
      }
    });
  } catch {
    goAvailableCached = false;
  }
  return goAvailableCached ?? false;
}

// src/commands/start.ts
init_next();
init_astro();
init_sveltekit();
init_remix();
init_nuxt();
init_expo();
init_auto();
init_fs();
var import_promises22 = require("fs/promises");
var import_prompts = require("@clack/prompts");
async function autoDetectFramework(cwd) {
  try {
    const res = await detectApp({ cwd });
    return res.framework;
  } catch {
    return void 0;
  }
}
async function providerStatus(p) {
  try {
    if (p === "vercel") {
      const res = await runWithTimeout({ cmd: "vercel whoami" }, 1e4);
      if (res.ok && /\S/.test(res.stdout)) return "logged in";
      return "login required";
    }
    if (p === "cloudflare") {
      const who = await runWithTimeout({ cmd: "wrangler whoami" }, 1e4);
      if (who.ok && /[A-Za-z0-9_-]/.test(who.stdout)) return "logged in";
      const ver = await runWithTimeout({ cmd: "wrangler --version" }, 1e4);
      return ver.ok ? "login required" : "login required";
    }
    if (p === "github") {
      const git = await runWithTimeout({ cmd: "git --version" }, 1e4);
      if (!git.ok) return "login required";
      const rem = await runWithTimeout({ cmd: "git remote -v" }, 1e4);
      if (rem.ok && /origin\s+.*github\.com/i.test(rem.stdout)) return "logged in";
      return "login required";
    }
  } catch {
  }
  return "login required";
}
async function ensureProviderAuth(p, opts) {
  if (opts.skipAuthCheck || opts.assumeLoggedIn) return;
  const tryValidate = async () => {
    try {
      const plugin = await loadProvider(p);
      await plugin.validateAuth(process.cwd());
      return true;
    } catch {
      return false;
    }
  };
  const ok = await tryValidate();
  if (ok) return;
  if (opts.ci) throw new Error(`${p} login required`);
  const want = await (0, import_prompts.confirm)({ message: `${providerNiceName(p)} login required. Log in now?`, initialValue: true });
  if ((0, import_prompts.isCancel)(want) || want !== true) throw new Error(`${p} login required`);
  const cmd = p === "vercel" ? "vercel login" : p === "cloudflare" ? "wrangler login" : "git remote -v";
  (0, import_prompts.note)(`Running: ${cmd}`, "Auth");
  const res = await proc.run({ cmd });
  let validated = false;
  if (res.ok) {
    for (let i = 0; i < 20; i++) {
      if (await tryValidate()) {
        validated = true;
        break;
      }
      await sleep2(1e3);
    }
  }
  if (!validated) {
    const url = providerLoginUrl(p);
    (0, import_prompts.note)(`Opening ${providerNiceName(p)} login page in your browser...`, "Auth");
    try {
      await openUrl(url);
    } catch {
    }
    const proceed = await (0, import_prompts.confirm)({ message: "Continue after logging in?", initialValue: true });
    if ((0, import_prompts.isCancel)(proceed)) throw new Error(`${p} login required`);
    for (let i = 0; i < 20; i++) {
      if (await tryValidate()) {
        validated = true;
        break;
      }
      await sleep2(1e3);
    }
    if (!validated) throw new Error(`${p} login failed`);
  }
}
async function parseEnvKeys(filePath) {
  const buf = await (0, import_promises22.readFile)(filePath, "utf8");
  const keys = [];
  for (const raw of buf.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (key.length > 0) keys.push(key);
  }
  return keys;
}
function providerNiceName(p) {
  if (p === "vercel") return "Vercel";
  if (p === "cloudflare") return "Cloudflare Pages";
  return "GitHub Pages";
}
function providerLoginUrl(p) {
  if (p === "vercel") return "https://vercel.com/login";
  if (p === "cloudflare") return "https://dash.cloudflare.com/login";
  return "https://github.com/login";
}
function makeHyperlink(url, label) {
  const u = url;
  const text = label && label.length > 0 ? label : url;
  const OSC = "\x1B]8;;";
  const BEL = "\x07";
  const ESC_CLOSE = "\x1B]8;;\x07";
  return `${OSC}${u}${BEL}${text}${ESC_CLOSE}`;
}
async function findNextConfig(cwd) {
  const names = ["next.config.ts", "next.config.js", "next.config.mjs"];
  for (const n of names) {
    if (await fsx.exists((0, import_node_path36.join)(cwd, n))) return (0, import_node_path36.join)(cwd, n);
  }
  return void 0;
}
async function patchNextConfigForGithub(args) {
  let src;
  try {
    src = await (0, import_promises22.readFile)(args.path, "utf8");
  } catch {
    src = "module.exports = {}";
  }
  let out = src;
  const fixes = [];
  if (!/output\s*:\s*['"]export['"]/m.test(out)) {
    if (/output\s*:\s*['"][^'"]+['"]/m.test(out)) {
      out = out.replace(/output\s*:\s*['"][^'"]+['"]/m, "output: 'export'");
    } else {
      out = out.replace(/module\.exports\s*=\s*\{/, (match) => `${match}
  output: 'export',`);
      out = out.replace(/export\s+default\s*\{/, (match) => `${match}
  output: 'export',`);
    }
    fixes.push("github-next-output-export");
  }
  if (!/images\s*:\s*\{[^}]*unoptimized\s*:\s*true/m.test(out)) {
    if (/images\s*:\s*\{[^}]*\}/m.test(out)) {
      out = out.replace(/images\s*:\s*\{/, "images: { unoptimized: true, ");
    } else {
      out = out.replace(/module\.exports\s*=\s*\{/, (match) => `${match}
  images: { unoptimized: true },`);
      out = out.replace(/export\s+default\s*\{/, (match) => `${match}
  images: { unoptimized: true },`);
    }
    fixes.push("github-next-images-unoptimized");
  }
  if (args.setTrailing === true && !/trailingSlash\s*:\s*true/m.test(out)) {
    if (/trailingSlash\s*:\s*false/m.test(out)) {
      out = out.replace(/trailingSlash\s*:\s*false/m, "trailingSlash: true");
    } else {
      out = out.replace(/module\.exports\s*=\s*\{/, (match) => `${match}
  trailingSlash: true,`);
      out = out.replace(/export\s+default\s*\{/, (match) => `${match}
  trailingSlash: true,`);
    }
    fixes.push("github-next-trailing-true");
  }
  return { changed: out !== src, content: out, fixes };
}
async function patchNextConfigForCloudflare(args) {
  let src;
  try {
    src = await (0, import_promises22.readFile)(args.path, "utf8");
  } catch {
    src = "module.exports = {}";
  }
  let out = src;
  const fixes = [];
  if (/output\s*:\s*['"]export['"]/m.test(out)) {
    out = out.replace(/\s*output\s*:\s*['"]export['"],?/m, "");
    fixes.push("cloudflare-next-remove-output-export");
  }
  if (/assetPrefix\s*:\s*['"][^'"]+['"]/m.test(out)) {
    out = out.replace(/\s*assetPrefix\s*:\s*['"][^'"]+['"],?/m, "");
    fixes.push("cloudflare-next-remove-assetPrefix");
  }
  const bp = out.match(/basePath\s*:\s*['"]([^'"]*)['"]/m);
  if (bp && bp[1] !== "") {
    out = out.replace(/basePath\s*:\s*['"][^'"]*['"]/m, "basePath: ''");
    fixes.push("cloudflare-next-basePath-empty");
  }
  if (args.setTrailing === true && !/trailingSlash\s*:\s*false/m.test(out)) {
    if (/trailingSlash\s*:\s*true/m.test(out)) out = out.replace(/trailingSlash\s*:\s*true/m, "trailingSlash: false");
    else {
      out = out.replace(/module\.exports\s*=\s*\{/, (match) => `${match}
  trailingSlash: false,`);
      out = out.replace(/export\s+default\s*\{/, (match) => `${match}
  trailingSlash: false,`);
    }
    fixes.push("cloudflare-next-trailing-false");
  }
  return { changed: out !== src, content: out, fixes };
}
async function detectForFramework(framework, cwd) {
  if (framework === "next") return await detectNextApp({ cwd });
  if (framework === "astro") return await detectAstroApp({ cwd });
  if (framework === "sveltekit") return await detectSvelteKitApp({ cwd });
  if (framework === "remix") return await detectRemixApp({ cwd });
  if (framework === "expo") return await detectExpoApp({ cwd });
  if (framework === "nuxt") return await detectNuxtApp({ cwd });
  throw new Error(`Unsupported framework: ${framework}`);
}
async function detectPackageManager2(cwd) {
  try {
    const pkgJson = await fsx.readJson((0, import_node_path36.join)(cwd, "package.json"));
    const pmField = pkgJson?.packageManager;
    if (typeof pmField === "string" && pmField.length > 0) return String(pmField).split("@")[0];
  } catch {
  }
  try {
    if (await fsx.exists((0, import_node_path36.join)(cwd, "pnpm-lock.yaml"))) return "pnpm";
  } catch {
  }
  try {
    if (await fsx.exists((0, import_node_path36.join)(cwd, "yarn.lock"))) return "yarn";
  } catch {
  }
  try {
    if (await fsx.exists((0, import_node_path36.join)(cwd, "bun.lockb"))) return "bun";
  } catch {
  }
  try {
    if (await fsx.exists((0, import_node_path36.join)(cwd, "package-lock.json"))) return "npm";
  } catch {
  }
  return "npm";
}
function resolvePmBuildCmd(buildCommand, pkgMgr) {
  if (/^(pnpm|yarn|npm|bun)\b/.test(buildCommand)) return buildCommand;
  if (pkgMgr === "pnpm") return "pnpm build";
  if (pkgMgr === "yarn") return "yarn build";
  if (pkgMgr === "bun") return "bun run build";
  return "npm run build";
}
function wrapWithPmExec(cmd, pkgMgr) {
  const c = String(cmd).trim();
  if (c.length === 0) return resolvePmBuildCmd("build", pkgMgr);
  if (/^(pnpm|yarn|npm|bun)\b/i.test(c)) return c;
  if (pkgMgr === "pnpm") return `pnpm exec ${c}`;
  if (pkgMgr === "yarn") return `yarn ${c}`;
  if (pkgMgr === "bun") return `bunx ${c}`;
  return `npx -y ${c}`;
}
function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1e3));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const ss = s < 10 ? `0${s}` : String(s);
  return `${m}:${ss}`;
}
function truncateEventData(s, max = 2e3) {
  try {
    if (typeof s !== "string") return "";
  } catch {
    return "";
  }
  return s.length > max ? s.slice(0, max) : s;
}
async function runBuildPreflight(args) {
  const { detection, provider, cwd, ci, skipPreflight } = args;
  if (ci || skipPreflight) return;
  const want = await (0, import_prompts.confirm)({ message: "Run a quick local build to validate config?", initialValue: true });
  if ((0, import_prompts.isCancel)(want) || want !== true) return;
  const phaseText = "Building";
  const sp = spinner(phaseText);
  try {
    const startAt = Date.now();
    const hb = setInterval(() => {
      sp.update(`${phaseText} \u2014 ${formatElapsed(Date.now() - startAt)}`);
    }, 1e3);
    const pm = await detectPackageManager2(cwd);
    const detected = String(detection.buildCommand || "").trim();
    let hasBuildScript = false;
    try {
      const pkg = await fsx.readJson((0, import_node_path36.join)(cwd, "package.json"));
      hasBuildScript = typeof pkg?.scripts?.build === "string";
    } catch {
    }
    const cmd = /^(pnpm|yarn|npm|bun)\b/i.test(detected) ? detected : hasBuildScript ? resolvePmBuildCmd("build", pm) : detected.length > 0 ? wrapWithPmExec(detected, pm) : resolvePmBuildCmd("build", pm);
    const out = await proc.run({ cmd, cwd });
    if (!out.ok) {
      clearInterval(hb);
      sp.stop();
      const msg = (out.stderr || out.stdout || "Build failed").trim();
      throw new Error(msg);
    }
    clearInterval(hb);
    sp.stop();
    (0, import_prompts.note)("Build validated", "Preflight");
    logger.note("Build validated");
    console.log("Build validated");
  } catch (e) {
    sp.stop();
    const msg = e.message;
    (0, import_prompts.note)(msg, "Preflight");
    logger.note(msg);
  }
}
async function runDeploy(args) {
  const envTarget = args.env;
  if (args.provider === "cloudflare") {
    const plugin = await loadProvider("cloudflare");
    const phaseText = "Cloudflare Pages";
    let statusText = `deploying (${envTarget === "prod" ? "production" : "preview"})`;
    const sp = spinner(phaseText);
    const startAt = Date.now();
    const hb = setInterval(() => {
      sp.update(`${phaseText}: ${statusText} \u2014 ${formatElapsed(Date.now() - startAt)}`);
    }, 1e3);
    const emitStatus = (status, extra) => {
      statusText = status;
      if (process.env.OPD_NDJSON === "1") logger.json({ action: "start", provider: "cloudflare", target: envTarget, event: "status", status, ...extra ?? {} });
    };
    try {
      emitStatus("building");
      const build = await plugin.build({ cwd: args.cwd, envTarget: envTarget === "prod" ? "production" : "preview", publishDirHint: args.publishDir });
      if (!build.ok) {
        sp.stop();
        throw new Error(build.message || "Cloudflare build failed");
      }
      emitStatus("deploying");
      const project = { projectId: args.project, orgId: args.org, slug: args.project };
      const res = await plugin.deploy({ cwd: args.cwd, envTarget: envTarget === "prod" ? "production" : "preview", project, artifactDir: build.artifactDir });
      if (!res.ok) {
        sp.stop();
        throw new Error(res.message || "Cloudflare deploy failed");
      }
      emitStatus("ready");
      if (process.env.OPD_NDJSON === "1") logger.json({ action: "start", provider: "cloudflare", target: envTarget, event: "done", ok: true, url: res.url, logsUrl: res.logsUrl });
      clearInterval(hb);
      sp.stop();
      return { url: res.url, logsUrl: res.logsUrl };
    } catch (e) {
      clearInterval(hb);
      sp.stop();
      const msg = e instanceof Error ? e.message : String(e);
      const err = new Error("Cloudflare deploy failed");
      err.meta = { provider: "cloudflare", message: msg, errorLogTail: [msg] };
      if (process.env.OPD_NDJSON === "1") logger.json({ action: "start", provider: "cloudflare", target: envTarget, event: "done", ok: false, message: err.meta.message });
      throw err;
    }
  }
  if (args.provider === "github") {
    const plugin = await loadProvider("github");
    const phaseText = "GitHub Pages";
    let sp;
    let hb;
    let statusText = "deploying (production)";
    try {
      let modeVal = "actions";
      try {
        modeVal = await (0, import_prompts.select)({
          message: "GitHub Pages publishing method",
          options: [
            { value: "actions", label: "GitHub Actions (recommended)" },
            { value: "branch", label: "Branch publish (gh-pages)" }
          ],
          initialValue: "actions"
        });
      } catch {
      }
      if (modeVal === "actions") {
        const pkgPath = (0, import_node_path36.join)(args.cwd, "package.json");
        let basePath = "/site";
        try {
          const pkg = await fsx.readJson(pkgPath);
          const name = String(pkg?.name || "").replace(/^@[^/]+\//, "");
          if (name) basePath = `/${name}`;
        } catch {
        }
        let siteOrigin;
        try {
          const origin = await proc.run({ cmd: "git remote get-url origin", cwd: args.cwd });
          if (origin.ok) {
            const t = origin.stdout.trim();
            const m = t.match(/^https?:\/\/github\.com\/([^/]+)\//i) || t.match(/^git@github\.com:([^/]+)\//i);
            if (m && m[1]) siteOrigin = `https://${m[1]}.github.io`;
          }
        } catch {
        }
        const { renderGithubPagesWorkflow: renderGithubPagesWorkflow2 } = await Promise.resolve().then(() => (init_workflows(), workflows_exports));
        const wf = renderGithubPagesWorkflow2({ basePath, siteOrigin });
        const wfDir = (0, import_node_path36.join)(args.cwd, ".github", "workflows");
        await (0, import_promises22.mkdir)(wfDir, { recursive: true });
        const wfPath = (0, import_node_path36.join)(wfDir, "deploy-pages.yml");
        await (0, import_promises22.writeFile)(wfPath, wf, "utf8");
        return { url: void 0, logsUrl: void 0, alias: void 0 };
      }
      statusText = "deploying (production)";
      sp = spinner(phaseText);
      const startAt = Date.now();
      hb = setInterval(() => {
        sp.update(`${phaseText}: ${statusText} \u2014 ${formatElapsed(Date.now() - startAt)}`);
      }, 1e3);
      const emitStatus = (status, extra) => {
        statusText = status;
        if (process.env.OPD_NDJSON === "1") logger.json({ action: "start", provider: "github", target: "prod", event: "status", status, ...extra ?? {} });
      };
      emitStatus("building");
      const build = await plugin.build({ cwd: args.cwd, envTarget: "production", publishDirHint: /* @__PURE__ */ (() => {
        const hint = "out";
        return hint;
      })() });
      emitStatus("deploying");
      const project = { projectId: args.project, orgId: args.org, slug: args.project };
      const res = await plugin.deploy({ cwd: args.cwd, envTarget: "production", project, artifactDir: build.artifactDir });
      if (!res.ok) {
        sp?.stop();
        throw new Error(res.message || "GitHub Pages deploy failed");
      }
      emitStatus("ready");
      if (process.env.OPD_NDJSON === "1") logger.json({ action: "start", provider: "github", target: "prod", event: "done", ok: true, url: res.url });
      if (hb) clearInterval(hb);
      sp?.stop();
      return { url: res.url };
    } catch (e) {
      if (hb) clearInterval(hb);
      sp?.stop();
      const msg = e instanceof Error ? e.message : String(e);
      const err = new Error("GitHub Pages deploy failed");
      err.meta = { provider: "github", message: msg, errorLogTail: [msg] };
      if (process.env.OPD_NDJSON === "1") logger.json({ action: "start", provider: "github", target: "prod", event: "done", ok: false, message: err.meta.message });
      throw err;
    }
  }
  if (args.provider === "vercel") {
    if ((args.project || args.org) && !await fsx.exists((0, import_node_path36.join)(args.cwd, ".vercel", "project.json"))) {
      const flags = ["--yes"];
      if (args.project) flags.push(`--project ${args.project}`);
      if (args.org) flags.push(`--org ${args.org}`);
      const linkCmd = `vercel link ${flags.join(" ")}`;
      if (args.printCmd) logger.info(`$ ${linkCmd}`);
      await proc.run({ cmd: linkCmd, cwd: args.cwd });
    }
    const phaseText = "Vercel";
    let statusText = `deploying (${envTarget === "prod" ? "production" : "preview"})`;
    const sp = spinner(phaseText);
    const startAt = Date.now();
    const hb = setInterval(() => {
      sp.update(`${phaseText}: ${statusText} \u2014 ${formatElapsed(Date.now() - startAt)}`);
    }, 1e3);
    const urlRe = /https?:\/\/[^\s]+vercel\.app/g;
    let capturedUrl;
    let capturedLogsUrl;
    let capturedInspect;
    let emittedLogsEvent = false;
    let lastActivity = Date.now();
    const logTail = [];
    const pushTail = (raw) => {
      const t = raw.replace(/\s+$/, "");
      if (t.length === 0) return;
      logTail.push(t);
      if (logTail.length > 50) logTail.shift();
    };
    const emitStatus = (status, extra) => {
      statusText = status;
      if (process.env.OPD_NDJSON === "1") logger.json({ action: "start", provider: "vercel", target: envTarget, event: "status", status, ...extra ?? {} });
    };
    if (args.printCmd) logger.info(`$ ${envTarget === "prod" ? "vercel deploy --prod --yes" : "vercel deploy --yes"}`);
    let inspectPoll;
    let pnpmHintEmitted = false;
    const controller = spawnStreamPreferred({
      cmd: envTarget === "prod" ? "vercel deploy --prod --yes" : "vercel deploy --yes",
      cwd: args.cwd,
      timeoutSeconds: args.timeoutSeconds,
      idleTimeoutSeconds: args.idleTimeoutSeconds,
      onStdout: (chunk) => {
        lastActivity = Date.now();
        const m = chunk.match(urlRe);
        if (!capturedUrl && m && m.length > 0) capturedUrl = m[0];
        if (!pnpmHintEmitted && /Ignored build scripts:/i.test(chunk)) {
          pnpmHintEmitted = true;
          const hint = 'pnpm v9 blocked postinstall scripts (e.g., @tailwindcss/oxide, esbuild). Run "pnpm approve-builds" or add { "pnpm": { "trustedDependencies": ["@tailwindcss/oxide","esbuild"] } } to package.json.';
          if (process.env.OPD_JSON !== "1" && process.env.OPD_NDJSON !== "1" || args.showLogs === true) logger.warn(hint);
          if (process.env.OPD_NDJSON === "1") logger.json({ action: "start", provider: "vercel", target: envTarget, event: "hint", kind: "pnpm-approve-builds", message: hint });
        }
        pushTail(chunk);
        if (process.env.OPD_JSON !== "1" && process.env.OPD_NDJSON !== "1" || args.showLogs === true) {
          const t = chunk.replace(/\s+$/, "");
          if (t.length > 0) logger.info(t);
        }
        if (process.env.OPD_NDJSON === "1") {
          const data = truncateEventData(chunk);
          if (data.length > 0) logger.json({ action: "start", provider: "vercel", target: envTarget, event: "stdout", data });
        }
      },
      onStderr: (chunk) => {
        lastActivity = Date.now();
        if (!pnpmHintEmitted && /Ignored build scripts:/i.test(chunk)) {
          pnpmHintEmitted = true;
          const hint = 'pnpm v9 blocked postinstall scripts (e.g., @tailwindcss/oxide, esbuild). Run "pnpm approve-builds" or add { "pnpm": { "trustedDependencies": ["@tailwindcss/oxide","esbuild"] } } to package.json.';
          if (process.env.OPD_JSON !== "1" && process.env.OPD_NDJSON !== "1" || args.showLogs === true) logger.warn(hint);
          if (process.env.OPD_NDJSON === "1") logger.json({ action: "start", provider: "vercel", target: envTarget, event: "hint", kind: "pnpm-approve-builds", message: hint });
        }
        pushTail(chunk);
        if (!capturedInspect) {
          const found = extractVercelInspectUrl(chunk);
          if (found) {
            capturedInspect = found;
            if (!emittedLogsEvent && process.env.OPD_NDJSON === "1") {
              emittedLogsEvent = true;
              logger.json({ action: "start", provider: "vercel", target: envTarget, event: "logs", logsUrl: capturedInspect });
            }
            if (!inspectPoll) {
              inspectPoll = setInterval(() => {
                ;
                (async () => {
                  try {
                    const res2 = await proc.run({ cmd: `vercel inspect ${capturedInspect} --json`, cwd: args.cwd });
                    if (res2.ok) {
                      try {
                        const js = JSON.parse(res2.stdout);
                        const state = String((js.readyState ?? js.state ?? js.status ?? "") || "").toUpperCase();
                        if (state) emitStatus(state.toLowerCase());
                        if (state === "ERROR" || state === "FAILED") {
                          try {
                            controller.stop();
                          } catch {
                          }
                        }
                        if (state === "READY") {
                          try {
                            controller.stop();
                          } catch {
                          }
                        }
                      } catch {
                      }
                    }
                  } catch {
                  }
                })();
              }, 3e3);
            }
          }
        }
        const line = chunk.replace(/\s+$/, "");
        if (/\bQueued\b/i.test(line)) emitStatus("queued");
        else if (/\bBuilding\b/i.test(line)) emitStatus("building");
        else if (/\bProduction:|\bReady\b/i.test(line)) emitStatus("ready");
        else if (/^Error:\s/i.test(line)) {
          const msg = line.slice(6).trim();
          emitStatus("error", { message: msg });
          if (process.env.OPD_JSON !== "1" && process.env.OPD_NDJSON !== "1" || args.showLogs === true) {
            logger.error(`Error: ${msg}`);
          }
          try {
            controller.stop();
          } catch {
          }
        }
        if (process.env.OPD_NDJSON === "1") {
          const data = truncateEventData(chunk);
          if (data.length > 0) logger.json({ action: "start", provider: "vercel", target: envTarget, event: "stderr", data });
        }
      }
    });
    let idleFired = false;
    const idleCheck = args.idleTimeoutSeconds && args.idleTimeoutSeconds > 0 ? setInterval(() => {
      if (!idleFired && Date.now() - lastActivity > args.idleTimeoutSeconds * 1e3) {
        idleFired = true;
        emitStatus("idle-timeout");
        try {
          controller.stop();
        } catch {
        }
      }
    }, 2e3) : void 0;
    let timedOut = false;
    const res = args.timeoutSeconds && args.timeoutSeconds > 0 ? await Promise.race([
      controller.done,
      new Promise((resolve) => {
        setTimeout(() => {
          timedOut = true;
          try {
            controller.stop();
          } catch {
          }
          resolve({ ok: false, exitCode: 124 });
        }, args.timeoutSeconds * 1e3);
      })
    ]) : await controller.done;
    clearInterval(hb);
    if (inspectPoll) clearInterval(inspectPoll);
    if (idleCheck) clearInterval(idleCheck);
    sp.stop();
    if (!res.ok) {
      const err = new Error("Vercel deploy failed");
      err.meta = { provider: "vercel", reason: timedOut ? `timeout after ${args.timeoutSeconds}s` : idleFired ? `idle-timeout after ${args.idleTimeoutSeconds}s` : void 0, logsUrl: capturedInspect, url: capturedUrl, errorLogTail: logTail.slice(-20) };
      if (process.env.OPD_NDJSON === "1") {
        logger.json({ action: "start", provider: "vercel", target: envTarget, event: "done", ok: false, reason: err.meta.reason, url: capturedUrl, logsUrl: capturedInspect });
      }
      throw err;
    }
    if (!capturedInspect && capturedUrl) {
      try {
        const insp = await proc.run({ cmd: `vercel inspect ${capturedUrl}`, cwd: args.cwd });
        if (insp.ok) {
          const found = extractVercelInspectUrl(insp.stdout);
          if (found) capturedInspect = found;
        }
      } catch {
      }
    }
    if (process.env.OPD_NDJSON === "1" && capturedInspect && !emittedLogsEvent) {
      logger.json({ action: "start", provider: "vercel", target: envTarget, event: "logs", logsUrl: capturedInspect });
    }
    if (process.env.OPD_NDJSON === "1") {
      logger.json({ action: "start", provider: "vercel", target: envTarget, event: "done", ok: true, url: capturedUrl, logsUrl: capturedInspect });
    }
    let aliased;
    if (args.alias && capturedUrl) {
      const aliasCmd = `vercel alias set ${capturedUrl} ${args.alias}`;
      if (args.printCmd) logger.info(`$ ${aliasCmd}`);
      const aliasRes = await proc.run({ cmd: aliasCmd, cwd: args.cwd });
      if (aliasRes.ok) aliased = args.alias;
    }
    return { url: capturedUrl, logsUrl: capturedInspect, alias: aliased };
  }
  throw new Error("Unsupported provider");
}
async function runStartWizard(opts) {
  const rootCwd = process.cwd();
  const targetPath = opts.path ? (0, import_node_path36.isAbsolute)(opts.path) ? opts.path : (0, import_node_path36.join)(rootCwd, opts.path) : rootCwd;
  const targetCwd = targetPath;
  const machineMode = isJsonMode(opts.json) || Boolean(opts.ci);
  const humanNote = (msg, section2) => {
    if (isJsonMode(opts.json)) logger.note(msg);
    else (0, import_prompts.note)(msg, section2 || "Info");
  };
  let saved = {};
  try {
    const raw = await fsx.readJson((0, import_node_path36.join)(rootCwd, "opendeploy.config.json"));
    saved = (raw ?? {}).startDefaults ?? {};
  } catch {
  }
  const savedProject = typeof saved.project === "string" ? saved.project : void 0;
  const savedOrg = typeof saved.org === "string" ? saved.org : void 0;
  const detectedFramework = opts.framework ?? await autoDetectFramework(targetCwd);
  let framework = detectedFramework;
  let detection;
  try {
    if (framework) detection = await detectForFramework(framework, targetCwd);
    else {
      const res = await detectApp({ cwd: targetCwd });
      detection = res;
      framework = res.framework;
    }
  } catch {
    detection = { framework: framework ?? "next", path: targetCwd, buildCommand: "build", publishDir: "dist" };
  }
  let publishSuggestion = typeof detection.publishDir === "string" ? detection.publishDir : void 0;
  let provider = opts.provider;
  if (!provider) {
    if (opts.ci) {
      provider = "vercel";
    } else {
      const [vs, cs, gs] = await Promise.all([
        providerStatus("vercel"),
        providerStatus("cloudflare"),
        providerStatus("github")
      ]);
      const options = [
        { value: "vercel", label: `Vercel (${vs})` },
        { value: "cloudflare", label: `Cloudflare Pages (${cs})` },
        { value: "github", label: `GitHub Pages (${gs})` }
      ];
      const choice = await (0, import_prompts.select)({ message: "Select deployment provider", options });
      if ((0, import_prompts.isCancel)(choice)) {
        (0, import_prompts.cancel)("Cancelled");
        return;
      }
      provider = choice;
    }
  }
  if (!opts.generateConfigOnly) await ensureProviderAuth(provider, opts);
  await runBuildPreflight({ detection, provider, cwd: targetCwd, ci: Boolean(opts.ci), skipPreflight: Boolean(opts.skipPreflight) });
  try {
    console.log("Build validated");
  } catch {
  }
  humanNote(`${providerNiceName(provider)} selected`, "Select deployment provider");
  try {
    const plugin = await loadProvider(provider);
    try {
      await plugin.validateAuth(targetCwd);
    } catch {
    }
    try {
      const pd = await plugin.detect(targetCwd);
      if (!publishSuggestion && typeof pd.publishDir === "string" && pd.publishDir.length > 0) publishSuggestion = pd.publishDir;
    } catch {
    }
  } catch {
  }
  if (opts.generateConfigOnly === true) {
    try {
      const plugin = await loadProvider(provider);
      const cfgPath = await plugin.generateConfig({ detection, cwd: targetCwd, overwrite: false });
      humanNote(`Ensured provider config: ${cfgPath}`, "Config");
    } catch {
    }
    const envTarget2 = (opts.env ?? "preview") === "prod" ? "prod" : "preview";
    if (isJsonMode(opts.json)) {
      logger.json({ ok: true, action: "start", provider, target: envTarget2, mode: "generate-config-only", cwd: targetCwd, final: true });
    } else {
      logger.success("Config generated");
    }
    return;
  }
  if (provider === "vercel") {
    const linked = await fsx.exists((0, import_node_path36.join)(targetCwd, ".vercel", "project.json"));
    if (!linked && (opts.project || opts.org)) {
      const doLink = await (0, import_prompts.confirm)({ message: `Link this directory to Vercel project ${opts.project ?? ""}?`, initialValue: true });
      if ((0, import_prompts.isCancel)(doLink)) {
        (0, import_prompts.cancel)("Cancelled");
        return;
      }
      if (doLink) {
        const flags = ["--yes"];
        if (opts.project) flags.push(`--project ${opts.project}`);
        if (opts.org) flags.push(`--org ${opts.org}`);
        (0, import_prompts.note)(`Running: vercel link ${flags.join(" ")}`, "Link");
        const out = await proc.run({ cmd: `vercel link ${flags.join(" ")}`, cwd: targetCwd });
        if (!out.ok) {
          if (opts.json !== true) {
            if (out.stderr.trim().length > 0) logger.error(out.stderr.trim());
            if (out.stdout.trim().length > 0) logger.note(out.stdout.trim());
          }
          throw new Error("Vercel link failed");
        }
      }
    }
  }
  let effectiveProject;
  effectiveProject = opts.project ?? savedProject;
  const envTarget = (opts.env ?? saved.env ?? "preview") === "prod" ? "prod" : "preview";
  let doSync = Boolean(opts.syncEnv ?? saved.syncEnv);
  if (!opts.ci && !machineMode && opts.syncEnv === void 0 && saved.syncEnv === void 0) {
    const res = await (0, import_prompts.confirm)({ message: "Auto-sync .env before deploy?", initialValue: true });
    if ((0, import_prompts.isCancel)(res)) {
      (0, import_prompts.cancel)("Cancelled");
      return;
    }
    doSync = res;
  }
  if (doSync) {
    const candidates = envTarget === "prod" ? [".env.production.local", ".env"] : [".env", ".env.local"];
    let chosenFile;
    for (const f of candidates) {
      if (await fsx.exists((0, import_node_path36.join)(targetCwd, f))) {
        chosenFile = f;
        break;
      }
    }
    if (chosenFile) {
      const wantPlan = !machineMode ? await (0, import_prompts.confirm)({ message: `Show env sync plan for ${chosenFile} (keys only)?`, initialValue: false }) : false;
      if (!machineMode && !(0, import_prompts.isCancel)(wantPlan) && wantPlan) {
        try {
          const keys = await parseEnvKeys((0, import_node_path36.join)(targetCwd, chosenFile));
          const preview = keys.slice(0, 20).join(", ") + (keys.length > 20 ? `, \u2026(+${keys.length - 20})` : "");
          humanNote(`Env file: ${chosenFile}
Keys: ${keys.length}
Preview: ${preview}`, "Plan");
        } catch {
        }
      }
      try {
        const patterns = await computeRedactors({ cwd: targetCwd, envFiles: [chosenFile], includeProcessEnv: true });
        if (patterns.length > 0) logger.setRedactors(patterns);
      } catch {
      }
      humanNote(`Syncing ${chosenFile} \u2192 ${provider}`, "Environment");
      if (provider === "vercel") {
        await envSync({ provider, cwd: targetCwd, file: chosenFile, env: envTarget, yes: true, ci: Boolean(opts.ci), json: false, projectId: effectiveProject, orgId: opts.org, ignore: [], only: [], optimizeWrites: true });
      } else {
        (0, import_prompts.note)("Env sync not supported for this provider in the wizard (skipping)", "Environment");
      }
    } else {
      if (!machineMode) (0, import_prompts.note)("No local .env file found to sync", "Environment");
    }
  }
  try {
    if (detection.framework === "remix" && /react-router\s+build/i.test(detection.buildCommand)) {
      humanNote("Remix (React Router v7 detected)", "Framework");
    }
  } catch {
  }
  const userTimeout = Number(opts.timeout);
  const effectiveTimeout = Number.isFinite(userTimeout) && userTimeout > 0 ? Math.floor(userTimeout) : opts.ci ? 900 : void 0;
  if (provider === "github") {
    try {
      const pubDir = (0, import_node_path36.join)(targetCwd, "public");
      const marker = (0, import_node_path36.join)(pubDir, ".nojekyll");
      const existsPub = await fsx.exists(pubDir);
      const existsMarker = await fsx.exists(marker);
      if (existsPub && !existsMarker) {
        const machine = process.env.OPD_TEST_FORCE_SAFE_FIXES === "1" || isJsonMode(opts.json) || Boolean(opts.ci);
        const auto = machine;
        let apply = auto;
        if (!auto) {
          const ans = await (0, import_prompts.confirm)({ message: "Apply safe fix for GitHub Pages (.nojekyll in public/)?", initialValue: true });
          apply = !(0, import_prompts.isCancel)(ans) && ans === true;
        }
        if (apply) {
          await (0, import_promises22.writeFile)(marker, "", "utf8");
          humanNote("Ensured public/.nojekyll for GitHub Pages static hosting.", "Fix");
          if (isJsonMode(opts.json)) logger.json({ ok: true, action: "start", event: "fix", provider: "github", fix: "github-nojekyll", file: marker });
        }
      }
      const cfgPath = await findNextConfig(targetCwd);
      if (cfgPath) {
        const machine = process.env.OPD_TEST_FORCE_SAFE_FIXES === "1" || isJsonMode(opts.json) || Boolean(opts.ci);
        let apply = machine;
        if (!apply) {
          const ans = await (0, import_prompts.confirm)({ message: 'Patch next.config.* for GitHub Pages (output:"export", images.unoptimized:true, trailingSlash:true)?', initialValue: true });
          apply = !(0, import_prompts.isCancel)(ans) && ans === true;
        }
        if (apply) {
          const patched = await patchNextConfigForGithub({ path: cfgPath, setTrailing: true });
          if (patched.changed) {
            await (0, import_promises22.writeFile)(cfgPath, patched.content, "utf8");
            humanNote("Patched next.config for GitHub Pages static export.", "Config");
          }
          if (isJsonMode(opts.json)) logger.json({ ok: true, action: "start", event: "fix", provider: "github", fix: "github-next-config", file: cfgPath, changes: patched.fixes });
        }
      }
    } catch {
    }
  }
  if (provider === "cloudflare") {
    try {
      const wranglerPath = (0, import_node_path36.join)(targetCwd, "wrangler.toml");
      const existsWr = await fsx.exists(wranglerPath);
      if (!existsWr) {
        const machine = process.env.OPD_TEST_FORCE_SAFE_FIXES === "1" || isJsonMode(opts.json) || Boolean(opts.ci);
        const auto = machine;
        let apply = auto;
        if (!auto) {
          const ans = await (0, import_prompts.confirm)({ message: "Generate wrangler.toml for Cloudflare Pages (Next on Pages defaults)?", initialValue: true });
          apply = !(0, import_prompts.isCancel)(ans) && ans === true;
        }
        if (apply) {
          const content = [
            'pages_build_output_dir = ".vercel/output/static"',
            'pages_functions_directory = ".vercel/output/functions"',
            'compatibility_flags = ["nodejs_compat"]',
            ""
          ].join("\n");
          await (0, import_promises22.writeFile)(wranglerPath, content, "utf8");
          humanNote("Generated wrangler.toml with Next on Pages defaults.", "Config");
          if (isJsonMode(opts.json)) logger.json({ ok: true, action: "start", event: "fix", provider: "cloudflare", fix: "cloudflare-wrangler", file: wranglerPath });
        }
      }
      const cfgPath = await findNextConfig(targetCwd);
      if (cfgPath) {
        const machine = process.env.OPD_TEST_FORCE_SAFE_FIXES === "1" || isJsonMode(opts.json) || Boolean(opts.ci);
        let apply = machine;
        if (!apply) {
          const ans = await (0, import_prompts.confirm)({ message: 'Patch next.config.* for Cloudflare Pages (remove output:"export", empty basePath, remove assetPrefix, trailingSlash:false)?', initialValue: true });
          apply = !(0, import_prompts.isCancel)(ans) && ans === true;
        }
        if (apply) {
          const patched = await patchNextConfigForCloudflare({ path: cfgPath, setTrailing: true });
          if (patched.changed) {
            await (0, import_promises22.writeFile)(cfgPath, patched.content, "utf8");
            humanNote("Patched next.config for Cloudflare Pages SSR/hybrid.", "Config");
          }
          if (isJsonMode(opts.json)) logger.json({ ok: true, action: "start", event: "fix", provider: "cloudflare", fix: "cloudflare-next-config", file: cfgPath, changes: patched.fixes });
        }
      }
    } catch {
    }
  }
  if (provider === "github") {
    try {
      const modeVal = await (0, import_prompts.select)({
        message: "GitHub Pages publishing method",
        options: [
          { value: "actions", label: "GitHub Actions (recommended)" },
          { value: "branch", label: "Branch publish (gh-pages)" }
        ],
        initialValue: "actions"
      });
      if (modeVal === "actions") {
        const pkgPath = (0, import_node_path36.join)(targetCwd, "package.json");
        let basePath = "/site";
        try {
          const pkg = await fsx.readJson(pkgPath);
          const name = String(pkg?.name || "").replace(/^@[^/]+\//, "");
          if (name) basePath = `/${name}`;
        } catch {
        }
        let siteOrigin;
        try {
          const origin = await proc.run({ cmd: "git remote get-url origin", cwd: targetCwd });
          if (origin.ok) {
            const t = origin.stdout.trim();
            const m = t.match(/^https?:\/\/github\.com\/([^/]+)\//i) || t.match(/^git@github\.com:([^/]+)\//i);
            if (m && m[1]) siteOrigin = `https://${m[1]}.github.io`;
          }
        } catch {
        }
        const { renderGithubPagesWorkflow: renderGithubPagesWorkflow2 } = await Promise.resolve().then(() => (init_workflows(), workflows_exports));
        const wf = renderGithubPagesWorkflow2({ basePath, siteOrigin });
        const wfDir = (0, import_node_path36.join)(targetCwd, ".github", "workflows");
        await (0, import_promises22.mkdir)(wfDir, { recursive: true });
        const wfPath = (0, import_node_path36.join)(wfDir, "deploy-pages.yml");
        await (0, import_promises22.writeFile)(wfPath, wf, "utf8");
        let actionsUrl;
        try {
          const origin = await proc.run({ cmd: "git remote get-url origin", cwd: targetCwd });
          if (origin.ok) {
            const t = origin.stdout.trim();
            const m = t.match(/^https?:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?/i) || t.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?/i);
            if (m && m[1] && m[2]) actionsUrl = `https://github.com/${m[1]}/${m[2]}/actions/workflows/deploy-pages.yml`;
          }
        } catch {
        }
        if (isJsonMode(opts.json)) {
          logger.json({ ok: true, action: "start", provider, target: envTarget, mode: "workflow-only", workflowPath: wfPath, actionsUrl, cwd: targetCwd, final: true });
          if (!machineMode) (0, import_prompts.outro)("Workflow generated");
          return;
        }
        humanNote(`Wrote GitHub Actions workflow to ${wfPath}`, "Config");
        if (actionsUrl) humanNote(`Open Actions to view runs:
${actionsUrl}`, "GitHub");
        humanNote("Commit and push the workflow to trigger a deploy.", "Next step");
        if (!machineMode) (0, import_prompts.outro)("Workflow generated");
        return;
      }
    } catch {
    }
  }
  if (provider === "cloudflare") {
    const idleSeconds2 = Number(opts.idleTimeout);
    const effIdle2 = Number.isFinite(idleSeconds2) && idleSeconds2 > 0 ? Math.floor(idleSeconds2) : opts.ci ? 45 : void 0;
    const { url: url2, logsUrl: logsUrl2 } = await runDeploy({ provider, env: envTarget, cwd: targetCwd, json: Boolean(opts.json), project: effectiveProject, printCmd: opts.printCmd === true, timeoutSeconds: effectiveTimeout, idleTimeoutSeconds: effIdle2 });
    if (isJsonMode(opts.json)) {
      logger.json({ ok: true, action: "start", provider, target: envTarget, mode: "deploy", url: url2, logsUrl: logsUrl2, cwd: targetCwd, final: true });
      if (!machineMode) (0, import_prompts.outro)("Done");
      return;
    }
    if (url2) logger.success(`${envTarget === "prod" ? "Production" : "Preview"}: ${url2}`);
    if (logsUrl2) logger.note(`Logs: ${logsUrl2}`);
    if (!machineMode) (0, import_prompts.outro)("Deployment complete");
    return;
  }
  if (provider === "vercel") {
    try {
      const p = await loadProvider("vercel");
      await p.generateConfig({ detection, cwd: targetCwd, overwrite: false });
      humanNote("Ensured vercel.json", "Config");
    } catch {
    }
  }
  const idleSeconds = Number(opts.idleTimeout);
  const effIdle = Number.isFinite(idleSeconds) && idleSeconds > 0 ? Math.floor(idleSeconds) : opts.ci ? 45 : void 0;
  const { url, logsUrl, alias } = await runDeploy({ provider, env: envTarget, cwd: targetCwd, json: Boolean(opts.json), project: effectiveProject, org: opts.org ?? savedOrg, printCmd: opts.printCmd === true, alias: opts.alias, showLogs: Boolean(opts.showLogs), timeoutSeconds: effectiveTimeout, idleTimeoutSeconds: effIdle, publishDir: publishSuggestion, noBuild: Boolean(opts.noBuild) });
  let aliasAssigned = alias;
  let didPromote = false;
  if (provider === "vercel" && envTarget === "preview" && !didPromote && opts.promote === true && typeof opts.alias === "string" && opts.alias.trim().length > 0) {
    try {
      let previewUrl = url;
      if (!previewUrl) {
        const listRes = await proc.run({ cmd: "vercel list --json -n 10", cwd: targetCwd });
        if (listRes.ok) {
          try {
            const arr = JSON.parse(listRes.stdout);
            const previews = arr.filter((d) => (d.target ?? "").toLowerCase() !== "production" && (d.readyState ?? "").toLowerCase() === "ready");
            previewUrl = previews[0]?.url ? previews[0].url.startsWith("http") ? previews[0].url : `https://${previews[0].url}` : void 0;
          } catch {
          }
        }
      }
      if (previewUrl) {
        const domain = opts.alias.replace(/^https?:\/\//i, "").trim();
        const aliasCmd = `vercel alias set ${previewUrl} ${domain}`;
        if (opts.printCmd) logger.info(`$ ${aliasCmd}`);
        const set = await runWithRetry({ cmd: aliasCmd, cwd: targetCwd });
        if (set.ok) {
          aliasAssigned = `https://${domain}`;
          didPromote = true;
        } else {
          const msg = (set.stderr || set.stdout || "Failed to set alias").trim();
          logger.warn(`Promotion failed: ${msg}
Hint: Ensure the domain is added to your Vercel project (Project Settings \u2192 Domains) and that your account/team has permission to manage domains.`);
        }
      } else {
        logger.warn("Promotion skipped: could not resolve preview URL to promote. Provide --alias and optionally use --print-cmd to inspect provider commands.");
      }
    } catch {
    }
  }
  const cmd = buildNonInteractiveCmd({ provider, envTarget, path: targetPath, project: effectiveProject, org: opts.org ?? savedOrg, syncEnv: doSync });
  const buildCommand = detection.buildCommand;
  let ciEnvFile;
  let envKeysExample;
  try {
    const candidates = envTarget === "prod" ? [".env.production.local", ".env"] : [".env", ".env.local"];
    for (const f of candidates) {
      if (await fsx.exists((0, import_node_path36.join)(targetCwd, f))) {
        ciEnvFile = f;
        break;
      }
    }
    if (ciEnvFile) {
      const keys = await parseEnvKeys((0, import_node_path36.join)(targetCwd, ciEnvFile));
      envKeysExample = keys.slice(0, 10);
    }
  } catch {
  }
  if (provider === "github" && !url && !logsUrl) {
    let actionsUrl;
    try {
      const origin = await proc.run({ cmd: "git remote get-url origin", cwd: targetCwd });
      if (origin.ok) {
        const t = origin.stdout.trim();
        const m = t.match(/^https?:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?/i) || t.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?/i);
        if (m && m[1] && m[2]) actionsUrl = `https://github.com/${m[1]}/${m[2]}/actions/workflows/deploy-pages.yml`;
      }
    } catch {
    }
    const wfPath = (0, import_node_path36.join)(targetCwd, ".github", "workflows", "deploy-pages.yml");
    if (isJsonMode(opts.json)) {
      logger.json({ ok: true, action: "start", provider, target: envTarget, mode: "workflow-only", workflowPath: wfPath, actionsUrl, cwd: targetCwd, final: true });
      if (!machineMode) (0, import_prompts.outro)("Workflow generated");
      return;
    }
    humanNote(`Wrote GitHub Actions workflow to ${wfPath}`, "Config");
    if (actionsUrl) humanNote(`Open Actions to view runs:
${actionsUrl}`, "GitHub");
    humanNote("Commit and push the workflow to trigger a deploy.", "Next step");
    if (!machineMode) (0, import_prompts.outro)("Workflow generated");
    return;
  }
  if (isJsonMode(opts.json)) {
    logger.json({ ok: true, action: "start", provider, target: envTarget, mode: "deploy", url, logsUrl, alias: aliasAssigned, cmd, ciChecklist: { buildCommand, envFile: ciEnvFile, exampleKeys: envKeysExample }, cwd: targetCwd, final: true });
    if (!machineMode) (0, import_prompts.outro)("Done");
    return;
  }
  if (url) logger.success(`${envTarget === "prod" ? "Production" : "Preview"}: ${url}`);
  if (logsUrl) logger.note(`Logs: ${logsUrl}`);
  {
    const lines = [];
    lines.push(`Build command: ${buildCommand}`);
    if (ciEnvFile) lines.push(`Env file:     ${ciEnvFile}`);
    if (envKeysExample && envKeysExample.length > 0) lines.push(`Example keys: ${envKeysExample.join(", ")}${envKeysExample.length >= 10 ? "\u2026" : ""}`);
    if (lines.length > 0) humanNote(lines.join("\n"), "CI Checklist");
  }
  humanNote(`Rerun non-interactively:
${cmd}`, "Command");
  const wantCopy = await (0, import_prompts.confirm)({ message: "Copy command to clipboard?", initialValue: false });
  if ((0, import_prompts.isCancel)(wantCopy)) return (0, import_prompts.cancel)("Cancelled");
  if (wantCopy) {
    const ok = await tryCopyToClipboard(cmd);
    if (ok) humanNote("Copied command to clipboard", "Command");
  }
  if (logsUrl) {
    const wantCopyLogs = await (0, import_prompts.confirm)({ message: "Copy logs URL to clipboard?", initialValue: false });
    if (!(0, import_prompts.isCancel)(wantCopyLogs) && wantCopyLogs) {
      const ok = await tryCopyToClipboard(logsUrl);
      if (ok) humanNote("Copied logs URL to clipboard", "Command");
    }
  }
  const openMsg = logsUrl ? `Open provider dashboard/logs now?
${makeHyperlink(logsUrl, "Open logs in browser")}` : "Open provider dashboard/logs now?";
  const openNow = await (0, import_prompts.confirm)({ message: openMsg, initialValue: false });
  if (!(0, import_prompts.isCancel)(openNow) && openNow) {
    try {
      if (logsUrl) {
        const opener = process.platform === "win32" ? `powershell -NoProfile -NonInteractive -Command Start-Process "${logsUrl}"` : process.platform === "darwin" ? `open "${logsUrl}"` : `xdg-open "${logsUrl}"`;
        try {
          await runWithTimeout({ cmd: opener, cwd: targetCwd }, 5e3);
        } catch {
        }
      } else {
        try {
          const plugin = await loadProvider(provider);
          await withTimeout(plugin.open({ projectId: effectiveProject, orgId: opts.org ?? savedOrg }), 5e3);
        } catch {
        }
      }
    } catch (e) {
      logger.warn(`Open logs failed: ${e.message}`);
    }
  }
  if (opts.saveDefaults !== false) {
    const save = await (0, import_prompts.confirm)({ message: "Save these selections as defaults (opendeploy.config.json)?", initialValue: false });
    if (!(0, import_prompts.isCancel)(save) && save) {
      try {
        const cfgPath = (0, import_node_path36.join)(rootCwd, "opendeploy.config.json");
        let cfg = {};
        try {
          const raw = await fsx.readJson(cfgPath);
          cfg = raw ?? {};
        } catch {
        }
        const startDefaults = {
          framework,
          provider,
          env: envTarget,
          path: targetPath,
          syncEnv: doSync,
          project: opts.project ?? saved.project,
          org: opts.org ?? saved.org
        };
        const merged = { ...cfg, startDefaults };
        await (0, import_promises22.writeFile)(cfgPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
        humanNote(`Wrote ${cfgPath}`, "Config");
      } catch (e) {
        logger.warn(`Could not save defaults: ${e.message}`);
      }
    }
  }
  if (!machineMode) (0, import_prompts.outro)("Deployment complete");
}
function buildNonInteractiveCmd(args) {
  const parts = ["opd", "up", args.provider, "--env", args.envTarget];
  if (args.syncEnv) parts.push("--sync-env");
  if (args.path) parts.push("--path", args.path);
  if (args.project) parts.push("--project", args.project);
  if (args.org) parts.push("--org", args.org);
  return parts.join(" ");
}
async function tryCopyToClipboard(text) {
  try {
    const value = text ?? "";
    if (process.platform === "win32") {
      const ps = `powershell -NoProfile -Command "Set-Clipboard -Value @'
${value}
'@"`;
      const res = await proc.run({ cmd: ps });
      return res.ok;
    }
    if (process.platform === "darwin") {
      const res = await proc.run({ cmd: `printf %s ${JSON.stringify(value)} | pbcopy` });
      return res.ok;
    }
    try {
      const mod = await import("clipboardy").catch(() => null);
      if (mod && typeof mod.write === "function") {
        await mod.write(value);
        return true;
      }
    } catch {
    }
  } catch {
  }
  return false;
}
function sleep2(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function openUrl(url) {
  try {
    const u = url;
    const cmd = process.platform === "win32" ? `powershell -NoProfile -NonInteractive -Command Start-Process "${u}"` : process.platform === "darwin" ? `open "${u}"` : `xdg-open "${u}"`;
    const res = await runWithTimeout({ cmd }, 5e3);
    return res.ok;
  } catch {
    return false;
  }
}
function registerStartCommand(program) {
  program.command("start").description("Guided deploy wizard (select framework, provider, env, and deploy)").option("--framework <name>", "Framework: next|astro|sveltekit|remix|expo").option("--provider <name>", "Provider: vercel|cloudflare|github").option("--env <env>", "Environment: prod|preview", "preview").option("--path <dir>", "Path to app directory (monorepo)").option("--project <id>", "Provider project/site ID").option("--org <id>", "Provider org/team ID (Vercel)").option("--sync-env", "Sync environment before deploy").option("--promote", "Vercel: after a preview deploy, promote it to production by setting an alias (use with --alias)").option("--json", "JSON-only output").option("--print-cmd", "Print underlying provider commands that will be executed").option("--ci", "CI mode (non-interactive)").option("--skip-auth-check", "Skip provider login checks (assume environment is already authenticated)").option("--assume-logged-in", "Alias for --skip-auth-check; bypass auth prompts entirely").option("--dry-run", "Plan only; skip deploy").option("--skip-preflight", "Skip local build preflight validation").option("--soft-fail", "Exit with code 0 on failure; emit ok:false JSON summary instead (CI-friendly)").option("--capture", "Write JSON and NDJSON logs to ./.artifacts (defaults on in --ci)").option("--no-save-defaults", "Do not prompt to save defaults").option("--deploy", "Execute a real deploy inside the wizard").option("--alias <domain>", "Vercel only: set an alias (domain) after deploy").option("--show-logs", "Also echo provider stdout/stderr lines in human mode").option("--summary-only", "JSON: print only objects with final:true (suppresses transient JSON)").option("--idle-timeout <seconds>", "Abort if no new provider output arrives for N seconds (disabled by default)").option("--timeout <seconds>", "Abort provider subprocess after N seconds (default 900 in --ci; unlimited otherwise)").option("--debug-detect", "Emit detection JSON payload (path, framework, build/publish hints) for debugging").option("--generate-config-only", "Write minimal provider config based on detection and exit").option("--minimal", "Run with sensible defaults (non-interactive)").action(async (opts) => {
    try {
      await runStartWizard(opts);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message);
      process.exitCode = 1;
    }
  });
}

// src/commands/up.ts
init_auto();
var import_ajv7 = __toESM(require("ajv"), 1);

// src/schemas/up-summary.schema.ts
var upSummarySchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: true,
  required: ["ok", "action", "provider", "target", "final"],
  properties: {
    ok: { type: "boolean" },
    action: { const: "up" },
    provider: { type: "string", minLength: 1 },
    target: { enum: ["prod", "preview"] },
    final: { type: "boolean" },
    url: { type: "string" },
    logsUrl: { type: "string" },
    durationMs: { type: "integer", minimum: 0 },
    mode: { type: "string" },
    cmdPlan: { type: "array", items: { type: "string" } },
    schemaOk: { type: "boolean" },
    schemaErrors: { type: "array", items: { type: "string" } }
  }
};

// src/schemas/provider-build-result.schema.ts
var providerBuildResultSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: true,
  required: ["ok"],
  properties: {
    ok: { type: "boolean" },
    artifactDir: { type: "string" },
    logsUrl: { type: "string" },
    message: { type: "string" }
  }
};

// src/schemas/provider-deploy-result.schema.ts
var providerDeployResultSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: true,
  required: ["ok"],
  properties: {
    ok: { type: "boolean" },
    url: { type: "string" },
    logsUrl: { type: "string" },
    message: { type: "string" }
  }
};

// src/commands/up.ts
init_process();
function providerLoginUrl2(p) {
  const prov = String(p);
  if (prov === "vercel") return "https://vercel.com/login";
  if (prov === "cloudflare") return "https://dash.cloudflare.com/login";
  return "https://github.com/login";
}
async function openUrl2(url) {
  try {
    const u = url;
    const cmd = process.platform === "win32" ? `powershell -NoProfile -NonInteractive -Command Start-Process "${u}"` : process.platform === "darwin" ? `open "${u}"` : `xdg-open "${u}"`;
    const res = await runWithTimeout({ cmd }, 5e3);
    return res.ok;
  } catch {
    return false;
  }
}
function registerUpCommand(program) {
  const ajv = new import_ajv7.default({ allErrors: true, strict: false, validateSchema: false });
  const validate = ajv.compile(upSummarySchema);
  const validateBuild = ajv.compile(providerBuildResultSchema);
  const validateDeploy = ajv.compile(providerDeployResultSchema);
  const annotate = (obj) => {
    const ok = validate(obj);
    const errs = Array.isArray(validate.errors) ? validate.errors.map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim()) : [];
    if (process.env.OPD_SCHEMA_STRICT === "1" && errs.length > 0) {
      process.exitCode = 1;
    }
    return { ...obj, schemaOk: ok, schemaErrors: errs };
  };
  program.command("up").description("Deploy to preview with safe defaults (env sync + deploy)").argument("[provider]", "Target provider: vercel | cloudflare | github").option("--env <env>", "Environment: prod | preview", "preview").option("--path <dir>", "Path to app directory (for monorepos)").option("--json", "Output JSON result").option("--ci", "CI mode (non-interactive)").option("--dry-run", "Do not execute actual deployment").option("--sync-env", "Sync environment from local .env before deploy").option("--alias <domain>", "After deploy, assign this alias to the deployment (vercel only)").option("--project <id>", "Provider project/site ID").option("--org <id>", "Provider org/team ID (Vercel)").option("--print-cmd", "Print underlying provider commands that will be executed").option("--retries <n>", "Retries for provider commands (default 2)").option("--timeout-ms <ms>", "Timeout per provider command in milliseconds (default 120000)").option("--base-delay-ms <ms>", "Base delay for exponential backoff with jitter (default 300)").option("--ndjson", "Output NDJSON events for progress").option("--no-build", "Skip local build; deploy existing publish directory (when supported)").option("--preflight-only", "Run preflight checks and exit without building/publishing (GitHub Pages)").option("--strict-preflight", "Treat preflight warnings as errors (GitHub/Cloudflare)").option("--preflight-artifacts-only", "Run provider build and asset sanity, then exit without deploying (Cloudflare/GitHub)").option("--fix-preflight", "Apply safe preflight fixes (e.g., ensure .nojekyll for GitHub Pages)").action(async (provider, opts) => {
    const rootCwd = process.cwd();
    const targetCwd = opts.path ? (0, import_node_path37.isAbsolute)(opts.path) ? opts.path : (0, import_node_path37.join)(rootCwd, opts.path) : rootCwd;
    try {
      const jsonQuick = isJsonMode(opts.json);
      if (provider === "cloudflare" && (opts.preflightOnly === true || opts.strictPreflight === true)) {
        const preflight2 = [];
        let warned = false;
        try {
          const candidates = ["next.config.ts", "next.config.js", "next.config.mjs"];
          let cfg = "";
          for (const f of candidates) {
            const pth = (0, import_node_path37.join)(targetCwd, f);
            if (await fsx.exists(pth)) {
              cfg = await (0, import_promises23.readFile)(pth, "utf8");
              break;
            }
          }
          if (cfg.length > 0) {
            if (/output\s*:\s*['"]export['"]/m.test(cfg)) {
              preflight2.push({ name: "cloudflare: next.config output export omitted", ok: false, level: "warn", message: 'remove output: "export"' });
              warned = true;
            }
            if (/assetPrefix\s*:\s*['"][^'\"]+['"]/m.test(cfg)) {
              preflight2.push({ name: "cloudflare: assetPrefix absent", ok: false, level: "warn", message: "remove assetPrefix" });
              warned = true;
            }
            const m = cfg.match(/basePath\s*:\s*['"]([^'\"]*)['"]/m);
            if (m && m[1] && m[1] !== "") {
              preflight2.push({ name: "cloudflare: basePath empty", ok: false, level: "warn", message: 'set basePath to ""' });
              warned = true;
            }
            if (/trailingSlash\s*:\s*true/m.test(cfg)) {
              preflight2.push({ name: "cloudflare: trailingSlash recommended false", ok: true, level: "note", message: "set trailingSlash: false" });
            }
          }
        } catch {
        }
        try {
          const wranglerPath = (0, import_node_path37.join)(targetCwd, "wrangler.toml");
          if (await fsx.exists(wranglerPath)) {
            const raw = await (0, import_promises23.readFile)(wranglerPath, "utf8");
            if (!/pages_build_output_dir\s*=\s*"\.vercel\/output\/static"/m.test(raw)) {
              preflight2.push({ name: "cloudflare: wrangler pages_build_output_dir", ok: false, level: "warn", message: "set to .vercel/output/static" });
              warned = true;
            }
            if (!/pages_functions_directory\s*=\s*"\.vercel\/output\/functions"/m.test(raw)) {
              preflight2.push({ name: "cloudflare: wrangler pages_functions_directory", ok: true, level: "note", message: "set to .vercel/output/functions" });
            }
            if (!/compatibility_flags\s*=\s*\[.*"nodejs_compat".*\]/m.test(raw)) {
              preflight2.push({ name: "cloudflare: wrangler nodejs_compat flag", ok: true, level: "note", message: 'add compatibility_flags = ["nodejs_compat"]' });
            }
          } else {
            preflight2.push({ name: "cloudflare: wrangler.toml present", ok: false, level: "warn", message: "missing wrangler.toml" });
            warned = true;
          }
        } catch {
        }
        const targetShort = opts.env === "prod" ? "prod" : "preview";
        if (opts.strictPreflight && warned) {
          if (jsonQuick) {
            logger.jsonPrint({ ok: false, action: "up", provider: "cloudflare", target: targetShort, message: "Preflight failed (strict): resolve Next.js Cloudflare Pages warnings.", preflightOnly: true, preflight: preflight2, final: true });
            process.exit(1);
          }
          throw new Error("Preflight failed (strict): resolve Next.js Cloudflare Pages warnings.");
        }
        if (opts.preflightOnly) {
          if (jsonQuick) {
            logger.jsonPrint({ ok: true, action: "up", provider: "cloudflare", target: targetShort, preflightOnly: true, preflight: preflight2, final: true });
            process.exit(0);
          }
          logger.success("Preflight checks completed (Cloudflare Pages). No build/publish performed.");
          return;
        }
      }
      const jsonMode = isJsonMode(opts.json);
      const ndjsonOn = opts.ndjson === true || process.env.OPD_NDJSON === "1";
      if (ndjsonOn) logger.setNdjson(true);
      const preflight = [];
      if (jsonMode) logger.setJsonOnly(true);
      if (jsonMode || ndjsonOn || opts.ci === true) process.env.OPD_FORCE_CI = "1";
      if (opts.retries) process.env.OPD_RETRIES = String(Math.max(0, Number(opts.retries) || 0));
      if (opts.timeoutMs) process.env.OPD_TIMEOUT_MS = String(Math.max(0, Number(opts.timeoutMs) || 0));
      if (opts.baseDelayMs) process.env.OPD_BASE_DELAY_MS = String(Math.max(0, Number(opts.baseDelayMs) || 0));
      if (!provider) {
        await runStartWizard({ provider: void 0, env: opts.env === "prod" ? "prod" : "preview", path: opts.path, project: opts.project, org: opts.org, syncEnv: Boolean(opts.syncEnv), json: Boolean(opts.json), ci: Boolean(opts.ci), dryRun: Boolean(opts.dryRun) });
        return;
      }
      process.env.OPD_SYNC_ENV = "1";
      if (process.env.OPD_LEGACY !== "1") {
        const allowed = ["vercel", "cloudflare", "github"];
        if (provider && provider.toLowerCase() === "netlify") {
          const msg = "Netlify is not supported by OpenDeploy. Please use the official Netlify CLI.";
          if (jsonMode) {
            logger.jsonPrint({ ok: false, action: "up", provider: "netlify", message: msg, final: true });
            return;
          }
          throw new Error(msg);
        }
        const prov = provider && allowed.includes(provider) ? provider : "vercel";
        const envTargetUp = opts.env === "prod" ? "production" : "preview";
        if (prov === "cloudflare" && (opts.preflightOnly === true || opts.strictPreflight === true)) {
          try {
            const preflight2 = [];
            let warned = false;
            let hasNextConfig2 = false;
            try {
              const cands = ["next.config.ts", "next.config.js", "next.config.mjs"];
              for (const f of cands) {
                if (await fsx.exists((0, import_node_path37.join)(targetCwd, f))) {
                  hasNextConfig2 = true;
                  break;
                }
              }
            } catch {
            }
            if (hasNextConfig2) {
              try {
                let cfg = "";
                const candidates = ["next.config.ts", "next.config.js", "next.config.mjs"];
                for (const f of candidates) {
                  const pth = (0, import_node_path37.join)(targetCwd, f);
                  if (await fsx.exists(pth)) {
                    cfg = await (0, import_promises23.readFile)(pth, "utf8");
                    break;
                  }
                }
                if (cfg.length > 0) {
                  const hasOutputExport = /output\s*:\s*['"]export['"]/m.test(cfg);
                  if (hasOutputExport) {
                    preflight2.push({ name: "cloudflare: next.config output export omitted", ok: false, level: "warn", message: 'remove output: "export"' });
                    warned = true;
                  }
                  const hasAssetPrefix = /assetPrefix\s*:\s*['"][^'\"]+['"]/m.test(cfg);
                  if (hasAssetPrefix) {
                    preflight2.push({ name: "cloudflare: assetPrefix absent", ok: false, level: "warn", message: "remove assetPrefix" });
                    warned = true;
                  }
                  const basePathMatch = cfg.match(/basePath\s*:\s*['"]([^'\"]*)['"]/m);
                  if (basePathMatch && basePathMatch[1] && basePathMatch[1] !== "") {
                    preflight2.push({ name: "cloudflare: basePath empty", ok: false, level: "warn", message: 'set basePath to ""' });
                    warned = true;
                  }
                  const trailingTrue = /trailingSlash\s*:\s*true/m.test(cfg);
                  if (trailingTrue) {
                    preflight2.push({ name: "cloudflare: trailingSlash recommended false", ok: true, level: "note", message: "set trailingSlash: false" });
                  }
                }
              } catch {
              }
            }
            try {
              const wranglerPath = (0, import_node_path37.join)(targetCwd, "wrangler.toml");
              if (await fsx.exists(wranglerPath)) {
                const raw = await (0, import_promises23.readFile)(wranglerPath, "utf8");
                if (!/pages_build_output_dir\s*=\s*"\.vercel\/output\/static"/m.test(raw)) {
                  preflight2.push({ name: "cloudflare: wrangler pages_build_output_dir", ok: false, level: "warn", message: "set to .vercel/output/static" });
                  warned = true;
                }
                if (!/pages_functions_directory\s*=\s*"\.vercel\/output\/functions"/m.test(raw)) {
                  preflight2.push({ name: "cloudflare: wrangler pages_functions_directory", ok: true, level: "note", message: "set to .vercel/output/functions" });
                }
                if (!/compatibility_flags\s*=\s*\[.*"nodejs_compat".*\]/m.test(raw)) {
                  preflight2.push({ name: "cloudflare: wrangler nodejs_compat flag", ok: true, level: "note", message: 'add compatibility_flags = ["nodejs_compat"]' });
                }
              } else {
                preflight2.push({ name: "cloudflare: wrangler.toml present", ok: false, level: "warn", message: "missing wrangler.toml" });
                warned = true;
              }
            } catch {
            }
            const targetShort2 = envTargetUp === "production" ? "prod" : "preview";
            if (opts.strictPreflight && warned) {
              if (jsonMode) {
                logger.jsonPrint({ ok: false, action: "up", provider: "cloudflare", target: targetShort2, message: "Preflight failed (strict): resolve Next.js Cloudflare Pages warnings.", preflightOnly: true, preflight: preflight2, final: true });
                process.exit(1);
              }
              throw new Error("Preflight failed (strict): resolve Next.js Cloudflare Pages warnings.");
            }
            if (opts.preflightOnly) {
              if (jsonMode) {
                logger.jsonPrint({ ok: true, action: "up", provider: "cloudflare", target: targetShort2, preflightOnly: true, preflight: preflight2, final: true });
                process.exit(0);
              }
              logger.success("Preflight checks completed (Cloudflare Pages). No build/publish performed.");
              return;
            }
          } catch (e) {
            throw e;
          }
        }
        if (opts.dryRun === true) {
          const envShort = opts.env === "prod" ? "prod" : "preview";
          if (jsonMode) {
            const cmdPlan = [];
            if (prov === "vercel") {
              if (opts.project || opts.org) cmdPlan.push(`vercel link --yes${opts.project ? ` --project ${opts.project}` : ""}${opts.org ? ` --org ${opts.org}` : ""}`.trim());
              cmdPlan.push(envTargetUp === "production" ? "vercel deploy --prod --yes" : "vercel deploy --yes");
              if (opts.alias) cmdPlan.push(`vercel alias set <deployment-url> ${opts.alias}`);
            } else if (prov === "cloudflare") {
              try {
                const det = await detectApp({ cwd: targetCwd });
                const fw = det.framework;
                let dir = det.publishDir;
                if (!dir) {
                  if (fw === "astro") dir = "dist";
                  else if (fw === "sveltekit") dir = "build";
                  else if (fw === "next") dir = "out";
                  else dir = "dist";
                }
                if (fw === "next") {
                  cmdPlan.push("# Next.js on Cloudflare Pages requires static export or next-on-pages (SSR). Consider Vercel for hybrid/SSR.");
                }
                cmdPlan.push(`wrangler pages deploy ${dir}`.trim());
              } catch {
                cmdPlan.push("wrangler pages deploy dist");
              }
            } else if (prov === "github") {
              try {
                const det = await detectApp({ cwd: targetCwd });
                const fw = det.framework;
                if (fw === "astro") {
                  cmdPlan.push("gh-pages -d dist");
                } else if (fw === "sveltekit") {
                  cmdPlan.push("gh-pages -d build");
                } else if (fw === "next") {
                  cmdPlan.push('# Next.js on GitHub Pages requires static export (next.config.js: output: "export").');
                  cmdPlan.push("next build && gh-pages -d out");
                } else {
                  const dir = det.publishDir ?? "dist";
                  cmdPlan.push(`gh-pages -d ${dir}`);
                }
              } catch {
                cmdPlan.push("gh-pages -d dist");
              }
            }
            logger.jsonPrint(annotate({ ok: true, action: "up", provider: prov, target: envShort, mode: "dry-run", cmdPlan, final: true }));
            return;
          }
          logger.info(`[dry-run] up ${prov} (env=${envShort})`);
          return;
        }
        const p = await loadProvider(prov);
        if (process.env.OPD_SKIP_VALIDATE !== "1") {
          try {
            await p.validateAuth(targetCwd);
          } catch {
            if (opts.ci) throw new Error(`${prov} login required`);
            const cmd = prov === "vercel" ? "vercel login" : prov === "cloudflare" ? "wrangler login" : "git remote -v";
            logger.section("Auth");
            logger.note(`Running: ${cmd}`);
            const res = await proc.run({ cmd, cwd: targetCwd });
            let revalidated = false;
            if (res.ok) {
              try {
                await p.validateAuth(targetCwd);
                revalidated = true;
              } catch {
              }
            }
            if (!revalidated) {
              const url = providerLoginUrl2(prov);
              logger.note(`Opening provider login page: ${url}`);
              try {
                await openUrl2(url);
              } catch {
              }
              try {
                await p.validateAuth(targetCwd);
                revalidated = true;
              } catch {
              }
            }
            if (!revalidated) throw new Error(`${prov} login failed`);
          }
        }
        const wantSync2 = opts.syncEnv === true || process.env.OPD_SYNC_ENV === "1";
        if (wantSync2 && prov === "vercel") {
          const candidates = envTargetUp === "production" ? [".env.production.local", ".env"] : [".env", ".env.local"];
          let chosenFile;
          for (const f of candidates) {
            if (await fsx.exists((0, import_node_path37.join)(targetCwd, f))) {
              chosenFile = f;
              break;
            }
          }
          if (chosenFile) {
            logger.section("Environment");
            logger.note(`Syncing ${chosenFile} \u2192 ${prov}`);
            try {
              try {
                const patterns = await computeRedactors({ cwd: targetCwd, envFiles: [chosenFile], includeProcessEnv: true });
                if (patterns.length > 0) logger.setRedactors(patterns);
              } catch {
              }
              await envSync({ provider: prov, cwd: targetCwd, file: chosenFile, env: opts.env === "prod" ? "prod" : "preview", yes: true, ci: Boolean(opts.ci), json: false, projectId: opts.project, orgId: opts.org, ignore: [], only: [], optimizeWrites: true });
              logger.success("Environment sync complete");
            } catch (e) {
              logger.warn(`Env sync skipped: ${e.message}`);
            }
          }
        }
        const linked = await p.link(targetCwd, { projectId: opts.project, orgId: opts.org });
        let publishDirHint;
        let frameworkHint;
        try {
          const d = await p.detect(targetCwd);
          publishDirHint = d.publishDir;
          frameworkHint = d.framework;
        } catch {
        }
        if (!frameworkHint) {
          try {
            const d2 = await detectApp({ cwd: targetCwd });
            publishDirHint = publishDirHint ?? d2.publishDir;
            frameworkHint = d2.framework;
          } catch {
          }
        }
        let hasNextConfig = false;
        try {
          const cands = ["next.config.ts", "next.config.js", "next.config.mjs"];
          for (const f of cands) {
            if (await fsx.exists((0, import_node_path37.join)(targetCwd, f))) {
              hasNextConfig = true;
              break;
            }
          }
        } catch {
        }
        if (prov === "github" && ((frameworkHint || "").toLowerCase() === "next" || hasNextConfig)) {
          try {
            let warned = false;
            let repo;
            let repoSource = "unknown";
            const ghEnv = process.env.GITHUB_REPOSITORY;
            if (ghEnv && ghEnv.includes("/")) {
              repo = ghEnv.split("/")[1];
              if (repo) repoSource = "env";
            }
            if (!repo) {
              try {
                const origin = await proc.run({ cmd: "git remote get-url origin", cwd: targetCwd });
                if (origin.ok) {
                  const t = origin.stdout.trim();
                  const httpsRe = /^https?:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/i;
                  const sshRe = /^git@github\.com:(.+?)\/(.+?)(?:\.git)?$/i;
                  const m1 = t.match(httpsRe);
                  const m2 = t.match(sshRe);
                  const r = (m1?.[2] || m2?.[2] || "").trim();
                  if (r) {
                    repo = r;
                    repoSource = "origin";
                  }
                }
              } catch {
              }
            }
            let cfg = "";
            const candidates = ["next.config.ts", "next.config.js", "next.config.mjs"];
            for (const f of candidates) {
              const pth = (0, import_node_path37.join)(targetCwd, f);
              if (await fsx.exists(pth)) {
                cfg = await (0, import_promises23.readFile)(pth, "utf8");
                break;
              }
            }
            const needsExport = cfg.length > 0 ? !/output\s*:\s*['"]export['"]/m.test(cfg) : true;
            if (needsExport) {
              logger.warn("Next.js \u2192 GitHub Pages: set next.config output: 'export' for static export.");
              preflight.push({ name: "github: next.config output 'export'", ok: false, level: "warn", message: "set output: 'export'" });
              warned = true;
            }
            const unoptOk = cfg.length > 0 ? /images\s*:\s*\{[^}]*unoptimized\s*:\s*true/m.test(cfg) : false;
            if (!unoptOk) {
              logger.warn("Next.js \u2192 GitHub Pages: set images.unoptimized: true to avoid runtime optimization.");
              preflight.push({ name: "github: images.unoptimized true", ok: false, level: "warn", message: "set images.unoptimized: true" });
              warned = true;
            }
            const trailingOk = cfg.length > 0 ? /trailingSlash\s*:\s*true/m.test(cfg) : false;
            if (!trailingOk) {
              logger.note("Next.js \u2192 GitHub Pages: trailingSlash: true is recommended for static hosting.");
              preflight.push({ name: "github: trailingSlash recommended", ok: true, level: "note", message: "set trailingSlash: true" });
            }
            const basePathCfgMatch = cfg.match(/basePath\s*:\s*['"]([^'\"]*)['"]/m);
            const assetPrefixCfgMatch = cfg.match(/assetPrefix\s*:\s*['"]([^'\"]*)['"]/m);
            if (repo) {
              const repoPath = `/${repo}`;
              const baseMatch = cfg.length > 0 ? new RegExp(`basePath\\s*:\\s*['"]${repoPath}['"]`, "m").test(cfg) : false;
              if (!baseMatch) {
                logger.warn(`Next.js \u2192 GitHub Pages: set basePath to '${repoPath}'.`);
                preflight.push({ name: "github: basePath matches repo", ok: false, level: "warn", message: `expected basePath '${repoPath}', detected '${basePathCfgMatch?.[1] ?? ""}' (source=${repoSource})` });
                warned = true;
              } else {
                preflight.push({ name: "github: basePath matches repo", ok: true, level: "note", message: `basePath OK ('${repoPath}', source=${repoSource})` });
              }
              const assetPresent = cfg.length > 0 ? /assetPrefix\s*:\s*['"][^'\"]+['"]/m.test(cfg) : false;
              const assetMatch = cfg.length > 0 ? new RegExp(`assetPrefix\\s*:\\s*['"]${repoPath}/['"]`, "m").test(cfg) : false;
              if (!assetPresent || !assetMatch) {
                logger.note(`Next.js \u2192 GitHub Pages: set assetPrefix to '${repoPath}/' (recommended).`);
                preflight.push({ name: "github: assetPrefix recommended", ok: true, level: "note", message: `expected assetPrefix '${repoPath}/', detected '${assetPrefixCfgMatch?.[1] ?? ""}' (source=${repoSource})` });
              } else {
                preflight.push({ name: "github: assetPrefix recommended", ok: true, level: "note", message: `assetPrefix OK ('${repoPath}/', source=${repoSource})` });
              }
            } else {
              logger.note("Next.js \u2192 GitHub Pages: could not derive repo name; set DEPLOY_REPO or ensure origin remote is GitHub.");
              preflight.push({ name: "github: derive repo name", ok: true, level: "note", message: `cannot derive repo (source=${repoSource}, basePath='${basePathCfgMatch?.[1] ?? ""}', assetPrefix='${assetPrefixCfgMatch?.[1] ?? ""}')` });
            }
            if (opts.strictPreflight && warned) {
              const targetShort2 = envTargetUp === "production" ? "prod" : "preview";
              const message = "Preflight failed (strict): resolve Next.js GitHub Pages warnings.";
              if (jsonMode) {
                logger.jsonPrint({ ok: false, action: "up", provider: "github", target: targetShort2, message, preflightOnly: true, preflight, final: true });
                throw new Error(message);
              }
              throw new Error(message);
            }
            if (opts.preflightOnly === true) {
              const targetShort2 = envTargetUp === "production" ? "prod" : "preview";
              if (jsonMode) {
                logger.jsonPrint({ ok: true, action: "up", provider: "github", target: targetShort2, preflightOnly: true, preflight, final: true });
                return;
              }
              logger.success("Preflight checks completed (GitHub Pages). No build/publish performed.");
              return;
            }
          } catch {
          }
        }
        if (prov === "cloudflare" && ((frameworkHint || "").toLowerCase() === "next" || hasNextConfig)) {
          try {
            let warned = false;
            let cfg = "";
            const candidates = ["next.config.ts", "next.config.js", "next.config.mjs"];
            for (const f of candidates) {
              const pth = (0, import_node_path37.join)(targetCwd, f);
              if (await fsx.exists(pth)) {
                cfg = await (0, import_promises23.readFile)(pth, "utf8");
                break;
              }
            }
            if (cfg.length > 0) {
              const hasOutputExport = /output\s*:\s*['"]export['"]/m.test(cfg);
              if (hasOutputExport) {
                logger.note('Next.js \u2192 Cloudflare Pages: omit output: "export" when using Next on Pages (SSR/hybrid).');
                preflight.push({ name: "cloudflare: next.config output export omitted", ok: false, level: "warn", message: 'remove output: "export"' });
                warned = true;
              }
              const hasAssetPrefix = /assetPrefix\s*:\s*['"][^'\"]+['"]/m.test(cfg);
              if (hasAssetPrefix) {
                logger.warn("Next.js \u2192 Cloudflare Pages: remove assetPrefix; serve at root for Next on Pages.");
                preflight.push({ name: "cloudflare: assetPrefix absent", ok: false, level: "warn", message: "remove assetPrefix" });
                warned = true;
              }
              const basePathMatch = cfg.match(/basePath\s*:\s*['"]([^'\"]*)['"]/m);
              if (basePathMatch && basePathMatch[1] && basePathMatch[1] !== "") {
                logger.warn("Next.js \u2192 Cloudflare Pages: basePath should be empty for Next on Pages.");
                preflight.push({ name: "cloudflare: basePath empty", ok: false, level: "warn", message: 'set basePath to ""' });
                warned = true;
              }
              const trailingTrue = /trailingSlash\s*:\s*true/m.test(cfg);
              if (trailingTrue) {
                logger.note("Next.js \u2192 Cloudflare Pages: trailingSlash: false is recommended.");
                preflight.push({ name: "cloudflare: trailingSlash recommended false", ok: true, level: "note", message: "set trailingSlash: false" });
              }
            }
            const wranglerPath = (0, import_node_path37.join)(targetCwd, "wrangler.toml");
            if (await fsx.exists(wranglerPath)) {
              const raw = await (0, import_promises23.readFile)(wranglerPath, "utf8");
              if (!/pages_build_output_dir\s*=\s*"\.vercel\/output\/static"/m.test(raw)) {
                logger.warn('Cloudflare Pages: set pages_build_output_dir = ".vercel/output/static".');
                preflight.push({ name: "cloudflare: wrangler pages_build_output_dir", ok: false, level: "warn", message: "set to .vercel/output/static" });
                warned = true;
              }
              if (!/pages_functions_directory\s*=\s*"\.vercel\/output\/functions"/m.test(raw)) {
                logger.note('Cloudflare Pages: set pages_functions_directory = ".vercel/output/functions".');
                preflight.push({ name: "cloudflare: wrangler pages_functions_directory", ok: true, level: "note", message: "set to .vercel/output/functions" });
              }
              if (!/compatibility_flags\s*=\s*\[.*"nodejs_compat".*\]/m.test(raw)) {
                logger.note('Cloudflare Pages: add compatibility_flags = ["nodejs_compat"].');
                preflight.push({ name: "cloudflare: wrangler nodejs_compat flag", ok: true, level: "note", message: 'add compatibility_flags = ["nodejs_compat"]' });
              }
            } else {
              logger.note("Cloudflare Pages: missing wrangler.toml (generate with: opd generate cloudflare --next-on-pages).");
              preflight.push({ name: "cloudflare: wrangler.toml present", ok: false, level: "warn", message: "missing wrangler.toml" });
            }
            if (process.platform === "win32") {
              logger.note("Tip: Next on Pages is more reliable in CI/Linux or WSL. Consider using the provided GitHub Actions workflow.");
              preflight.push({ name: "cloudflare: windows guidance", ok: true, level: "note", message: "prefer CI/Linux or WSL" });
            }
            if (opts.strictPreflight && warned) {
              const targetShort2 = envTargetUp === "production" ? "prod" : "preview";
              const message = "Preflight failed (strict): resolve Next.js Cloudflare Pages warnings.";
              if (jsonMode) {
                logger.jsonPrint({ ok: false, action: "up", provider: "cloudflare", target: targetShort2, message, preflightOnly: true, preflight, final: true });
                throw new Error(message);
              }
              throw new Error(message);
            }
            if (opts.preflightOnly === true) {
              const targetShort2 = envTargetUp === "production" ? "prod" : "preview";
              if (jsonMode) {
                logger.jsonPrint({ ok: true, action: "up", provider: "cloudflare", target: targetShort2, preflightOnly: true, preflight, final: true });
                return;
              }
              logger.success("Preflight checks completed (Cloudflare Pages). No build/publish performed.");
              return;
            }
          } catch {
          }
        }
        const t0 = Date.now();
        const buildRes = await p.build({ cwd: targetCwd, framework: frameworkHint, envTarget: envTargetUp, publishDirHint, noBuild: Boolean(opts.noBuild) });
        const buildSchemaOk = validateBuild(buildRes);
        const buildSchemaErrors = Array.isArray(validateBuild.errors) ? validateBuild.errors.map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim()) : [];
        if (!buildRes.ok) {
          const targetShort2 = envTargetUp === "production" ? "prod" : "preview";
          const message = buildRes.message || "Build failed";
          if (jsonMode) {
            logger.jsonPrint(annotate({ ok: false, action: "up", provider: prov, target: targetShort2, message, preflight, buildSchemaOk, buildSchemaErrors, final: true }));
            process.exit(1);
          }
          throw new Error(message);
        }
        if (prov === "github" && opts.noBuild === true) {
          try {
            const exists2 = await fsx.exists(buildRes.artifactDir);
            if (!exists2) {
              const targetShort2 = envTargetUp === "production" ? "prod" : "preview";
              const hint = frameworkHint && frameworkHint.toLowerCase() === "next" ? "Run: pnpm -C apps/docs run build && pnpm -C apps/docs exec next export (creates out)" : "Build your site locally to produce the publish directory (e.g., dist)";
              const message = `Publish directory not found: ${buildRes.artifactDir}. ${hint}`;
              if (jsonMode) {
                logger.jsonPrint(annotate({ ok: false, action: "up", provider: "github", target: targetShort2, message, preflight, buildSchemaOk, buildSchemaErrors, final: true }));
                process.exit(1);
              }
              throw new Error(message);
            }
          } catch {
          }
        }
        const skipAssetSanity = process.env.OPD_SKIP_ASSET_SANITY === "1";
        try {
          const fwLower = (frameworkHint || "").toLowerCase();
          if (!skipAssetSanity && fwLower === "next" && typeof buildRes.artifactDir === "string" && buildRes.artifactDir.length > 0) {
            const assetsDir = (0, import_node_path37.join)(buildRes.artifactDir, "_next", "static");
            const exists2 = await fsx.exists(assetsDir);
            if (!exists2) {
              const expected = prov === "cloudflare" ? ".vercel/output/static/_next/static" : "out/_next/static";
              const why = `Asset check failed: ${expected} missing in artifactDir=${buildRes.artifactDir}. Ensure the build produced Next static assets.`;
              throw new Error(why);
            }
          }
        } catch (e) {
          const targetShort2 = envTargetUp === "production" ? "prod" : "preview";
          const message = e.message;
          if (jsonMode) {
            logger.jsonPrint(annotate({ ok: false, action: "up", provider: prov, target: targetShort2, message, preflight, buildSchemaOk, buildSchemaErrors, final: true }));
            return;
          }
          throw e;
        }
        if (opts.preflightArtifactsOnly === true) {
          const targetShort2 = envTargetUp === "production" ? "prod" : "preview";
          if (jsonMode) {
            logger.jsonPrint(annotate({ ok: true, action: "up", provider: prov, target: targetShort2, preflightArtifactsOnly: true, artifactDir: buildRes.artifactDir, preflight, final: true }));
            return;
          }
          logger.success("Artifact preflight completed. No deploy performed.");
          return;
        }
        if (prov === "github" && opts.fixPreflight === true && typeof buildRes.artifactDir === "string" && buildRes.artifactDir.length > 0) {
          try {
            const marker = (0, import_node_path37.join)(buildRes.artifactDir, ".nojekyll");
            const exists2 = await fsx.exists(marker);
            if (!exists2) {
              await (await import("fs/promises")).writeFile(marker, "", "utf8");
              preflight.push({ name: "github: .nojekyll ensured", ok: true, level: "note", message: `written: ${marker}` });
            } else {
              preflight.push({ name: "github: .nojekyll ensured", ok: true, level: "note", message: "present" });
            }
          } catch {
          }
        }
        const deployRes = await p.deploy({ cwd: targetCwd, envTarget: envTargetUp, project: linked, artifactDir: buildRes.artifactDir, alias: opts.alias });
        const deploySchemaOk = validateDeploy(deployRes);
        const deploySchemaErrors = Array.isArray(validateDeploy.errors) ? validateDeploy.errors.map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim()) : [];
        const durationMs = Date.now() - t0;
        const targetShort = envTargetUp === "production" ? "prod" : "preview";
        if (jsonMode && !deployRes.ok) {
          const message = deployRes.message || "Deploy failed";
          logger.jsonPrint(annotate({ ok: false, action: "up", provider: prov, target: targetShort, message, url: deployRes.url, logsUrl: deployRes.logsUrl, preflight, buildSchemaOk, buildSchemaErrors, deploySchemaOk, deploySchemaErrors, final: true }));
          return;
        }
        if (jsonMode) {
          logger.jsonPrint(annotate({ ok: true, action: "up", provider: prov, target: targetShort, url: deployRes.url, logsUrl: deployRes.logsUrl, durationMs, preflight, buildSchemaOk, buildSchemaErrors, deploySchemaOk, deploySchemaErrors, final: true }));
          return;
        }
        if (deployRes.ok) {
          if (deployRes.url) logger.success(`${opts.env === "prod" ? "Production" : "Preview"}: ${deployRes.url}`);
          else logger.success(`${opts.env === "prod" ? "Production" : "Preview"} deploy complete`);
        } else {
          const message = deployRes.message || "Deploy failed";
          if (deployRes.logsUrl) logger.info(`Logs: ${deployRes.logsUrl}`);
          throw new Error(message);
        }
        return;
      }
      const envTarget = opts.env === "prod" ? "prod" : "preview";
      if (opts.dryRun === true) {
        if (jsonMode) {
          const prov = "vercel";
          const cmdPlan = [];
          if (opts.project || opts.org) cmdPlan.push(`vercel link --yes${opts.project ? ` --project ${opts.project}` : ""}${opts.org ? ` --org ${opts.org}` : ""}`.trim());
          cmdPlan.push(envTarget === "prod" ? "vercel deploy --prod --yes" : "vercel deploy --yes");
          if (opts.alias) cmdPlan.push(`vercel alias set <deployment-url> ${opts.alias}`);
          const summary = { ok: true, action: "up", provider: prov, target: envTarget, mode: "dry-run", cmdPlan, final: true };
          logger.jsonPrint(annotate(summary));
        } else {
          logger.info(`[dry-run] up ${provider} (env=${envTarget})`);
        }
        return;
      }
      const wantSync = opts.syncEnv === true || process.env.OPD_SYNC_ENV === "1";
      if (wantSync && provider === "vercel") {
        const candidates = envTarget === "prod" ? [".env.production.local", ".env"] : [".env", ".env.local"];
        let chosenFile;
        for (const f of candidates) {
          if (await fsx.exists((0, import_node_path37.join)(targetCwd, f))) {
            chosenFile = f;
            break;
          }
        }
        if (chosenFile) {
          logger.section("Environment");
          logger.note(`Syncing ${chosenFile} \u2192 ${provider}`);
          if (ndjsonOn) logger.json({ ok: true, action: "up", stage: "envSyncStart", provider, target: envTarget, file: chosenFile });
          try {
            try {
              const patterns = await computeRedactors({ cwd: targetCwd, envFiles: [chosenFile], includeProcessEnv: true });
              if (patterns.length > 0) logger.setRedactors(patterns);
            } catch {
            }
            await envSync({ provider: "vercel", cwd: targetCwd, file: chosenFile, env: envTarget, yes: true, ci: Boolean(opts.ci), json: false, projectId: opts.project, orgId: opts.org, ignore: [], only: [], optimizeWrites: true });
            logger.success("Environment sync complete");
            if (ndjsonOn) logger.json({ ok: true, action: "up", stage: "envSyncDone", provider, target: envTarget });
          } catch (e) {
            logger.warn(`Env sync skipped: ${e.message}`);
          }
        } else {
          logger.note("No local .env file found to sync");
        }
      }
      if (provider === "vercel") {
        const targetLink = (0, import_node_path37.join)(targetCwd, ".vercel", "project.json");
        const rootLink = (0, import_node_path37.join)(rootCwd, ".vercel", "project.json");
        const targetIsLinked = await fsx.exists(targetLink);
        const rootIsLinked = await fsx.exists(rootLink);
        const runCwd = targetIsLinked ? targetCwd : rootIsLinked && !targetIsLinked ? rootCwd : targetCwd;
        if (runCwd !== targetCwd) logger.info(`Using linked directory for Vercel deploy: ${runCwd}`);
        if ((opts.project || opts.org) && !await fsx.exists((0, import_node_path37.join)(runCwd, ".vercel", "project.json"))) {
          const flags = ["--yes"];
          if (opts.project) flags.push(`--project ${opts.project}`);
          if (opts.org) flags.push(`--org ${opts.org}`);
          if (opts.printCmd) logger.info(`$ vercel link ${flags.join(" ")}`);
          if (ndjsonOn) logger.json({ ok: true, action: "up", stage: "linking", provider: "vercel", cwd: runCwd, flags });
          await runWithRetry({ cmd: `vercel link ${flags.join(" ")}`, cwd: runCwd });
        }
        const sp = spinner(`Vercel: deploying (${envTarget === "prod" ? "production" : "preview"})`);
        const stop = startHeartbeat({ label: "vercel deploy", hint: "Tip: opendeploy open vercel", intervalMs: ndjsonOn ? 5e3 : 1e4 });
        let capturedUrl;
        let capturedInspect;
        const urlRe = /https?:\/\/[^\s]+vercel\.app/g;
        if (ndjsonOn) logger.json({ ok: true, action: "up", stage: "deployStart", provider: "vercel", target: envTarget });
        const deployTimeout = Number.isFinite(Number(process.env.OPD_TIMEOUT_MS)) ? Number(process.env.OPD_TIMEOUT_MS) : 9e5;
        const controller = proc.spawnStream({
          cmd: envTarget === "prod" ? "vercel deploy --prod --yes" : "vercel deploy --yes",
          cwd: runCwd,
          timeoutMs: deployTimeout,
          onStdout: (chunk) => {
            const m = chunk.match(urlRe);
            if (!capturedUrl && m && m.length > 0) {
              capturedUrl = m[0];
              if (ndjsonOn) logger.json({ ok: true, action: "up", stage: "url", provider: "vercel", url: capturedUrl });
            }
            if (process.env.OPD_JSON !== "1" && process.env.OPD_NDJSON !== "1") {
              const t = chunk.replace(/\s+$/, "");
              if (t.length > 0) logger.info(t);
            }
          },
          onStderr: (chunk) => {
            if (!capturedInspect) {
              const found = extractVercelInspectUrl(chunk);
              if (found) {
                capturedInspect = found;
                if (ndjsonOn) logger.json({ ok: true, action: "up", stage: "logsUrl", provider: "vercel", logsUrl: capturedInspect });
              }
            }
          }
        });
        const res = await controller.done;
        stop();
        sp.stop();
        if (!res.ok) throw new Error("Vercel deploy failed");
        if (!capturedInspect && capturedUrl) {
          try {
            const insp = await proc.run({ cmd: `vercel inspect ${capturedUrl}`, cwd: runCwd });
            const text = (insp.stdout || "") + "\n" + (insp.stderr || "");
            const found = extractVercelInspectUrl(text);
            if (found) capturedInspect = found;
          } catch {
          }
          if (!capturedInspect) capturedInspect = `https://vercel.com/inspect?url=${encodeURIComponent(capturedUrl)}`;
        }
        if (ndjsonOn) logger.json({ ok: true, action: "up", stage: "deployed", provider: "vercel", target: envTarget, url: capturedUrl, logsUrl: capturedInspect });
        let aliasUrl;
        if (capturedUrl && opts.alias) {
          const aliasCmd = `vercel alias set ${capturedUrl} ${opts.alias}`.trim();
          if (opts.printCmd) logger.info(`$ ${aliasCmd}`);
          const al = await runWithRetry({ cmd: aliasCmd, cwd: runCwd });
          if (al.ok) aliasUrl = `https://${opts.alias}`;
          if (ndjsonOn && aliasUrl) logger.json({ ok: true, action: "up", stage: "aliasSet", provider: "vercel", aliasUrl });
        }
        if (jsonMode) {
          logger.jsonPrint({ ok: true, action: "up", provider: "vercel", target: envTarget, url: capturedUrl, logsUrl: capturedInspect, aliasUrl, final: true });
          return;
        }
        if (capturedUrl) logger.success(`${envTarget === "prod" ? "Production" : "Preview"}: ${capturedUrl}`);
        if (aliasUrl) logger.success(`Aliased: ${aliasUrl}`);
        printDeploySummary({ provider: "vercel", target: envTarget, url: capturedUrl, logsUrl: capturedInspect });
        return;
      }
      logger.error(`Unknown provider: ${provider}`);
      process.exitCode = 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isJsonMode(opts.json)) {
        logger.jsonPrint({ ok: false, action: "up", provider, message: msg, final: true });
        throw new Error(msg);
      }
      logger.error(msg);
      process.exitCode = 1;
    }
  });
}

// src/commands/test-matrix.ts
var import_commander17 = require("commander");
init_logger();
init_process();
function volArg(cwd) {
  return `${cwd}:/workspace`;
}
async function runDockerNode(args) {
  const vol = volArg(args.cwd);
  const cmd = [
    "docker run --rm",
    `-e CI=1 -e FORCE_COLOR=0 -e TZ=UTC -e LC_ALL=C`,
    `-v "${vol}" -w /workspace`,
    args.image,
    "bash -lc",
    '"corepack enable && corepack prepare pnpm@10.13.1 --activate && pnpm install --frozen-lockfile && pnpm test -- --reporter=dot"'
  ].join(" ");
  logger.info(`$ ${cmd}`);
  const res = await proc.run({ cmd });
  if (!res.ok) logger.error(res.stderr || res.stdout || "docker run failed");
  return res.ok;
}
function registerTestMatrixCommand(program) {
  program.command("test-matrix").description("Run the test matrix locally (Node 18/20/22 in Docker; experimental OS parity)").option("--local", "Run locally using Docker if available").action(async (opts) => {
    const cwd = process.cwd();
    if (opts.local !== true) {
      logger.info("Use --local to run matrix locally. Remote CI matrix is configured in GitHub Actions.");
      return;
    }
    const hasDocker = await proc.has("docker");
    if (!hasDocker) {
      logger.warn("Docker not found. Running tests once on host instead.");
      const r = await proc.run({ cmd: "pnpm test -- --reporter=dot", cwd });
      if (!r.ok) process.exitCode = 1;
      return;
    }
    const ok18 = await runDockerNode({ image: "node:18", cwd });
    const ok20 = await runDockerNode({ image: "node:20", cwd });
    const ok22 = await runDockerNode({ image: "node:22", cwd });
    if (!(ok18 && ok20 && ok22)) process.exitCode = 1;
  });
}

// src/commands/ci-logs.ts
var import_commander18 = require("commander");
init_logger();
init_process();
var import_node_path38 = require("path");
var import_node_fs2 = require("fs");
function parseRepoFromGitUrl(url) {
  const https = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (https) return `${https[1]}/${https[2]}`;
  const ssh = url.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (ssh) return `${ssh[1]}/${ssh[2]}`;
  return void 0;
}
async function resolveRepo() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  try {
    const out = await proc.run({ cmd: "git remote get-url origin", cwd: process.cwd() });
    if (out.ok) return parseRepoFromGitUrl(out.stdout.trim());
  } catch {
  }
  return void 0;
}
async function resolveBranch() {
  const envRef = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME;
  if (envRef && envRef.trim().length > 0) return envRef.trim();
  const cur = await proc.run({ cmd: "git rev-parse --abbrev-ref HEAD", cwd: process.cwd() });
  const branch1 = cur.ok ? cur.stdout.trim() : void 0;
  if (branch1 && branch1 !== "HEAD") return branch1;
  const head = await proc.run({ cmd: "git symbolic-ref refs/remotes/origin/HEAD", cwd: process.cwd() });
  if (head.ok) {
    const m = head.stdout.trim().match(/origin\/(.+)$/);
    const b = m?.[1];
    if (b && b.length > 0) return b;
  }
  return "main";
}
async function ghExists() {
  const cmd = process.platform === "win32" ? "where gh" : "command -v gh";
  const out = await proc.run({ cmd });
  return out.ok && out.stdout.trim().length > 0;
}
async function getLatestRun(args) {
  const cmd = `gh run list --repo ${args.repo} ${args.branch ? `-b ${args.branch}` : ""} ${args.workflow ? `--workflow ${args.workflow}` : ""} -L 1 --json databaseId,status,conclusion,headBranch`;
  const res = await proc.run({ cmd, cwd: process.cwd() });
  if (!res.ok) return void 0;
  try {
    const arr = JSON.parse(res.stdout);
    const r = arr?.[0];
    if (!r || typeof r.databaseId !== "number") return void 0;
    return { id: r.databaseId, status: r.status, conclusion: r.conclusion, branch: r.headBranch };
  } catch {
    return void 0;
  }
}
function runUrl(repo, id) {
  return `https://github.com/${repo}/actions/runs/${id}`;
}
function emitAnnotation(kind, msg) {
  console.log(`::${kind} ::${msg}`);
}
async function ensureDir2(dir) {
  await import_node_fs2.promises.mkdir(dir, { recursive: true });
}
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}
async function getRunJobs(args) {
  const res = await proc.run({ cmd: `gh run view ${args.id} --repo ${args.repo} --json jobs`, cwd: process.cwd() });
  if (!res.ok) return [];
  try {
    const js = JSON.parse(res.stdout);
    const jobs = js.jobs ?? [];
    return jobs.filter((j) => typeof j.databaseId === "number").map((j) => ({ id: j.databaseId, name: sanitizeFilename(j.name ?? "job") }));
  } catch {
    return [];
  }
}
async function writeTextFile(path, data) {
  await ensureDir2(path.substring(0, path.lastIndexOf("/")) || ".");
  await import_node_fs2.promises.writeFile(path, data, "utf8");
}
function platformOpen(url) {
  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";
  if (isWin) {
    return proc.run({ cmd: `powershell -NoProfile -Command Start-Process "${url}"` }).then((r) => r.ok ? { ok: true } : proc.run({ cmd: `cmd /c start "" "${url}"` }).then((r2) => ({ ok: r2.ok })));
  }
  const cmd = isMac ? `open "${url}"` : `xdg-open "${url}"`;
  return proc.run({ cmd }).then((r) => ({ ok: r.ok }));
}
function registerCiLogsCommand(program) {
  const ci = program.command("ci").description("CI helpers");
  ci.command("logs").description("Show or follow GitHub Actions logs for the latest run on this branch (prints direct URLs)").option("--workflow <file>", "Workflow file name (e.g., ci.yml, pages.yml)", "ci.yml").option("--follow", "Follow the latest run until completion").option("--json", "Emit structured JSON summary").option("--pr <number>", "Scope to a given PR number (resolves head branch)").action(async (opts) => {
    const repo = await resolveRepo();
    if (!repo) {
      const msg = "Unable to resolve GitHub repo. Set GITHUB_REPOSITORY or add a git origin remote.";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-logs", message: msg, final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    const hasGh = await ghExists();
    if (!hasGh) {
      const msg = "GitHub CLI (gh) not found. Install via: winget install GitHub.cli";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-logs", repo, suggestion: "install gh", final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    let branch;
    if (opts.pr) {
      const prRes = await proc.run({ cmd: `gh pr view ${opts.pr} --repo ${repo} --json headRefName`, cwd: process.cwd() });
      if (prRes.ok) {
        try {
          const js = JSON.parse(prRes.stdout);
          if (js?.headRefName) branch = js.headRefName;
        } catch {
        }
      }
    }
    if (!branch) branch = await resolveBranch();
    const wf = String(opts.workflow || "ci.yml");
    const repoName = repo;
    if (opts.follow) {
      const first = await getLatestRun({ repo: repoName, branch, workflow: wf });
      if (first) logger.info(`Run: ${runUrl(repoName, first.id)}`);
      await proc.run({ cmd: `gh run watch --repo ${repoName} --exit-status --interval 5`, cwd: process.cwd() });
      const last = await getLatestRun({ repo: repoName, branch, workflow: wf });
      if (last) {
        const url2 = runUrl(repoName, last.id);
        const ok2 = (last.conclusion ?? "").toLowerCase() === "success";
        if (opts.json) logger.jsonPrint({ ok: ok2, action: "ci-logs", repo: repoName, branch, workflow: wf, id: last.id, url: url2, status: last.status, conclusion: last.conclusion, follow: true, final: true });
        else logger.info(`${ok2 ? "Success" : "Done"}: ${url2}`);
        if (!ok2) emitAnnotation("error", `CI run failed: ${url2}`);
        if (!ok2) process.exitCode = 1;
      } else {
        if (opts.json) logger.jsonPrint({ ok: false, action: "ci-logs", repo: repoName, branch, workflow: wf, message: "No runs found after watch", final: true });
        else logger.warn("No runs found after watch");
      }
      return;
    }
    const info = await getLatestRun({ repo: repoName, branch, workflow: wf });
    if (!info) {
      const msg = "No runs found (trigger a workflow first).";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-logs", repo, branch, workflow: wf, message: msg, final: true });
      else logger.warn(msg);
      return;
    }
    const url = runUrl(repoName, info.id);
    const ok = (info.conclusion ?? "").toLowerCase() !== "failure";
    if (opts.json) logger.jsonPrint({ ok, action: "ci-logs", repo, branch, workflow: wf, id: info.id, url, status: info.status, conclusion: info.conclusion, final: true });
    else logger.info(`${info.status ?? "status: unknown"} \u2014 ${url}`);
    if (!ok) emitAnnotation("error", `CI run failed: ${url}`);
    if (!ok) process.exitCode = 1;
  });
  ci.command("reproduce").description("Reproduce the CI build locally: applies Node/pnpm versions (Corepack), installs deps, builds, and runs tests").option("--snapshot <file>", "Path to CI snapshot JSON (default ./.artifacts/ci.snapshot.json)", ".artifacts/ci.snapshot.json").option("--tests <pattern>", "Optional test filter or extra args to pass to vitest (CLI package)").option("--json", "Emit structured JSON summary").action(async (opts) => {
    const snapPath = opts.snapshot && opts.snapshot.length > 0 ? opts.snapshot : ".artifacts/ci.snapshot.json";
    const abs = (0, import_node_path38.join)(process.cwd(), snapPath);
    let nodeVersion;
    let pnpmVersion;
    try {
      const raw = await import_node_fs2.promises.readFile(abs, "utf8");
      const js = JSON.parse(raw);
      const nodeObj = js?.node;
      const tools = js?.tools;
      if (typeof nodeObj?.version === "string" && nodeObj.version.length > 0) nodeVersion = String(nodeObj.version).replace(/^v/i, "");
      if (typeof tools?.pnpm === "string" && tools.pnpm.length > 0) pnpmVersion = String(tools.pnpm);
    } catch {
    }
    if (!nodeVersion) nodeVersion = process.version.replace(/^v/i, "");
    if (!pnpmVersion) pnpmVersion = "10.16.1";
    const steps = [
      { name: "Node version", cmd: "node -v" },
      { name: "Enable Corepack", cmd: "corepack enable" },
      { name: "Prepare pnpm", cmd: `corepack prepare pnpm@${pnpmVersion} --activate` },
      { name: "pnpm version", cmd: "pnpm -v" },
      { name: "Install", cmd: "pnpm install -r --frozen-lockfile" },
      { name: "Build", cmd: "pnpm build" },
      { name: "Test", cmd: `pnpm -C packages/cli test -- --reporter=dot${opts.tests ? " " + opts.tests : ""}` }
    ];
    const results = [];
    for (const s of steps) {
      const r = await proc.run({ cmd: s.cmd, cwd: process.cwd() });
      const rc = (() => {
        const maybe = r.code;
        return typeof maybe === "number" ? maybe : r.ok ? 0 : -1;
      })();
      results.push({ name: s.name, ok: r.ok, code: rc, stdout: r.stdout, stderr: r.stderr });
      if (!r.ok) break;
    }
    const okAll = results.every((r) => r.ok);
    if (opts.json) {
      logger.jsonPrint({ ok: okAll, action: "ci-reproduce", node: nodeVersion, pnpm: pnpmVersion, results, final: true });
    } else {
      for (const r of results) logger.info(`${r.ok ? "\u2713" : "\u2717"} ${r.name} (code ${r.code})`);
      if (!okAll) process.exitCode = 1;
    }
  });
  ci.command("env").description("CI environment helpers").command("apply").description("Read CI snapshot and print shell commands to apply its environment locally").option("--snapshot <file>", "Path to CI snapshot JSON (default ./.artifacts/ci.snapshot.json)", ".artifacts/ci.snapshot.json").option("--shell <kind>", "Print export commands for: bash|pwsh (default bash)", "bash").option("--json", "Emit structured JSON summary").action(async (opts) => {
    const snapPath = opts.snapshot && opts.snapshot.length > 0 ? opts.snapshot : ".artifacts/ci.snapshot.json";
    const abs = (0, import_node_path38.join)(process.cwd(), snapPath);
    let envObj;
    try {
      const raw = await import_node_fs2.promises.readFile(abs, "utf8");
      const js = JSON.parse(raw);
      if (js && typeof js.env === "object") envObj = js.env;
      else if (js && typeof js === "object") {
        const candidate = {};
        for (const [k, v] of Object.entries(js)) if (typeof v === "string") candidate[k] = v;
        if (Object.keys(candidate).length > 0) envObj = candidate;
      }
    } catch {
    }
    envObj = envObj ?? {};
    const lines = [];
    const sh = opts.shell === "pwsh" ? "pwsh" : "bash";
    for (const [k, v] of Object.entries(envObj)) {
      if (sh === "bash") lines.push(`export ${k}=${JSON.stringify(v)}`);
      else lines.push(`$Env:${k} = ${JSON.stringify(v)}`);
    }
    if (opts.json) {
      logger.jsonPrint({ ok: true, action: "ci-env-apply", shell: sh, count: lines.length, final: true });
    } else {
      if (lines.length === 0) logger.warn("No environment variables found in snapshot (env object missing).");
      else {
        logger.info(`# To apply in current shell (${sh}), run:`);
        for (const l of lines) logger.info(l);
      }
    }
  });
  ci.command("sync").description("Download the latest run summary and job logs into a local directory for IDE debugging").option("--workflow <file>", "Workflow file name (e.g., ci.yml, pages.yml)", "ci.yml").option("--out <dir>", "Output directory (default ./.artifacts/ci-logs)", ".artifacts/ci-logs").option("--pr <number>", "Scope to a given PR number (resolves head branch)").option("--follow", "Re-sync until run completes").option("--json", "Emit structured JSON summary").action(async (opts) => {
    const repo = await resolveRepo();
    if (!repo) {
      const msg = "Unable to resolve GitHub repo. Set GITHUB_REPOSITORY or add a git origin remote.";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-sync", message: msg, final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    const hasGh = await ghExists();
    if (!hasGh) {
      const msg = "GitHub CLI (gh) not found. Install via: winget install GitHub.cli";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-sync", repo, suggestion: "install gh", final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    let branch;
    if (opts.pr) {
      const prRes = await proc.run({ cmd: `gh pr view ${opts.pr} --repo ${repo} --json headRefName`, cwd: process.cwd() });
      if (prRes.ok) {
        try {
          const js = JSON.parse(prRes.stdout);
          if (js?.headRefName) branch = js.headRefName;
        } catch {
        }
      }
    }
    if (!branch) branch = await resolveBranch();
    const wf = String(opts.workflow || "ci.yml");
    const repoName = repo;
    async function syncOnce() {
      const info = await getLatestRun({ repo: repoName, branch, workflow: wf });
      if (!info) return { ok: false };
      const id = info.id;
      const url = runUrl(repoName, id);
      const outRoot = opts.out && opts.out.length > 0 ? opts.out : ".artifacts/ci-logs";
      const runDir = (0, import_node_path38.join)(process.cwd(), outRoot, sanitizeFilename(wf.replace(/\.yml$/i, "")), String(id));
      await ensureDir2(runDir);
      const summary = await proc.run({ cmd: `gh run view ${id} --repo ${repoName} --json url,conclusion,createdAt,updatedAt,jobs`, cwd: process.cwd() });
      if (summary.ok) await writeTextFile((0, import_node_path38.join)(runDir, "summary.json").replace(/\\/g, "/"), summary.stdout);
      const jobs = await getRunJobs({ repo: repoName, id });
      for (const j of jobs) {
        const logPath = (0, import_node_path38.join)(runDir, `job-${j.id}-${j.name}.log`).replace(/\\/g, "/");
        const res = await proc.run({ cmd: `gh run view ${id} --repo ${repoName} --job ${j.id} --log`, cwd: process.cwd() });
        if (res.ok) await writeTextFile(logPath, res.stdout);
      }
      return { ok: true, id, status: info.status, conclusion: info.conclusion, url };
    }
    if (opts.follow) {
      while (true) {
        const one = await syncOnce();
        if (!one.ok) {
          if (opts.json) logger.jsonPrint({ ok: false, action: "ci-sync", repo, branch, workflow: wf, message: "No runs found", final: true });
          else logger.warn("No runs found");
          return;
        }
        const st = (one.status ?? "").toLowerCase();
        const done = st === "completed";
        if (done) {
          if (opts.json) logger.jsonPrint({ ok: true, action: "ci-sync", repo, branch, workflow: wf, id: one.id, url: one.url, status: one.status, conclusion: one.conclusion, follow: true, final: true });
          else logger.info(`Synced: ${one.url}`);
          if ((one.conclusion ?? "").toLowerCase() === "failure") process.exitCode = 1;
          return;
        }
        await new Promise((r) => setTimeout(r, 5e3));
      }
    } else {
      const res = await syncOnce();
      if (!res.ok) {
        if (opts.json) logger.jsonPrint({ ok: false, action: "ci-sync", repo, branch, workflow: wf, message: "No runs found", final: true });
        else logger.warn("No runs found");
        return;
      }
      if (opts.json) logger.jsonPrint({ ok: true, action: "ci-sync", repo, branch, workflow: wf, id: res.id, url: res.url, status: res.status, conclusion: res.conclusion, final: true });
      else logger.info(`Synced: ${res.url}`);
      if ((res.conclusion ?? "").toLowerCase() === "failure") process.exitCode = 1;
    }
  });
  ci.command("last").description("Show the most recent GitHub Actions run (any branch); optionally scope to a PR or workflow").option("--workflow <file>", "Workflow file name (e.g., ci.yml, pages.yml)").option("--pr <number>", "Scope to a given PR number (resolves head branch)").option("--json", "Emit structured JSON summary").action(async (opts) => {
    const repo = await resolveRepo();
    if (!repo) {
      const msg = "Unable to resolve GitHub repo. Set GITHUB_REPOSITORY or add a git origin remote.";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-last", message: msg, final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    const hasGh = await ghExists();
    if (!hasGh) {
      const msg = "GitHub CLI (gh) not found. Install via: winget install GitHub.cli";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-last", repo, suggestion: "install gh", final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    let branch;
    if (opts.pr) {
      const prRes = await proc.run({ cmd: `gh pr view ${opts.pr} --repo ${repo} --json headRefName`, cwd: process.cwd() });
      if (prRes.ok) {
        try {
          const js = JSON.parse(prRes.stdout);
          if (js?.headRefName) branch = js.headRefName;
        } catch {
        }
      }
    }
    const wf = opts.workflow;
    const info = await getLatestRun({ repo, branch, workflow: wf });
    if (!info) {
      const msg = "No runs found (trigger a workflow first).";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-last", repo, branch, workflow: wf, message: msg, final: true });
      else logger.warn(msg);
      return;
    }
    const url = runUrl(repo, info.id);
    const ok = (info.conclusion ?? "").toLowerCase() !== "failure";
    if (opts.json) logger.jsonPrint({ ok, action: "ci-last", repo, branch, workflow: wf, id: info.id, url, status: info.status, conclusion: info.conclusion, final: true });
    else logger.info(`${info.status ?? "status: unknown"} \u2014 ${url}`);
    if (!ok) emitAnnotation("error", `CI run failed: ${url}`);
    if (!ok) process.exitCode = 1;
  });
  ci.command("open").description("Open the most recent GitHub Actions run in your browser (optionally scope to a workflow or PR)").option("--workflow <file>", "Workflow file name (e.g., ci.yml, pages.yml)").option("--pr <number>", "Scope to a given PR number (resolves head branch)").option("--json", "Emit structured JSON summary").action(async (opts) => {
    const repo = await resolveRepo();
    if (!repo) {
      const msg = "Unable to resolve GitHub repo. Set GITHUB_REPOSITORY or add a git origin remote.";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-open", message: msg, final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    const hasGh = await ghExists();
    if (!hasGh) {
      const msg = "GitHub CLI (gh) not found. Install via: winget install GitHub.cli";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-open", repo, suggestion: "install gh", final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    let branch;
    if (opts.pr) {
      const prRes = await proc.run({ cmd: `gh pr view ${opts.pr} --repo ${repo} --json headRefName`, cwd: process.cwd() });
      if (prRes.ok) {
        try {
          const js = JSON.parse(prRes.stdout);
          if (js?.headRefName) branch = js.headRefName;
        } catch {
        }
      }
    }
    const wf = opts.workflow;
    const info = await getLatestRun({ repo, branch, workflow: wf });
    if (!info) {
      const msg = "No runs found (trigger a workflow first).";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-open", repo, branch, workflow: wf, message: msg, final: true });
      else logger.warn(msg);
      return;
    }
    const url = runUrl(repo, info.id);
    const opened = await platformOpen(url);
    if (opts.json) logger.jsonPrint({ ok: opened.ok, action: "ci-open", repo, branch, workflow: wf, id: info.id, url, status: info.status, conclusion: info.conclusion, final: true });
    else logger.info(`Opened: ${url}`);
    if (!opened.ok) process.exitCode = 1;
  });
  ci.command("summarize").description("Produce a compact summary of the latest run with failing jobs and error excerpts").option("--workflow <file>", "Workflow file name (e.g., ci.yml, pages.yml)", "ci.yml").option("--out <dir>", "Logs directory (default ./.artifacts/ci-logs)", ".artifacts/ci-logs").option("--pr <number>", "Scope to a given PR number (resolves head branch)").option("--json", "Emit structured JSON summary").action(async (opts) => {
    const repo = await resolveRepo();
    if (!repo) {
      const msg = "Unable to resolve GitHub repo. Set GITHUB_REPOSITORY or add a git origin remote.";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-summarize", message: msg, final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    const hasGh = await ghExists();
    if (!hasGh) {
      const msg = "GitHub CLI (gh) not found. Install via: winget install GitHub.cli";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-summarize", repo, suggestion: "install gh", final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    let branch;
    if (opts.pr) {
      const prRes = await proc.run({ cmd: `gh pr view ${opts.pr} --repo ${repo} --json headRefName`, cwd: process.cwd() });
      if (prRes.ok) {
        try {
          const js = JSON.parse(prRes.stdout);
          if (js?.headRefName) branch = js.headRefName;
        } catch {
        }
      }
    }
    if (!branch) branch = await resolveBranch();
    const wf = String(opts.workflow || "ci.yml");
    const repoName = repo;
    const run2 = await getLatestRun({ repo: repoName, branch, workflow: wf });
    if (!run2) {
      const msg = "No runs found (trigger a workflow first).";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-summarize", repo: repoName, branch, workflow: wf, message: msg, final: true });
      else logger.warn(msg);
      return;
    }
    const runId = run2.id;
    const outRoot = opts.out && opts.out.length > 0 ? opts.out : ".artifacts/ci-logs";
    const runDir = (0, import_node_path38.join)(process.cwd(), outRoot, sanitizeFilename(wf.replace(/\.yml$/i, "")), String(runId));
    await ensureDir2(runDir);
    async function ensureSynced() {
      const summaryPath = (0, import_node_path38.join)(runDir, "summary.json").replace(/\\/g, "/");
      let haveSummary = false;
      try {
        await import_node_fs2.promises.access(summaryPath);
        haveSummary = true;
      } catch {
      }
      if (!haveSummary) {
        const summary = await proc.run({ cmd: `gh run view ${runId} --repo ${repoName} --json url,conclusion,createdAt,updatedAt,jobs`, cwd: process.cwd() });
        if (summary.ok) await writeTextFile(summaryPath, summary.stdout);
      }
      const jobs2 = await getRunJobs({ repo: repoName, id: runId });
      for (const j of jobs2) {
        const logPath = (0, import_node_path38.join)(runDir, `job-${j.id}-${j.name}.log`).replace(/\\/g, "/");
        let haveLog = false;
        try {
          await import_node_fs2.promises.access(logPath);
          haveLog = true;
        } catch {
        }
        if (!haveLog) {
          const res = await proc.run({ cmd: `gh run view ${runId} --repo ${repoName} --job ${j.id} --log`, cwd: process.cwd() });
          if (res.ok) await writeTextFile(logPath, res.stdout);
        }
      }
    }
    await ensureSynced();
    let summaryObj;
    try {
      const raw = await import_node_fs2.promises.readFile((0, import_node_path38.join)(runDir, "summary.json"), "utf8");
      summaryObj = JSON.parse(raw);
    } catch {
    }
    const runUrlStr = summaryObj?.url ?? runUrl(repoName, runId);
    const failures = [];
    const jobs = summaryObj?.jobs ?? [];
    for (const j of jobs) {
      const id = typeof j.databaseId === "number" ? j.databaseId : void 0;
      const name = sanitizeFilename(j.name ?? "job");
      const concl = (j.conclusion ?? "").toLowerCase();
      if (id && (concl === "failure" || concl === "cancelled" || concl === "timed_out")) {
        const logPath = (0, import_node_path38.join)(runDir, `job-${id}-${name}.log`).replace(/\\/g, "/");
        let errors = [];
        try {
          const txt = await import_node_fs2.promises.readFile(logPath, "utf8");
          const lines = txt.split(/\r?\n/);
          const errLines = lines.filter((l) => /(::error|\berror\b|\bERR!\b|\bFailed\b)/i.test(l));
          errors = errLines.slice(-10);
          if (errors.length === 0) errors = lines.slice(-20);
        } catch {
        }
        failures.push({ id, name, conclusion: j.conclusion, errors });
      }
    }
    const ok = (run2.conclusion ?? "").toLowerCase() === "success";
    if (opts.json) {
      logger.jsonPrint({ ok, action: "ci-summarize", repo: repoName, branch, workflow: wf, id: runId, url: runUrlStr, failures, final: true });
    } else {
      logger.info(`${ok ? "Success" : "Done"} \u2014 ${runUrlStr}`);
      if (failures.length === 0) {
        logger.note("No failing jobs found.");
      } else {
        for (const f of failures) {
          logger.warn(`Job failed: ${f.name} (#${f.id})`);
          for (const line of f.errors ?? []) logger.info(`  ${line}`);
        }
      }
    }
    if (!ok) process.exitCode = 1;
  });
  ci.command("dispatch").description("Dispatch a GitHub Actions workflow (safeguarded). Requires --yes to proceed.").option("--workflow <file>", "Workflow file name (e.g., ci.yml, pages.yml)").option("--ref <ref>", "Git ref to run on", "main").option("--inputs <k=v,...>", "Comma-separated inputs (use key=value pairs)").option("--yes", "Confirm dispatch without prompting").option("--json", "Emit structured JSON summary").action(async (opts) => {
    const repo = await resolveRepo();
    if (!repo) {
      const msg = "Unable to resolve GitHub repo. Set GITHUB_REPOSITORY or add a git origin remote.";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-dispatch", message: msg, final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    const hasGh = await ghExists();
    if (!hasGh) {
      const msg = "GitHub CLI (gh) not found. Install via: winget install GitHub.cli";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-dispatch", repo, suggestion: "install gh", final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    const wf = opts.workflow;
    if (!wf) {
      const msg = "Missing --workflow <file>. Specify a workflow filename (e.g., ci.yml).";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-dispatch", repo, message: msg, final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    if (!opts.yes) {
      const msg = "Refusing to dispatch without --yes. Re-run with --yes to proceed.";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-dispatch", repo, workflow: wf, message: msg, final: true });
      else logger.warn(msg);
      process.exitCode = 1;
      return;
    }
    const ref = opts.ref || "main";
    const fields = [];
    if (opts.inputs) {
      for (const kv of opts.inputs.split(",")) {
        const [k, v] = kv.split("=");
        if (k && v !== void 0) fields.push(`--raw-field ${k}=${v}`);
      }
    }
    const cmd = `gh workflow run ${wf} --repo ${repo} --ref ${ref} ${fields.join(" ")}`.trim();
    const runRes = await proc.run({ cmd, cwd: process.cwd() });
    const ok = runRes.ok;
    if (opts.json) logger.jsonPrint({ ok, action: "ci-dispatch", repo, workflow: wf, ref, final: true });
    else logger.info(ok ? "Workflow dispatch requested." : runRes.stderr.trim() || "Workflow dispatch failed.");
    if (!ok) process.exitCode = 1;
  });
  ci.command("artifacts").description("List or download artifacts from the latest GitHub Actions run").option("--workflow <file>", "Workflow file name (e.g., ci.yml, pages.yml)").option("--pr <number>", "Scope to a given PR number (resolves head branch)").option("--download", "Download artifacts instead of listing").option("--name <pattern>", "Only download artifacts matching name (exact match)").option("--out <dir>", "Directory to download artifacts into (default ./.artifacts)", ".artifacts").option("--json", "Emit structured JSON summary").action(async (opts) => {
    const repo = await resolveRepo();
    if (!repo) {
      const msg = "Unable to resolve GitHub repo. Set GITHUB_REPOSITORY or add a git origin remote.";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-artifacts", message: msg, final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    const hasGh = await ghExists();
    if (!hasGh) {
      const msg = "GitHub CLI (gh) not found. Install via: winget install GitHub.cli";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-artifacts", repo, suggestion: "install gh", final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    let branch;
    if (opts.pr) {
      const prRes = await proc.run({ cmd: `gh pr view ${opts.pr} --repo ${repo} --json headRefName`, cwd: process.cwd() });
      if (prRes.ok) {
        try {
          const js = JSON.parse(prRes.stdout);
          if (js?.headRefName) branch = js.headRefName;
        } catch {
        }
      }
    }
    if (!branch) branch = await resolveBranch();
    const wf = opts.workflow;
    const info = await getLatestRun({ repo, branch, workflow: wf });
    if (!info) {
      const msg = "No runs found (trigger a workflow first).";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-artifacts", repo, branch, workflow: wf, message: msg, final: true });
      else logger.warn(msg);
      return;
    }
    const id = info.id;
    const view = await proc.run({ cmd: `gh run view ${id} --repo ${repo} --json artifacts`, cwd: process.cwd() });
    if (!view.ok) {
      const msg = view.stderr.trim() || view.stdout.trim() || "Failed to query artifacts";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-artifacts", repo, branch, workflow: wf, id, message: msg, final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    let artifacts = [];
    try {
      const js = JSON.parse(view.stdout);
      artifacts = js.artifacts ?? [];
    } catch {
    }
    if (!opts.download) {
      if (opts.json) logger.jsonPrint({ ok: true, action: "ci-artifacts", repo, branch, workflow: wf, id, artifacts, final: true });
      else {
        if (artifacts.length === 0) logger.info("No artifacts");
        else for (const a of artifacts) logger.info(`\u2022 ${a.name ?? "artifact"}${typeof a.sizeInBytes === "number" ? ` (${Math.round(a.sizeInBytes / 1024)} KiB)` : ""}`);
      }
      return;
    }
    const outDir = opts.out && opts.out.length > 0 ? opts.out : ".artifacts";
    const nameArg = opts.name ? ` --name "${opts.name}"` : "";
    const cmd = `gh run download ${id} --repo ${repo} --dir "${(0, import_node_path38.join)(process.cwd(), outDir)}"${nameArg}`;
    const dl = await proc.run({ cmd, cwd: process.cwd() });
    const ok = dl.ok;
    if (opts.json) logger.jsonPrint({ ok, action: "ci-artifacts", repo, branch, workflow: wf, id, outDir, name: opts.name, final: true });
    else logger.info(ok ? `Downloaded to ${outDir}` : dl.stderr.trim() || "Download failed");
    if (!ok) process.exitCode = 1;
  });
  ci.command("rerun").description("Re-run the most recent GitHub Actions run (optionally scope to a workflow or PR)").option("--workflow <file>", "Workflow file name (e.g., ci.yml, pages.yml)").option("--pr <number>", "Scope to a given PR number (resolves head branch)").option("--json", "Emit structured JSON summary").action(async (opts) => {
    const repo = await resolveRepo();
    if (!repo) {
      const msg = "Unable to resolve GitHub repo. Set GITHUB_REPOSITORY or add a git origin remote.";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-rerun", message: msg, final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    const hasGh = await ghExists();
    if (!hasGh) {
      const msg = "GitHub CLI (gh) not found. Install via: winget install GitHub.cli";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-rerun", repo, suggestion: "install gh", final: true });
      else logger.error(msg);
      process.exitCode = 1;
      return;
    }
    let branch;
    if (opts.pr) {
      const prRes = await proc.run({ cmd: `gh pr view ${opts.pr} --repo ${repo} --json headRefName`, cwd: process.cwd() });
      if (prRes.ok) {
        try {
          const js = JSON.parse(prRes.stdout);
          if (js?.headRefName) branch = js.headRefName;
        } catch {
        }
      }
    }
    if (!branch) branch = await resolveBranch();
    const wf = opts.workflow;
    const info = await getLatestRun({ repo, branch, workflow: wf });
    if (!info) {
      const msg = "No runs found (trigger a workflow first).";
      if (opts.json) logger.jsonPrint({ ok: false, action: "ci-rerun", repo, branch, workflow: wf, message: msg, final: true });
      else logger.warn(msg);
      return;
    }
    const cmd = `gh run rerun ${info.id} --repo ${repo}`;
    const rr = await proc.run({ cmd, cwd: process.cwd() });
    const ok = rr.ok;
    if (opts.json) logger.jsonPrint({ ok, action: "ci-rerun", repo, branch, workflow: wf, id: info.id, final: true });
    else logger.info(ok ? "Rerun requested." : rr.stderr.trim() || "Rerun failed.");
    if (!ok) process.exitCode = 1;
  });
}

// src/index.ts
var VERSION = "1.2.0-rc.2";
function main() {
  const program = new import_commander19.Command();
  program.name("opendeploy");
  program.description("OpenDeploy CLI \u2014 cross-provider deployment assistant for the modern web stack");
  program.version(VERSION, "-v, --version", "output the version number");
  program.option("--verbose", "Verbose output");
  program.option("--json", "JSON-only output (suppresses non-JSON logs)");
  program.option("--quiet", "Error-only output (suppresses info/warn/success)");
  program.option("--no-emoji", "Disable emoji prefixes for logs");
  program.option("--compact-json", "Compact JSON (one line)");
  program.option("--ndjson", "Newline-delimited JSON streaming (implies --json)");
  program.option("--timestamps", "Prefix human logs and JSON with ISO timestamps");
  program.option("--summary-only", "Only print final JSON summary objects (objects with { final: true })");
  program.option("--color <mode>", "Color mode: auto|always|never", "auto");
  program.option("--json-file [path]", "Also write JSON output lines to file (appends)");
  program.option("--ndjson-file [path]", "Also write NDJSON output lines to file (appends)");
  program.option("--gha-annotations <mode>", "GitHub annotations: error|warning|off", "warning");
  program.option("--gha", "GitHub Actions-friendly defaults (implies --json --summary-only --timestamps, sets annotation/file sinks)");
  if (process.argv.includes("-s") || process.argv.includes("--start")) {
    const ix = process.argv.findIndex((a) => a === "-s" || a === "--start");
    if (ix !== -1) process.argv.splice(ix, 1);
    if (!process.argv.slice(2).includes("start")) process.argv.splice(2, 0, "start");
  }
  if (process.argv.includes("--verbose")) {
    logger.setLevel("debug");
    process.env.OPD_VERBOSE = "1";
  }
  if (process.argv.includes("--json")) {
    logger.setJsonOnly(true);
    process.env.OPD_JSON = "1";
  }
  if (process.argv.includes("--quiet")) {
    logger.setLevel("error");
    process.env.OPD_QUIET = "1";
  }
  if (process.argv.includes("--no-emoji")) {
    logger.setNoEmoji(true);
    process.env.OPD_NO_EMOJI = "1";
  }
  if (process.argv.includes("--compact-json")) {
    logger.setJsonCompact(true);
    process.env.OPD_JSON_COMPACT = "1";
  }
  if (process.argv.includes("--ndjson")) {
    logger.setNdjson(true);
    process.env.OPD_NDJSON = "1";
  }
  if (process.argv.includes("--timestamps")) {
    logger.setTimestamps(true);
    process.env.OPD_TS = "1";
  }
  if (process.argv.includes("--summary-only")) {
    logger.setSummaryOnly(true);
    process.env.OPD_SUMMARY = "1";
  }
  if (process.argv.includes("--gha")) {
    logger.setJsonOnly(true);
    process.env.OPD_JSON = "1";
    logger.setSummaryOnly(true);
    process.env.OPD_SUMMARY = "1";
    logger.setTimestamps(true);
    process.env.OPD_TS = "1";
    if (!process.env.OPD_JSON_FILE) {
      const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
      const p = `./.artifacts/opendeploy-${ts}.json`;
      logger.setJsonFile(p);
      process.env.OPD_JSON_FILE = p;
    }
    if (!process.env.OPD_NDJSON_FILE) {
      const ts2 = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
      const p2 = `./.artifacts/opendeploy-${ts2}.ndjson`;
      logger.setNdjsonFile(p2);
      process.env.OPD_NDJSON_FILE = p2;
    }
    if (!process.env.OPD_GHA_ANN) process.env.OPD_GHA_ANN = "warning";
    process.env.OPD_GHA = "1";
  }
  const jsonFileIx = process.argv.findIndex((a) => a === "--json-file");
  if (jsonFileIx !== -1) {
    let p = process.argv[jsonFileIx + 1];
    if (!p || p.startsWith("-")) {
      const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
      p = `./.artifacts/opendeploy-${ts}.json`;
    }
    logger.setJsonFile(p);
    process.env.OPD_JSON_FILE = p;
  } else if (process.env.OPD_JSON_FILE) {
    logger.setJsonFile(process.env.OPD_JSON_FILE);
  }
  const ndjsonFileIx = process.argv.findIndex((a) => a === "--ndjson-file");
  if (ndjsonFileIx !== -1) {
    let p = process.argv[ndjsonFileIx + 1];
    if (!p || p.startsWith("-")) {
      const ts2 = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
      p = `./.artifacts/opendeploy-${ts2}.ndjson`;
    }
    logger.setNdjsonFile(p);
    process.env.OPD_NDJSON_FILE = p;
  } else if (process.env.OPD_NDJSON_FILE) {
    logger.setNdjsonFile(process.env.OPD_NDJSON_FILE);
  }
  const ghaIx = process.argv.findIndex((a) => a === "--gha-annotations");
  if (ghaIx !== -1 && process.argv[ghaIx + 1]) {
    const mode2 = process.argv[ghaIx + 1];
    process.env.OPD_GHA_ANN = mode2;
  }
  const colorIx = process.argv.findIndex((a) => a === "--color");
  if (colorIx !== -1 && process.argv[colorIx + 1]) {
    const m = process.argv[colorIx + 1];
    setColorMode(m);
    process.env.OPD_COLOR = m;
  } else {
    setColorMode("auto");
    process.env.OPD_COLOR = "auto";
  }
  if (process.env.OPD_NO_REDACT !== "1") {
    void computeRedactors({ cwd: process.cwd(), envFiles: [".env", ".env.local", ".env.production.local"], includeProcessEnv: true }).then((patterns) => {
      if (Array.isArray(patterns) && patterns.length > 0) logger.setRedactors(patterns);
    }).catch(() => {
    });
  }
  registerDetectCommand(program);
  registerDoctorCommand(program);
  registerGenerateCommand(program);
  registerDeployCommand(program);
  registerEnvCommand(program);
  registerSeedCommand(program);
  registerRunCommand(program);
  registerInitCommand(program);
  registerCompletionCommand(program);
  registerPromoteCommand(program);
  registerExplainCommand(program);
  registerRollbackCommand(program);
  registerProvidersCommand(program);
  registerPlanCommand(program);
  registerUpCommand(program);
  registerStartCommand(program);
  registerCiLogsCommand(program);
  registerTestMatrixCommand(program);
  program.parseAsync(process.argv).then(() => {
  }).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    const isJson = process.env.OPD_JSON === "1" || process.env.OPD_NDJSON === "1";
    const alreadyHandled = process.env.OPD_HANDLED === "1";
    if (isJson) {
      if (!alreadyHandled) {
        logger.jsonPrint({ ok: false, action: "error", message, final: true });
      }
      process.exit(1);
    } else {
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });
}
main();
//# sourceMappingURL=index.cjs.map
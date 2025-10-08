#!/usr/bin/env node
/**
 * Capture CLI JSON outputs and validate against schemas.
 * Runs entirely offline using provider mode 'virtual' and dry-run flags.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const artifactsDir = path.resolve('.artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

// Ensure offline/virtual provider where applicable
process.env.OPD_PROVIDER_MODE = process.env.OPD_PROVIDER_MODE || 'virtual';
process.env.CI = '1';

function sh(bin, args) {
  const res = spawnSync(bin, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  return res.status ?? 1;
}

const CLI = ['node', 'packages/cli/dist/index.js'];

// 1) Capture start/up (dry-run) JSON outputs
const captures = [
  {
    out: path.join(artifactsDir, 'ci.start.json'),
    cmd: [...CLI, 'start', '--provider', 'vercel', '--env', 'preview', '--json', '--dry-run', '--summary-only', '--json-file', path.join(artifactsDir, 'ci.start.json')],
  },
  {
    out: path.join(artifactsDir, 'ci.up.json'),
    cmd: [...CLI, 'up', 'vercel', '--env', 'preview', '--json', '--dry-run', '--summary-only', '--json-file', path.join(artifactsDir, 'ci.up.json')],
  },
];

let failures = 0;
for (const c of captures) {
  const status = sh(c.cmd[0], c.cmd.slice(1));
  if (status !== 0) {
    console.error(`[ci:capture-validate] capture failed: ${c.out}`);
    failures++;
  }
}

// 2) Validate JSON using CLI's Ajv
const requireCli = createRequire(path.resolve('packages/cli/package.json'));
const Ajv = requireCli('ajv').default;
const ajv = new Ajv({ allErrors: true, strict: false });

const schemas = [
  { file: 'start.schema.json', target: 'ci.start.json' },
  { file: 'up.schema.json', target: 'ci.up.json' },
];

const schemasDir = path.resolve('packages/cli/schemas');
for (const s of schemas) {
  const schPath = path.join(schemasDir, s.file);
  const outPath = path.join(artifactsDir, s.target);
  if (!fs.existsSync(outPath)) {
    console.warn(`[ci:capture-validate] missing capture: ${outPath}`);
    failures++;
    continue;
  }
  const schema = JSON.parse(fs.readFileSync(schPath, 'utf8'));
  const data = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  const validate = ajv.compile(schema);
  const ok = validate(data);
  if (!ok) {
    failures++;
    console.error(`\n[ci:capture-validate] ${path.basename(outPath)} failed against ${path.basename(schPath)}`);
    console.error(ajv.errorsText(validate.errors, { separator: '\n - ' }));
  } else {
    console.log(`[ci:capture-validate] OK: ${path.basename(outPath)} -> ${path.basename(schPath)}`);
  }
}

process.exit(failures === 0 ? 0 : 1);

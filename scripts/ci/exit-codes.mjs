#!/usr/bin/env node
/**
 * Exit code consistency checks for the OpenDeploy monorepo.
 * - Ensures "--help" returns 0
 * - Ensures an unknown subcommand returns non-zero
 * - Ensures "doctor env-snapshot" returns 0
 */
import { spawnSync } from 'node:child_process';

/** @typedef {{cmd: string[], expect: number, name: string}} Check */

/**
 * @param {string[]} cmd
 * @returns {number}
 */
function run(cmd) {
  const [bin, ...args] = cmd;
  const res = spawnSync(bin, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  return res.status ?? 1;
}

/** @type {Check[]} */
const checks = [
  { name: 'help exit=0', cmd: ['node', 'packages/cli/dist/index.js', '--help'], expect: 0 },
  { name: 'unknown subcommand exit!=0', cmd: ['node', 'packages/cli/dist/index.js', '___unknown___'], expect: 1 },
  { name: 'doctor env-snapshot exit=0', cmd: ['node', 'packages/cli/dist/index.js', 'doctor', 'env-snapshot', '--out', '.artifacts/ci.snapshot.json'], expect: 0 },
];

let failures = 0;
for (const c of checks) {
  const status = run(c.cmd);
  const ok = c.expect === 0 ? status === 0 : status !== 0;
  if (!ok) {
    console.error(`[ci:exit-codes] Failed: ${c.name} (status=${status})`);
    failures += 1;
  }
}

process.exit(failures === 0 ? 0 : 1);

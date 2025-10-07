import { spawnSync } from 'node:child_process'

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: true, ...opts })
  return res.status ?? 1
}

function assertExit(code, expected, label) {
  if ((expected === 0 && code !== 0) || (expected !== 0 && code === 0)) {
    console.error(`[ci:exit-codes] ${label} failed: expected ${expected === 0 ? 'success' : 'failure'}, got ${code}`)
    process.exit(1)
  }
}

// 1) A command expected to succeed (help) — does not depend on detection
const ok1 = run('node', ['dist/index.js', '--help'])
assertExit(ok1, 0, '--help')

// 2) A command expected to fail in CI by design (doctor --ci). CI runners are not logged into providers.
const ok2 = run('node', ['dist/index.js', 'doctor', '--ci', '--json'])
assertExit(ok2, 1, 'doctor --ci --json')

console.log('[ci:exit-codes] All exit code checks passed')

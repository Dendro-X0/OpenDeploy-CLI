#!/usr/bin/env node
import fs from 'node:fs'

function readLineSync() {
  const buf = fs.readFileSync(0, 'utf8')
  const lines = buf.split(/\r?\n/).filter(Boolean)
  return lines[0] || '{}'
}

function println(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

try {
  const raw = readLineSync()
  const req = JSON.parse(raw)
  // Emit a couple of events to simulate streaming
  println({ action: 'go', event: 'stdout', data: 'fake: start ' + (req.cmd || '') })
  println({ action: 'go', event: 'status', data: 'heartbeat' })
  println({ action: 'go', event: 'stderr', data: '' })
  const ok = true
  const exitCode = 0
  println({ action: 'go', event: 'done', ok, exitCode, final: true })
} catch (e) {
  const ok = false
  const exitCode = 1
  println({ action: 'go', event: 'done', ok, exitCode, final: true })
}

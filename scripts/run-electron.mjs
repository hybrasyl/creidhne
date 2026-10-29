#!/usr/bin/env node
/**
 * Run a script under real Electron, with ELECTRON_RUN_AS_NODE removed.
 *
 * Usage: node scripts/run-electron.mjs <script> [args...]
 *
 * Some shells export ELECTRON_RUN_AS_NODE=1. The shell that the Claude Code
 * VSCode extension starts for its agent is one; an ordinary terminal usually
 * is not. With the variable set, a bare `electron <script>` runs as plain Node: `app` and `net` do not exist,
 * and `import 'electron'` gives the npm shim's path string. A script cannot
 * repair that from the inside, because it is already Node when it starts. So
 * this launcher, which IS plain Node, removes the variable and starts Electron.
 *
 * `e2e/helpers.js` does the same for Playwright's launch. This is the same
 * strip for an npm script.
 *
 * `env -u` would be shorter, but npm runs scripts through cmd.exe on Windows,
 * which has no `env`.
 */
import { spawnSync } from 'child_process'
// Under plain Node, the electron package exports the path to its binary.
import electronPath from 'electron'

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('usage: node scripts/run-electron.mjs <script> [args...]')
  process.exit(2)
}

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const res = spawnSync(electronPath, args, { stdio: 'inherit', env })
if (res.error) {
  console.error(`run-electron: could not start ${electronPath}: ${res.error.message}`)
  process.exit(1)
}
// A signal leaves `status` null. That is a failure, never a pass.
process.exit(res.status ?? 1)

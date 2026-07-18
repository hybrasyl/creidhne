import { promises as fs } from 'fs'
import { join } from 'path'
import os from 'os'
import { scrubText } from '../shared/scrub.js'
import { formatErrorLine } from '../shared/diagnostics.js'

// Per-session error logger. One file per app launch under <logsDir>, keeping only
// the KEEP_SESSIONS most recent. Errors are SCRUBBED at capture time (before the
// ring buffer or disk), so the on-disk logs are already safe to attach to a bug
// report. Best-effort throughout — a logging failure must never disturb the app
// (mirrors schemaLog.js); appends are serialized through a queue (mirrors
// settingsManager.js) so rapid errors don't interleave partial lines.

const KEEP_SESSIONS = 5
const RING_MAX = 20

let logsDir = null
let sessionFile = null
let scrubCtx = { homeDir: undefined, userName: undefined }
const ring = []
let appendQueue = Promise.resolve()

// Compact, filename-safe, sortable stamp: YYYYMMDD-HHmmss-SSS. Lexical sort on the
// filename is chronological, which is what rotation relies on.
function sessionStamp() {
  const iso = new Date().toISOString() // 2026-07-18T16:42:15.123Z
  const date = iso.slice(0, 10).replace(/-/g, '')
  const time = iso.slice(11, 19).replace(/:/g, '')
  const ms = iso.slice(20, 23)
  return `${date}-${time}-${ms}`
}

const SESSION_RE = /^session-.*\.log$/

// Keep only the newest KEEP_SESSIONS session files; unlink the rest. Best-effort.
async function rotate(dir) {
  const entries = await fs.readdir(dir).catch(() => [])
  const sessions = entries.filter((f) => SESSION_RE.test(f)).sort() // oldest first
  const excess = sessions.length - KEEP_SESSIONS
  for (let i = 0; i < excess; i++) {
    await fs.unlink(join(dir, sessions[i])).catch(() => {})
  }
}

function enqueueAppend(line) {
  const write = () => fs.appendFile(sessionFile, `${line}\n`, 'utf-8').catch(() => {})
  appendQueue = appendQueue.then(write, write)
  return appendQueue
}

/**
 * Create this run's session file, capture the scrub context, and prune old files.
 * Called once at startup, before any handler can fire.
 */
export async function initSessionLog(dir) {
  logsDir = dir
  const homeDir = os.homedir()
  let userName
  try {
    userName = os.userInfo().username
  } catch {
    userName = undefined
  }
  scrubCtx = { homeDir, userName }
  sessionFile = join(dir, `session-${sessionStamp()}.log`)
  await fs.mkdir(dir, { recursive: true }).catch(() => {})
  // Touch (create empty) so a launch with zero errors still counts as a session
  // for rotation — 'a' creates without truncating.
  await fs.appendFile(sessionFile, '', 'utf-8').catch(() => {})
  await rotate(dir)
}

/**
 * Scrub, ring-buffer, and best-effort-append a captured error.
 * @param {{ source?: string, origin?: string, message?: string, stack?: string }} entry
 */
export function captureError(entry = {}) {
  const scrubbed = {
    timestamp: new Date().toISOString(),
    source: entry.source || 'error',
    origin: entry.origin || 'main',
    message: scrubText(String(entry.message ?? ''), scrubCtx),
    stack: entry.stack ? scrubText(String(entry.stack), scrubCtx) : undefined
  }
  ring.push(scrubbed)
  if (ring.length > RING_MAX) ring.shift()
  if (sessionFile) enqueueAppend(formatErrorLine(scrubbed))
}

/** Most recent scrubbed error entries (this session, main + renderer). */
export function getRecentErrors(n = RING_MAX) {
  return ring.slice(-n)
}

export function getLogsDir() {
  return logsDir
}

// Test-only: reset module state between cases.
export function _resetForTests() {
  logsDir = null
  sessionFile = null
  scrubCtx = { homeDir: undefined, userName: undefined }
  ring.length = 0
  appendQueue = Promise.resolve()
}

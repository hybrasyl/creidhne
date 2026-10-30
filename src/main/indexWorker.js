// Runs inside Electron's utilityProcess (a separate Node process, off the
// main thread). Receives a single {op, libraryPath, type?} message, performs
// the requested index operation via @eriscorp/hybindex-ts, streams progress
// events back to the parent, and exits.

import { buildIndex, buildSection, saveIndex, saveSection } from '@eriscorp/hybindex-ts'
import { stagedEntry } from '../shared/staging.js'

function reply(msg) {
  if (process.parentPort) process.parentPort.postMessage(msg)
}

function onProgress(event) {
  reply({ kind: 'progress', event })
}

async function handle(req) {
  try {
    if (req.op === 'buildIndex') {
      const index = await buildIndex(req.libraryPath, { onProgress })
      await saveIndex(req.libraryPath, index)
      reply({ kind: 'result', data: index })
    } else if (req.op === 'buildSection') {
      const { fields } = await buildSection(req.libraryPath, req.type, { onProgress })
      await saveSection(req.libraryPath, req.type, fields)
      reply({ kind: 'result', data: fields })
    } else if (req.op === 'buildStaged') {
      // The staged index (HTOO-453): the package's own section scan, over the
      // staging root, so a staged name follows the live index's rules. Never
      // saved — it is Creidhne's alone, and no progress is sent, because the
      // build pill describes the live index.
      const data = {}
      for (const type of req.types) {
        const { fields } = await buildSection(req.stagingRoot, type)
        data[type] = stagedEntry(type, fields)
      }
      reply({ kind: 'result', data })
    } else {
      reply({ kind: 'error', error: `Unknown op: ${req.op}` })
    }
  } catch (err) {
    reply({ kind: 'error', error: err?.stack || err?.message || String(err) })
  } finally {
    // One-shot: exit so the parent knows we're done and the process is freed.
    process.exit(0)
  }
}

if (process.parentPort) {
  process.parentPort.on('message', (e) => {
    handle(e.data)
  })
} else {
  // Fallback: started directly (e.g. for testing). Exit with error.
  reply({ kind: 'error', error: 'No parentPort — not running in utilityProcess?' })
  process.exit(1)
}

// Main-process client for the indexWorker utility process.
//
// Exposes async functions for the build operations that spawn a short-lived
// utility process, proxy progress events to the renderer (main window), and
// resolve with the worker's result. The lightweight read/status/delete
// operations call @eriscorp/hybindex-ts directly on main — they're cheap
// enough that the utility-process overhead isn't worth it.

import { utilityProcess, BrowserWindow } from 'electron'
import { join } from 'path'
import { loadIndex, getIndexStatus, deleteIndex } from '@eriscorp/hybindex-ts'

const WORKER_PATH = join(__dirname, 'indexWorker.js')
const PROGRESS_CHANNEL = 'index:build-progress'

function broadcastProgress(event) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(PROGRESS_CHANNEL, event)
  }
}

function runWorker(op, payload) {
  return new Promise((resolve, reject) => {
    const child = utilityProcess.fork(WORKER_PATH, [], { stdio: 'inherit' })
    let settled = false

    const finish = (fn, arg) => {
      if (settled) return
      settled = true
      fn(arg)
    }

    child.on('message', (msg) => {
      if (msg.kind === 'progress') broadcastProgress(msg.event)
      else if (msg.kind === 'result') finish(resolve, msg.data)
      else if (msg.kind === 'error') finish(reject, new Error(msg.error))
    })

    child.on('exit', (code) => {
      if (code !== 0) finish(reject, new Error(`indexWorker exited with code ${code}`))
    })

    child.postMessage({ op, ...payload })
  })
}

export async function buildIndexInWorker(libraryPath) {
  return runWorker('buildIndex', { libraryPath })
}

export async function buildSectionInWorker(libraryPath, type) {
  return runWorker('buildSection', { libraryPath, type })
}

// Lightweight ops stay on main.
export { loadIndex, getIndexStatus, deleteIndex }

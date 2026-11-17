import { describe, it, expect, vi, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Every preload subscription keeps the IpcRendererEvent on the preload side and
// returns an unsubscribe that removes the exact listener (HTOO-682, HTOO-99).
// Electron treats `event.sender` as privileged: it must not cross the bridge.
//
// The test walks the exposed API rather than a list, so a new `on*` method is
// checked without an edit here, and it counts `ipcRenderer.on(` in the source so
// a subscription the walk cannot reach fails too.

const listeners = new Map()
let exposed = null

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (_name, api) => {
      exposed = api
    }
  },
  ipcRenderer: {
    on: (channel, fn) => {
      if (!listeners.has(channel)) listeners.set(channel, new Set())
      listeners.get(channel).add(fn)
    },
    removeListener: (channel, fn) => listeners.get(channel)?.delete(fn),
    invoke: vi.fn(),
    send: vi.fn()
  }
}))

beforeAll(async () => {
  await import('../index.js')
})

// Every function whose name starts with `on`, at any depth, as [path, fn].
function subscriptions(api, prefix = '') {
  const out = []
  for (const [key, value] of Object.entries(api)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'function' && /^on[A-Z]/.test(key)) out.push([path, value])
    else if (value && typeof value === 'object') out.push(...subscriptions(value, path))
  }
  return out
}

function totalListeners() {
  let n = 0
  for (const set of listeners.values()) n += set.size
  return n
}

describe('preload subscriptions', () => {
  it('finds the subscriptions the source registers', () => {
    const src = readFileSync(join(__dirname, '..', 'index.js'), 'utf-8')
    const registered = (src.match(/ipcRenderer\.on\(/g) || []).length
    const found = subscriptions(exposed)
    // Guard the guard: the walk must see something, and as many as the source has.
    expect(found.length).toBeGreaterThan(0)
    expect(found.length).toBe(registered)
  })

  it('never passes the IPC event to the callback', () => {
    for (const [path, subscribe] of subscriptions(exposed)) {
      const received = []
      const off = subscribe((...args) => received.push(args))
      const event = { sender: { secret: 'webContents' }, senderFrame: {} }
      for (const set of listeners.values()) for (const fn of set) fn(event, { data: 1 })
      expect(received.length, path).toBeGreaterThan(0)
      for (const args of received) {
        for (const arg of args) expect(arg, path).not.toBe(event)
        expect(JSON.stringify(args), path).not.toContain('webContents')
      }
      off()
    }
  })

  it('returns an unsubscribe that removes the exact listener', () => {
    for (const [path, subscribe] of subscriptions(exposed)) {
      const before = totalListeners()
      const off = subscribe(() => {})
      expect(totalListeners(), path).toBe(before + 1)
      expect(typeof off, path).toBe('function')
      off()
      expect(totalListeners(), path).toBe(before)
    }
  })

  it('leaves one listener after repeated mount and unmount', () => {
    for (const [path, subscribe] of subscriptions(exposed)) {
      const before = totalListeners()
      for (let i = 0; i < 5; i++) subscribe(() => {})()
      const off = subscribe(() => {})
      expect(totalListeners(), path).toBe(before + 1)
      off()
    }
  })
})

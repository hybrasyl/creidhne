import { describe, it, expect, beforeEach } from 'vitest'
import { pathToFileURL } from 'url'
import {
  initWindowSecurity,
  registerTrustedWindow,
  isSenderAllowed,
  hardenWindow,
  guardIpc,
  __resetWindowSecurityForTests
} from '../windowSecurity.js'

// A Windows install path with a SPACE — the case that turns a naive string-concat
// trusted location into a silent lockout. pathToFileURL must round-trip it.
const PROD_HTML =
  'C:\\Users\\a b\\AppData\\Local\\Programs\\creidhne\\resources\\app.asar\\out\\renderer\\index.html'
const PROD_URL = pathToFileURL(PROD_HTML).href
const DEV_URL = 'http://localhost:5173/'

// Fakes — no electron import. A webContents has an id, a mainFrame, an
// isDestroyed(), and a one-shot 'destroyed' emitter (what registerTrustedWindow uses).
function makeContents(id, url, { destroyed = false } = {}) {
  const cbs = []
  return {
    id,
    mainFrame: { url },
    isDestroyed: () => destroyed,
    once(evt, cb) {
      if (evt === 'destroyed') cbs.push(cb)
    },
    emitDestroyed() {
      cbs.forEach((cb) => cb())
    }
  }
}
function eventFor(contents, frame = contents.mainFrame) {
  return { sender: contents, senderFrame: frame }
}
function register(contents) {
  registerTrustedWindow({ webContents: contents })
}

beforeEach(() => __resetWindowSecurityForTests())

describe('isSenderAllowed', () => {
  it('fails CLOSED before initWindowSecurity runs', () => {
    const c = makeContents(1, PROD_URL)
    register(c)
    // No init: trustedLocations is empty, so even a registered window is rejected.
    expect(isSenderAllowed(eventFor(c))).toBe(false)
  })

  it('accepts the top frame of a registered window at a trusted prod location', () => {
    initWindowSecurity(undefined, PROD_HTML)
    const c = makeContents(1, PROD_URL)
    register(c)
    expect(isSenderAllowed(eventFor(c))).toBe(true)
  })

  it('matches a prod path containing a space (lockout regression)', () => {
    initWindowSecurity(undefined, PROD_HTML)
    expect(PROD_URL).toContain('%20') // proof the fixture path really has a space
    const c = makeContents(1, PROD_URL)
    register(c)
    expect(isSenderAllowed(eventFor(c))).toBe(true)
  })

  it('ignores query and hash on the sender URL', () => {
    initWindowSecurity(undefined, PROD_HTML)
    const c = makeContents(1, `${PROD_URL}?window=x#section`)
    register(c)
    expect(isSenderAllowed(eventFor(c))).toBe(true)
  })

  it('rejects an unregistered window even at a trusted location', () => {
    initWindowSecurity(undefined, PROD_HTML)
    const c = makeContents(9, PROD_URL) // never registered
    expect(isSenderAllowed(eventFor(c))).toBe(false)
  })

  it('rejects a subframe (senderFrame is not the main frame)', () => {
    initWindowSecurity(undefined, PROD_HTML)
    const c = makeContents(1, PROD_URL)
    register(c)
    const iframe = { url: PROD_URL } // inherits the preload, but is not mainFrame
    expect(isSenderAllowed(eventFor(c, iframe))).toBe(false)
  })

  it('rejects a window that has navigated away from our content', () => {
    initWindowSecurity(undefined, PROD_HTML)
    const c = makeContents(1, 'https://evil.example/')
    register(c)
    expect(isSenderAllowed(eventFor(c))).toBe(false)
  })

  it('rejects a destroyed sender', () => {
    initWindowSecurity(undefined, PROD_HTML)
    const c = makeContents(1, PROD_URL, { destroyed: true })
    register(c)
    expect(isSenderAllowed(eventFor(c))).toBe(false)
  })

  it('forgets a window when its webContents is destroyed (reused id gets no trust)', () => {
    initWindowSecurity(undefined, PROD_HTML)
    const c = makeContents(1, PROD_URL)
    register(c)
    expect(isSenderAllowed(eventFor(c))).toBe(true)
    c.emitDestroyed()
    expect(isSenderAllowed(eventFor(c))).toBe(false)
  })

  it('trusts the dev URL when one is given', () => {
    initWindowSecurity(DEV_URL, PROD_HTML)
    const c = makeContents(1, DEV_URL)
    register(c)
    expect(isSenderAllowed(eventFor(c))).toBe(true)
  })

  it('ignores a malformed dev URL and still trusts prod', () => {
    initWindowSecurity('http://[not a url', PROD_HTML)
    const c = makeContents(1, PROD_URL)
    register(c)
    expect(isSenderAllowed(eventFor(c))).toBe(true)
  })
})

describe('guardIpc', () => {
  function fakeIpcMain() {
    const handlers = {}
    const listeners = {}
    return {
      handle(ch, fn) {
        handlers[ch] = fn
      },
      on(ch, fn) {
        ;(listeners[ch] ??= []).push(fn)
      },
      removeListener(ch, fn) {
        listeners[ch] = (listeners[ch] ?? []).filter((f) => f !== fn)
      },
      removeHandler(ch) {
        delete handlers[ch]
      },
      _handlers: handlers,
      _listeners: listeners
    }
  }

  function trustedEvent() {
    initWindowSecurity(undefined, PROD_HTML)
    const c = makeContents(1, PROD_URL)
    register(c)
    return eventFor(c)
  }

  it('handle: runs the listener for a trusted sender, throws for an untrusted one', () => {
    const raw = fakeIpcMain()
    const ipc = guardIpc(raw)
    ipc.handle('do:thing', () => 'ok')
    const good = trustedEvent()
    const bad = eventFor(makeContents(9, PROD_URL)) // unregistered

    expect(raw._handlers['do:thing'](good, 1, 2)).toBe('ok')
    expect(() => raw._handlers['do:thing'](bad)).toThrow(/untrusted sender/)
  })

  it('on: calls the listener for a trusted sender, silently drops an untrusted one', () => {
    const raw = fakeIpcMain()
    const ipc = guardIpc(raw)
    let calls = 0
    ipc.on('fire', () => {
      calls++
    })
    const good = trustedEvent()
    raw._listeners['fire'][0](good)
    raw._listeners['fire'][0](eventFor(makeContents(9, PROD_URL)))
    expect(calls).toBe(1)
  })

  it('removeListener: unregisters the wrapper the guard installed', () => {
    const raw = fakeIpcMain()
    const ipc = guardIpc(raw)
    const listener = () => {}
    ipc.on('fire', listener)
    expect(raw._listeners['fire']).toHaveLength(1)
    ipc.removeListener('fire', listener)
    expect(raw._listeners['fire']).toHaveLength(0)
  })

  it('passes other members through to the raw ipcMain', () => {
    const raw = fakeIpcMain()
    const ipc = guardIpc(raw)
    ipc.handle('x', () => {})
    ipc.removeHandler('x')
    expect(raw._handlers['x']).toBeUndefined()
  })
})

describe('hardenWindow', () => {
  function fakeWin() {
    const listeners = {}
    let openHandler = null
    return {
      webContents: {
        setWindowOpenHandler(fn) {
          openHandler = fn
        },
        on(evt, fn) {
          listeners[evt] = fn
        }
      },
      _fireWillNavigate(event, url) {
        listeners['will-navigate'](event, url)
      },
      _openHandler: () => openHandler
    }
  }

  it('denies every child window and opens only safe external URLs', () => {
    const win = fakeWin()
    const opened = []
    hardenWindow(win, { allowExternal: true, openExternal: (u) => opened.push(u) })

    expect(win._openHandler()({ url: 'https://example.com' })).toEqual({ action: 'deny' })
    expect(win._openHandler()({ url: 'file:///etc/passwd' })).toEqual({ action: 'deny' })
    expect(opened).toEqual(['https://example.com']) // file: was denied AND not opened
  })

  it('will-navigate: allows our own content, blocks + externalizes the rest', () => {
    initWindowSecurity(undefined, PROD_HTML)
    const win = fakeWin()
    const opened = []
    hardenWindow(win, { allowExternal: true, openExternal: (u) => opened.push(u) })

    const ownNav = { preventDefault: () => expect.fail('own content must not be prevented') }
    win._fireWillNavigate(ownNav, PROD_URL)

    let prevented = false
    win._fireWillNavigate({ preventDefault: () => (prevented = true) }, 'https://example.com')
    expect(prevented).toBe(true)
    expect(opened).toEqual(['https://example.com'])
  })
})

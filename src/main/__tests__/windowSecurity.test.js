import { describe, it, expect, beforeEach } from 'vitest'
import { pathToFileURL, fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import {
  initWindowSecurity,
  registerTrustedWindow,
  isSenderAllowed,
  hardenWindow,
  guardIpc,
  installContentSecurityPolicy,
  withContentSecurityPolicy,
  RENDERER_CSP,
  DEV_RENDERER_CSP,
  SPLASH_CSP,
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

  it('rejects a remote file:// host whose path mirrors our own', () => {
    // A file: URL has the opaque origin "null", so the old origin-based check
    // was "null" === "null" and carried NO host information — leaving the
    // pathname as the only discriminator. A page served from an attacker's SMB
    // share at a mirroring path was therefore accepted as our own content, with
    // our preload attached. Reachable on the dmg and linux targets; Windows is
    // spared only because `C:` cannot be a UNC share name, which is an accident
    // of the path shape rather than a protection.
    initWindowSecurity(undefined, PROD_HTML)

    // Build the adversary from the trusted URL's OWN pathname so the two differ
    // in host and nothing else. A hand-written POSIX literal would pass for the
    // wrong reason here: on win32 pathToFileURL('/opt/x') resolves against the
    // current drive and yields '/E:/opt/x', which never matched regardless.
    const trustedUrl = new URL(PROD_URL)
    const remote = `file://attacker.example${trustedUrl.pathname}`
    expect(trustedUrl.origin).toBe('null') // the reason this was a trap
    expect(new URL(remote).origin).toBe('null') // ...and why the two compared equal
    expect(new URL(remote).pathname).toBe(trustedUrl.pathname) // differ only in host

    const c = makeContents(1, remote)
    register(c)
    expect(isSenderAllowed(eventFor(c))).toBe(false)

    // ...and the genuine local path still matches, so the fix did not overshoot.
    const local = makeContents(2, PROD_URL)
    register(local)
    expect(isSenderAllowed(eventFor(local))).toBe(true)
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

  it('will-navigate: blocks a remote file:// host mirroring our path', () => {
    // The other half of the opaque-origin hole: the navigation guard shares
    // isTrustedLocation with the IPC check, so it was equally fooled. Blocked
    // and NOT handed to the OS — file: is not a safe external scheme.
    initWindowSecurity(undefined, PROD_HTML)
    const win = fakeWin()
    const opened = []
    hardenWindow(win, { allowExternal: true, openExternal: (u) => opened.push(u) })

    const remote = `file://attacker.example${new URL(PROD_URL).pathname}`
    let prevented = false
    win._fireWillNavigate({ preventDefault: () => (prevented = true) }, remote)
    expect(prevented).toBe(true)
    expect(opened).toEqual([])
  })
})

// ── Content-Security-Policy (HTOO-371) ──────────────────────────────────────

describe('content security policy', () => {
  // The two HTML files carry a copy of the policy as a meta tag, because a static
  // file cannot import a constant. A copy drifts, and a drifted CSP is invisible:
  // the header still applies, so the app behaves correctly and the tag quietly
  // stops describing it. These read the files.
  const readRepoFile = (rel) =>
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', rel), 'utf8')

  const metaContent = (html) => {
    const m = /http-equiv="Content-Security-Policy"\s*\n?\s*content="([^"]+)"/.exec(html)
    return m?.[1]
  }

  it('finds a meta policy in both documents', () => {
    // Guards the regex. If the tag is reformatted so this stops matching, the two
    // comparisons below would compare undefined to undefined and pass.
    expect(metaContent(readRepoFile('src/renderer/index.html')), 'renderer meta').toBeTruthy()
    expect(metaContent(readRepoFile('resources/splash.html')), 'splash meta').toBeTruthy()
  })

  it('keeps the renderer meta tag in step with RENDERER_CSP', () => {
    expect(metaContent(readRepoFile('src/renderer/index.html'))).toBe(RENDERER_CSP)
  })

  it('keeps the splash meta tag in step with SPLASH_CSP', () => {
    expect(metaContent(readRepoFile('resources/splash.html'))).toBe(SPLASH_CSP)
  })

  it('no longer allows remote images', () => {
    // The card's third item, and the single biggest loosening in the policy that
    // shipped. Pinned so it cannot come back without a reason: the renderer loads
    // one bundled logo, and every sprite is painted onto a canvas from bytes that
    // arrived over IPC, which img-src does not govern.
    expect(RENDERER_CSP).not.toMatch(/img-src[^;]*https?:/)
    expect(SPLASH_CSP).not.toMatch(/img-src[^;]*https?:/)
  })

  it('denies scripts entirely on the splash', () => {
    expect(SPLASH_CSP).toContain("default-src 'none'")
    expect(SPLASH_CSP).not.toContain('script-src')
    expect(SPLASH_CSP).not.toContain('unsafe-eval')
  })

  it('relaxes script-src in the dev policy only', () => {
    // Vite's react plugin injects its refresh preamble as an inline script, ahead
    // of the meta tag. The relaxation is real and is why the two strings differ;
    // this pins that it stays confined to dev.
    expect(DEV_RENDERER_CSP).toContain("'unsafe-inline'")
    expect(RENDERER_CSP).not.toMatch(/script-src[^;]*unsafe-inline/)
    expect(RENDERER_CSP).not.toContain('unsafe-eval')
  })

  it('sets the policy on a policed response', () => {
    const out = withContentSecurityPolicy(PROD_URL, { 'X-Other': ['keep'] })
    expect(out['Content-Security-Policy']).toEqual([RENDERER_CSP])
    expect(out['X-Other']).toEqual(['keep'])
  })

  it('replaces any policy already on the response, whatever its case', () => {
    // Two CSP headers INTERSECT rather than override, so leaving one would make
    // the effective policy a function of whatever else set it.
    const out = withContentSecurityPolicy(PROD_URL, {
      'content-security-policy': ["default-src 'unsafe-inline'"],
      'Content-Security-Policy-Report-Only': ['whatever']
    })
    expect(Object.keys(out)).toEqual(['Content-Security-Policy'])
    expect(out['Content-Security-Policy']).toEqual([RENDERER_CSP])
  })

  it('gives the splash its own policy, not the renderer’s', () => {
    // A literal file URL, NOT pathToFileURL. A Windows path handed to
    // pathToFileURL on POSIX is a relative path whose backslashes are ordinary
    // filename characters, so the pathname ends `\splash.html` and the check
    // correctly does not match — the test would fail on Linux and macOS while
    // passing on Windows. Same family as the win32 trap noted above, and the
    // reason this file builds URLs rather than paths wherever the assertion is
    // about the URL.
    const splashUrl = 'file:///C:/a%20b/resources/splash.html'
    expect(new URL(splashUrl).pathname.endsWith('/splash.html')).toBe(true)
    expect(withContentSecurityPolicy(splashUrl, {})['Content-Security-Policy']).toEqual([
      SPLASH_CSP
    ])
  })

  it('gives a posix-installed splash its own policy too', () => {
    // The deb and AppImage targets install under /opt, so the packaged splash URL
    // has no drive letter. Both shapes, since the platform this runs on must not
    // decide which one is covered.
    const posix = 'file:///opt/Creidhne/resources/splash.html'
    expect(withContentSecurityPolicy(posix, {})['Content-Security-Policy']).toEqual([SPLASH_CSP])
  })

  it('does not mistake a file merely named like the splash for it', () => {
    // `endsWith('/splash.html')` and not `includes`: a renderer asset called
    // `not-splash.html` must keep the renderer policy rather than silently
    // inheriting one with no script-src.
    const near = 'file:///opt/Creidhne/resources/not-splash.html'
    expect(withContentSecurityPolicy(near, {})['Content-Security-Policy']).toEqual([RENDERER_CSP])
  })

  it('leaves non-app schemes alone', () => {
    // devtools: most of all — a default-src 'self' breaks the inspector, and that
    // content is not ours to police.
    expect(withContentSecurityPolicy('devtools://devtools/bundled/x.js', {})).toBeUndefined()
    expect(withContentSecurityPolicy('chrome-extension://abc/y.js', {})).toBeUndefined()
  })

  it('polices a URL it cannot parse rather than letting it through', () => {
    // Fails closed, like the rest of this file. The header can only restrict.
    const out = withContentSecurityPolicy('not a url', {})
    expect(out['Content-Security-Policy']).toEqual([RENDERER_CSP])
  })

  it('installs one headers hook on the session', () => {
    const calls = []
    const fakeSession = { webRequest: { onHeadersReceived: (fn) => calls.push(fn) } }
    installContentSecurityPolicy(fakeSession, DEV_RENDERER_CSP)
    expect(calls).toHaveLength(1)

    let got
    calls[0]({ url: DEV_URL, responseHeaders: {} }, (r) => (got = r))
    expect(got.responseHeaders['Content-Security-Policy']).toEqual([DEV_RENDERER_CSP])
  })

  it('passes an empty object through when it declines to police', () => {
    // callback({}) leaves the response untouched; callback({responseHeaders})
    // replaces them. Sending the wrong one strips every header on a devtools load.
    const calls = []
    installContentSecurityPolicy({ webRequest: { onHeadersReceived: (fn) => calls.push(fn) } })
    let got
    calls[0]({ url: 'devtools://devtools/x.js', responseHeaders: { A: ['b'] } }, (r) => (got = r))
    expect(got).toEqual({})
  })
})

// ─── the call-site, in index.js ──────────────────────────────────────────────

describe('the CSP call site in index.js', () => {
  // The unit tests above prove the header string and the installer. Neither can
  // see whether `index.js` still CALLS the installer, or whether it calls it
  // before a window loads — and a policy installed after the document is already
  // loading is a policy that document never had. That failure is silent: the app
  // runs, the meta tag still applies, and only the splash quietly loses its
  // policy entirely.
  //
  // Same shape and the same argument as `remoteSession.test.js`'s call-site
  // guard, including the comment stripping: prose above a call must not be able
  // to invert an offset measurement.
  const INDEX = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.js')

  function codeOnly() {
    return readFileSync(INDEX, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
  }

  it('strips comments, so prose above the call cannot invert the measurement', () => {
    // Guards the helper, not today's file: the assertions below read offsets out
    // of source, and this file's comments name every symbol they measure.
    const stripped = codeOnly()
    expect(stripped).not.toMatch(/A meta policy is applied by the parser/)
    expect(stripped).toContain('installContentSecurityPolicy(')
  })

  it('installs the policy on the default session', () => {
    expect(codeOnly()).toMatch(/installContentSecurityPolicy\(\s*session\.defaultSession/)
  })

  it('installs it before either window loads', () => {
    const code = codeOnly()
    const install = code.indexOf('installContentSecurityPolicy(')
    const splash = code.indexOf('createSplashWindow(')
    // The CALL, not the declaration: `function createWindow()` contains the same
    // substring and sits ~1200 lines earlier, which made the naive indexOf
    // measure the definition and fail on correct code. A guard that fails on a
    // correct file gets deleted rather than fixed.
    const main = code.search(/(?<!function )createWindow\(\)/)
    expect(install, 'the CSP installer is gone from index.js').toBeGreaterThan(-1)
    expect(splash, 'createSplashWindow() is gone from index.js').toBeGreaterThan(-1)
    expect(main, 'createWindow() is gone from index.js').toBeGreaterThan(-1)
    expect(install, 'the splash loads before the CSP is installed').toBeLessThan(splash)
    expect(install, 'the main window loads before the CSP is installed').toBeLessThan(main)
  })

  it('passes the dev policy only under the dev server', () => {
    // The two policies differ, and shipping the dev one would relax `script-src`
    // in the packaged app — the single worst outcome available here.
    const code = codeOnly()
    expect(code).toMatch(
      /is\.dev && process\.env\['ELECTRON_RENDERER_URL'\] \? DEV_RENDERER_CSP : RENDERER_CSP/
    )
  })
})

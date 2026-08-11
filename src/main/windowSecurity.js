// Renderer-boundary hardening, kept in ONE place so the policy is single-sourced
// and auditable rather than scattered across window constructors.
//
// Ported from epona's `windowSecurity.js` (itself from dagda/mabon's WP18 pass).
// Creidhne has two windows — the main window and a splash — and the splash has no
// preload at all, so it cannot send IPC and there is nothing to grade. One
// trusted window, no roles, no channel allowlist.
//
// Four protections:
//
//   1. hardenWindow()  — deny top-level navigation away from our own content, and
//      deny every child window, handing validated external URLs to the OS instead.
//   2. guardIpc()      — wrap ipcMain so every handler rejects an IPC whose sender
//      is not the top frame of a known Creidhne window at our own location.
//   3. Trusted-window bookkeeping that forgets a window when its webContents dies,
//      so a reused id cannot inherit trust.
//   4. installContentSecurityPolicy() — put the CSP on the RESPONSE, so it is in
//      force before a document runs rather than once parsing reaches a meta tag,
//      and so it covers the splash, which shipped with no policy of its own.
//
// This is a SECOND gate. The path-safety checks (pathSafety.js) and the zod
// schemas at each handler still validate every payload; nothing here replaces them.

import { pathToFileURL } from 'url'
import { isSafeExternalUrl } from '../shared/externalUrl.js'

/**
 * The packaged renderer's Content-Security-Policy, single-sourced here.
 *
 * **`http:` and `https:` are gone from `img-src`** (HTOO-371). They were the
 * single biggest loosening in the policy that shipped, and the audit behind the
 * card asked whether they were still load-bearing. They are not: the renderer
 * loads exactly one `<img>`, a bundled logo, and it resolves to `file:` in the
 * packaged app. Sprites never become image URLs at all — every picker decodes
 * bytes that arrive over IPC and paints them onto a canvas, which `img-src` does
 * not govern. The only remote URLs in the renderer are link targets handed to
 * the OS by `shell.openExternal`, and those are not page loads.
 *
 * What stays, and why each one earns it:
 * - `file:` — the packaged document and its assets.
 * - `data:` — Vite inlines an asset under `assetsInlineLimit` (4 KB) as a base64
 *   URI. The logo is 17 KB so it is emitted as a file today, but that is a build
 *   threshold rather than a guarantee, and a smaller asset added later would
 *   break with no obvious cause.
 * - `blob:` on `media-src` — `soundData.js` plays sound effects through
 *   `URL.createObjectURL`.
 *
 * **This string is duplicated as a `<meta http-equiv>` in
 * `src/renderer/index.html`, and the duplication is deliberate.** A static HTML
 * file cannot import a JS constant, and the tag is worth keeping as a second
 * layer: it survives a session this code never touches. `windowSecurity.test.js`
 * reads that file and asserts it still matches this constant, so the two copies
 * cannot drift silently.
 */
export const RENDERER_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' file: data:; media-src 'self' blob:; " +
  "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none';"

/**
 * The policy for `npm run dev`, where Vite serves the renderer over http.
 *
 * **`script-src` is relaxed here and nowhere else.** `@vitejs/plugin-react`
 * injects its refresh preamble as an *inline* script with `head-prepend` —
 * before the meta tag in `index.html`. That is exactly why the meta policy never
 * blocked it and why a header would: a meta policy governs only what the parser
 * reaches after it, and a header governs the whole response. The preamble is
 * genuinely inline, so allowing it is the only way to keep the dev server
 * working. `'unsafe-eval'` goes with it because dependency pre-bundling can emit
 * `eval`, and `ws:` because HMR is a websocket.
 *
 * **The two policies differ, so a `script-src` violation cannot surface in dev.**
 * That is the cost of a dev server that injects inline scripts, and it is the
 * reason the packaged policy is pinned by tests and by the meta tag rather than
 * trusted to be exercised by hand.
 */
export const DEV_RENDERER_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
  "style-src 'self' 'unsafe-inline'; img-src 'self' file: data: blob:; " +
  "media-src 'self' blob:; connect-src 'self' ws: http: https:; " +
  "object-src 'none'; base-uri 'none'; form-action 'none';"

/**
 * The splash's policy, which is much narrower than the renderer's because the
 * splash is much smaller: `splash.html` has no preload, no bridge, no script tag
 * of any kind, one local image and one inline `<style>`.
 *
 * So `default-src 'none'` and no `script-src` allowance at all. The exposure
 * today is nil — the content is entirely ours. It is worth having anyway for the
 * reason the card gives: this is the file a future change is most likely to add
 * a font, an image or a script to, and the one place where nobody would notice
 * there was no policy to violate.
 *
 * `img-src file:` rather than `'self'`: the splash is always loaded with
 * `loadFile`, and `'self'` against an opaque `file:` origin is not something to
 * rely on.
 */
export const SPLASH_CSP =
  "default-src 'none'; img-src file: data:; style-src 'unsafe-inline'; " +
  "base-uri 'none'; form-action 'none'; frame-ancestors 'none';"

/**
 * Schemes our own documents and their subresources load over: `file:` packaged,
 * `http:`/`https:` for the dev server.
 *
 * An allowlist rather than a denylist, because the alternative stamps a policy
 * on Chromium's own internal responses — `devtools:` most of all, where a
 * `default-src 'self'` breaks the inspector for no security gain, since that
 * content is not ours to police.
 */
const POLICED_PROTOCOLS = new Set(['file:', 'http:', 'https:'])

/** True for the splash document, which gets the narrower policy. */
function isSplashUrl(rawUrl) {
  try {
    return new URL(rawUrl).pathname.endsWith('/splash.html')
  } catch {
    return false
  }
}

/**
 * The response headers to send back, or `undefined` to leave the response
 * untouched. Exported for direct unit testing — a CSP is only worth having if
 * the exact header that reaches the document is pinned.
 *
 * Any policy already on the response is REPLACED, header names being compared
 * case-insensitively. Two CSP headers intersect rather than override, so leaving
 * one in place would make the effective policy a function of whatever else set
 * it; the report-only variant is dropped for the same reason, since a stale one
 * reports against a policy we no longer send.
 *
 * A URL that will not parse gets a policy rather than escaping one. The rest of
 * this file fails closed and so does this: the header can only restrict.
 */
export function withContentSecurityPolicy(rawUrl, responseHeaders, policy = RENDERER_CSP) {
  try {
    if (!POLICED_PROTOCOLS.has(new URL(rawUrl).protocol)) return undefined
  } catch {
    /* unparseable — fall through and police it */
  }
  const next = {}
  for (const [name, value] of Object.entries(responseHeaders ?? {})) {
    const lower = name.toLowerCase()
    if (lower === 'content-security-policy') continue
    if (lower === 'content-security-policy-report-only') continue
    next[name] = value
  }
  next['Content-Security-Policy'] = [isSplashUrl(rawUrl) ? SPLASH_CSP : policy]
  return next
}

/**
 * Put a CSP on every response this session serves for our own content.
 *
 * Call once, on `session.defaultSession`, before any window loads — the point of
 * a header over a meta tag is that it is in force for the response itself, and a
 * document already loading has passed it.
 *
 * `policy` is the RENDERER policy; the splash always gets `SPLASH_CSP` whichever
 * is passed, because its needs do not change between dev and packaged. The
 * caller passes `DEV_RENDERER_CSP` under the dev server and only there.
 */
export function installContentSecurityPolicy(session, policy = RENDERER_CSP) {
  session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = withContentSecurityPolicy(details.url, details.responseHeaders, policy)
    callback(responseHeaders ? { responseHeaders } : {})
  })
}

/**
 * Locations we consider "our own content", as `locationKey` strings. Query and
 * hash are ignored so a future `?window=x` variant still matches.
 *
 * Empty until `initWindowSecurity` runs, which fails CLOSED: before init nothing
 * is trusted, so a handler registered too early rejects rather than admits.
 */
let trustedLocations = []

/**
 * Reduce a URL to the key we compare on: scheme, host and path, with query and
 * hash dropped. One place, so init and lookup cannot disagree.
 *
 * **`host` explicitly, NOT `origin`.** The WHATWG parser returns the opaque
 * origin `"null"` for every `file:` URL, so an origin comparison is
 * `"null" === "null"` in the packaged app — it carries no host information at
 * all, leaving the pathname as the only discriminator. That is enough to trust
 * a REMOTE host: `file://attacker.example/opt/Creidhne/…/index.html` and the
 * local `file:///opt/Creidhne/…/index.html` compare equal, so a page served
 * from an attacker's SMB share would satisfy both the `will-navigate` guard and
 * the IPC sender check — with our preload attached. Comparing `host` closes it;
 * a local `file:` URL has an empty host, which still distinguishes it from a
 * UNC one.
 *
 * Windows happens to be spared — the install path starts with a drive letter
 * and `C:` is not a legal UNC share name — but that is an accident of the path
 * shape, not a protection, and it does not hold for the Linux or macOS targets.
 *
 * For `http`/`https` this is identical to `origin` (the parser normalizes the
 * default port away), so nothing changes on the dev-server path.
 */
function locationKey(url) {
  return `${url.protocol}//${url.host}${url.pathname}`
}

/**
 * webContents.id values for windows we constructed. An IPC from a webContents
 * absent from this set — a devtools extension, an unexpected frame, anything we
 * did not create — is rejected outright.
 */
const trustedWindows = new Set()

/**
 * Record the renderer locations we trust. Call once at boot, before any window
 * loads. `devUrl` is `ELECTRON_RENDERER_URL` under `electron-vite dev` and
 * undefined otherwise; `prodIndexHtml` is the absolute path passed to `loadFile`.
 */
export function initWindowSecurity(devUrl, prodIndexHtml) {
  const locations = []
  if (devUrl) {
    try {
      locations.push(locationKey(new URL(devUrl)))
    } catch {
      // Malformed dev URL — leave it out and fail closed rather than guess.
    }
  }
  // pathToFileURL, never string concatenation. A path containing a space, a `#`
  // or a non-ASCII character produces a different file URL than the naive form,
  // and a trusted location that never matches is a LOCKOUT — every IPC rejected,
  // the app dead on arrival — not a safety margin. Creidhne installs under a path
  // that can contain the user's name.
  locations.push(locationKey(pathToFileURL(prodIndexHtml)))
  trustedLocations = locations
}

/** True when `rawUrl` points at our own renderer content. */
function isTrustedLocation(rawUrl) {
  let key
  try {
    key = locationKey(new URL(rawUrl))
  } catch {
    return false // about:blank, a bare string, anything malformed
  }
  return trustedLocations.includes(key)
}

/**
 * Register a window we created, so its IPC is accepted. Forgotten when its
 * webContents is destroyed — Electron reuses ids, and a stale entry would hand
 * trust to whatever gets that id next.
 */
export function registerTrustedWindow(win) {
  const id = win.webContents.id
  trustedWindows.add(id)
  win.webContents.once('destroyed', () => trustedWindows.delete(id))
}

/**
 * Deny top-level navigation and every child window.
 *
 * `openExternal` is injected rather than imported so this module stays free of
 * an `electron` import and the unit tests need no electron stub. A navigation to
 * an outside URL is handed to the browser instead of merely blocked — otherwise
 * a plain `<a href>` in the renderer would silently do nothing.
 */
export function hardenWindow(win, { allowExternal, openExternal }) {
  win.webContents.setWindowOpenHandler((details) => {
    if (allowExternal && isSafeExternalUrl(details.url)) openExternal(details.url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (isTrustedLocation(url)) return // our own content — e.g. a dev HMR full reload
    event.preventDefault()
    if (allowExternal && isSafeExternalUrl(url)) openExternal(url)
  })
}

/**
 * The authority check: accept an IPC only from the top frame of a known Creidhne
 * window, at one of our own locations. Exported for direct unit testing.
 */
export function isSenderAllowed(event) {
  const contents = event.sender
  if (!contents || contents.isDestroyed()) return false
  if (!trustedWindows.has(contents.id)) return false
  // Must be the window's OWN top frame. An iframe inherits the preload, so a
  // subframe reaching a privileged channel is exactly what this rejects.
  const frame = event.senderFrame
  if (!frame || frame !== contents.mainFrame) return false
  return isTrustedLocation(frame.url)
}

/**
 * Wrap `ipcMain` so `.handle` / `.on` reject an untrusted sender before the real
 * handler runs. An `invoke` rejection surfaces as an error in the renderer; a
 * fire-and-forget `.on` is dropped silently.
 *
 * Returned as a Proxy so call sites read as ordinary `ipcMain` usage — the point
 * is that a handler added later is covered by construction rather than by
 * remembering to opt in.
 */
export function guardIpc(ipcMain) {
  const wrappers = new WeakMap()

  return new Proxy(ipcMain, {
    get(target, prop, receiver) {
      if (prop === 'handle') {
        return (channel, listener) => {
          target.handle(channel, (event, ...args) => {
            if (!isSenderAllowed(event)) {
              throw new Error(`IPC "${channel}" rejected: untrusted sender`)
            }
            return listener(event, ...args)
          })
        }
      }
      if (prop === 'on') {
        return (channel, listener) => {
          const wrapped = (event, ...args) => {
            if (!isSenderAllowed(event)) return
            listener(event, ...args)
          }
          wrappers.set(listener, wrapped)
          target.on(channel, wrapped)
          return receiver
        }
      }
      // `.on` registered a wrapper, so removal has to be remapped or it silently
      // removes nothing and the listener stays live.
      if (prop === 'off' || prop === 'removeListener') {
        return (channel, listener) => {
          target.removeListener(channel, wrappers.get(listener) ?? listener)
          return receiver
        }
      }
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
}

/** Test-only reset, so suites do not leak trusted state between cases. */
export function __resetWindowSecurityForTests() {
  trustedLocations = []
  trustedWindows.clear()
}

// Renderer-boundary hardening, kept in ONE place so the policy is single-sourced
// and auditable rather than scattered across window constructors.
//
// Ported from epona's `windowSecurity.js` (itself from dagda/mabon's WP18 pass).
// Creidhne has two windows — the main window and a splash — and the splash has no
// preload at all, so it cannot send IPC and there is nothing to grade. One
// trusted window, no roles, no channel allowlist.
//
// Three protections:
//
//   1. hardenWindow()  — deny top-level navigation away from our own content, and
//      deny every child window, handing validated external URLs to the OS instead.
//   2. guardIpc()      — wrap ipcMain so every handler rejects an IPC whose sender
//      is not the top frame of a known Creidhne window at our own location.
//   3. Trusted-window bookkeeping that forgets a window when its webContents dies,
//      so a reused id cannot inherit trust.
//
// This is a SECOND gate. The path-safety checks (pathSafety.js) and the zod
// schemas at each handler still validate every payload; nothing here replaces them.

import { pathToFileURL } from 'url'
import { isSafeExternalUrl } from '../shared/externalUrl.js'

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

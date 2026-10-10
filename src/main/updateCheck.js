// house module: update-check v1 — change it in the template, then port
//
// Main-process half of the update check (HTOO-65, HTOO-382). Design:
// Comhaigne docs/architecture/update-check-module.md. JavaScript port of the
// template's src/main/updateCheck.ts.
//
// One GET of the house version manifest, with no authentication. It sends no
// user data and no identifier beyond a User-Agent. It only NOTICES a release:
// nothing here downloads or installs anything.
//
// The manifest replaces GitHub's releases API. That API answers 404, not 403, for
// a private repo, so the old check read "no releases" forever and said nothing.
// The manifest lives in the public issue repo, so repo visibility does not matter.
//
// Two triggers, both from the renderer: once after start, and the Check for
// updates button. There is no timer (Sabrael, 2026-09-28).

import { MANIFEST_URL, readManifest } from '../shared/updateVersion.js'

/** Long enough for a slow network, short enough that a hung request ends. */
export const UPDATE_CHECK_TIMEOUT_MS = 10_000

/**
 * Never throws: every failure comes back as `{ ok: false, reason }`.
 *
 * @param {object} opts
 * @param {string} opts.currentVersion
 * @param {string} opts.updateKey
 * @param {string} opts.releaseUrlPrefix
 * @param {typeof fetch} [opts.fetchImpl] Inject `net.fetch` in production, so the
 *   request uses the system proxy and the OS certificate store. Tests inject a double.
 * @param {number} [opts.timeoutMs]
 * @param {string} [opts.manifestUrl] Tests only; production uses the house constant.
 * @returns {Promise<import('../shared/updateVersion.js').UpdateCheckResult>}
 */
export async function checkForUpdate(opts) {
  const fetchImpl = opts.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? UPDATE_CHECK_TIMEOUT_MS)
  try {
    const res = await fetchImpl(opts.manifestUrl ?? MANIFEST_URL, {
      headers: { Accept: 'application/json', 'User-Agent': opts.updateKey },
      signal: controller.signal,
      cache: 'no-store'
    })
    if (!res.ok) return { ok: false, reason: 'http' }
    let data
    try {
      data = await res.json()
    } catch {
      return { ok: false, reason: 'malformed' }
    }
    return readManifest(data, opts.updateKey, opts.releaseUrlPrefix, opts.currentVersion)
  } catch {
    return { ok: false, reason: controller.signal.aborted ? 'timeout' : 'offline' }
  } finally {
    clearTimeout(timer)
  }
}

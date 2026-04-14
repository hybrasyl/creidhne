const RELEASES_URL = 'https://api.github.com/repos/hybrasyl/creidhne/releases/latest'
const TIMEOUT_MS = 10_000

function parseVersion(raw) {
  if (!raw) return null
  const cleaned = String(raw).trim().replace(/^v/i, '')
  const parts = cleaned.split('-')[0].split('.').map((p) => parseInt(p, 10))
  if (parts.length < 1 || parts.some((n) => Number.isNaN(n))) return null
  while (parts.length < 3) parts.push(0)
  return parts
}

function isNewer(latest, current) {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  if (!a || !b) return false
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}

export async function checkForUpdates(currentVersion) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(RELEASES_URL, {
      headers: {
        'User-Agent': 'creidhne-update-check',
        Accept: 'application/vnd.github+json',
      },
      signal: controller.signal,
    })
    if (res.status === 404) {
      return { ok: true, updateAvailable: false, currentVersion, latestVersion: null, reason: 'no-releases' }
    }
    if (!res.ok) {
      return { ok: false, error: `GitHub responded with ${res.status}` }
    }
    const data = await res.json()
    if (data.draft || data.prerelease) {
      return { ok: true, updateAvailable: false, currentVersion, latestVersion: null, reason: 'prerelease-only' }
    }
    const latestVersion = data.tag_name
    return {
      ok: true,
      updateAvailable: isNewer(latestVersion, currentVersion),
      currentVersion,
      latestVersion,
      releaseUrl: data.html_url,
      releaseName: data.name,
      releaseNotes: data.body,
    }
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : (err.message || String(err)) }
  } finally {
    clearTimeout(timer)
  }
}

export const __testing = { parseVersion, isNewer }

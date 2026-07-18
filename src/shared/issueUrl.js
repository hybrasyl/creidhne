// Pure GitHub "new issue" URL construction + length-budget truncation. No
// node/electron imports. `shell.openExternal` is only reliable up to ~2 KB, so a
// long diagnostics body must be trimmed for the URL — the caller always copies the
// FULL body to the clipboard first, so a truncated URL can be completed by paste.

const TRUNCATION_NOTE =
  '\n\n_(diagnostics truncated — full report copied to your clipboard; paste it here)_'

/**
 * Build a github.com/<owner>/<repo>/issues/new prefill URL.
 * @param {{ owner: string, repo: string, title?: string, body?: string, labels?: string[] }} p
 * @returns {string}
 */
export function buildIssueUrl({ owner, repo, title = '', body = '', labels = [] }) {
  const params = new URLSearchParams()
  if (title) params.set('title', title)
  if (body) params.set('body', body)
  if (labels && labels.length) params.set('labels', labels.join(','))
  return `https://github.com/${owner}/${repo}/issues/new?${params.toString()}`
}

/**
 * Build the issue URL, trimming `body` so the whole URL stays within `maxUrlLen`.
 * When trimming happens a note is appended pointing the user at the clipboard copy.
 * @param {{ owner: string, repo: string, title?: string, body?: string, labels?: string[] }} p
 * @param {number} maxUrlLen
 * @returns {{ url: string, truncated: boolean }}
 */
export function truncateBodyForUrl(p, maxUrlLen) {
  const full = buildIssueUrl(p)
  if (full.length <= maxUrlLen) return { url: full, truncated: false }

  // Binary-search the longest body prefix (plus the note) that keeps the URL in
  // budget — URL-encoding expands length nonlinearly, so measure the built URL.
  const body = p.body || ''
  let lo = 0
  let hi = body.length
  let best = ''
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const candidate = body.slice(0, mid) + TRUNCATION_NOTE
    if (buildIssueUrl({ ...p, body: candidate }).length <= maxUrlLen) {
      best = candidate
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return { url: buildIssueUrl({ ...p, body: best }), truncated: true }
}

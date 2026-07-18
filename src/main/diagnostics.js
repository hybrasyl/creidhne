import { clipboard, shell } from 'electron'
import os from 'os'
import { appIdentity } from '../shared/appIdentity.js'
import { simplifyPlatform } from '../shared/osName.js'
import { buildDiagnosticsBlock } from '../shared/diagnostics.js'
import { buildIssueUrl, truncateBodyForUrl } from '../shared/issueUrl.js'
import { scrubText } from '../shared/scrub.js'
import { getRecentErrors } from './sessionLog.js'

// Backing logic for the diagnostics:* IPC handlers. Pure-helper composition +
// Electron clipboard/shell. `buildIssueUrl` is re-exported so tests and callers
// have one import surface.
export { buildIssueUrl }

// Conservative budget: shell.openExternal is reliable to ~2 KB; leave headroom.
const MAX_URL_LEN = 1800

/**
 * The scrubbed diagnostics block shown (editable) in the report dialog. Errors in
 * the ring buffer are already scrubbed at capture time; a second pass here is
 * cheap, idempotent insurance over the fully assembled block.
 */
export function buildDiagnostics({ version } = {}) {
  const block = buildDiagnosticsBlock({
    productName: appIdentity.productName,
    version,
    os: simplifyPlatform(process.platform),
    errors: getRecentErrors()
  })
  let userName
  try {
    userName = os.userInfo().username
  } catch {
    userName = undefined
  }
  return scrubText(block, { homeDir: os.homedir(), userName })
}

/**
 * Open a prefilled GitHub issue on the shared public intake repo. Always copies the
 * full body to the clipboard first, so a URL-length-truncated body can be pasted.
 *
 * Only the stable per-app label is applied via the URL — GitHub applies a `labels=`
 * value only when that label already exists on the repo, so unbounded version labels
 * would silently no-op. The version already rides along in the diagnostics body.
 */
export function openIssue({ title, body }) {
  clipboard.writeText(body)
  const labels = [appIdentity.appLabel]
  const { url, truncated } = truncateBodyForUrl(
    { owner: appIdentity.intakeOwner, repo: appIdentity.intakeRepo, title, body, labels },
    MAX_URL_LEN
  )
  shell.openExternal(url)
  return { ok: true, truncated }
}

/** Always-works fallback: put the full report on the clipboard. */
export function copyReport({ body }) {
  clipboard.writeText(body)
  return { ok: true }
}

// Privacy scrubbing for diagnostics. PURE — no node/electron imports; the caller
// (main process) passes in `homeDir` / `userName` from os.*, so this stays
// unit-testable and portable. Scrubbing runs at CAPTURE time (before anything
// touches the ring buffer or disk), so on-disk session logs are already safe to
// attach to a bug report.
//
// Goal: strip anything that identifies a machine or person — usernames, home and
// world/library paths, emails, IP addresses — while leaving enough of an error
// (type, message, code location basename) to be useful for debugging.

// Escape a string for literal use inside a RegExp.
export function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g

// Deep ABSOLUTE paths (3+ components) collapse to "…<sep><basename>". Runs FIRST so
// a path with an embedded username (e.g. C:\Users\alice\world\Foo.xml) is folded to
// just "…\Foo.xml" — dropping the account name entirely, no fragmentation from
// placeholder text. Catches world/library paths that carry no username too
// (E:\Dark Ages Dev\Repos\world\items\Foo.xml).
const WIN_DEEP_PATH_RE = /[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\){2,}[^\\/:*?"<>|\r\n]+/g
// POSIX variant. The lookbehind keeps it from eating URL path parts ("https://a/b/c"
// — the "//host/…" segment) or a path already glued to a word/colon.
const POSIX_DEEP_PATH_RE = /(?<![:/\w])(?:\/[^/\s:*?"<>|\r\n]+){3,}/g

// Short named-account paths left after the deep collapse (only 2 components, e.g.
// "C:\Users\alice" or "/home/alice"). Keep the recognizable prefix, redact the name.
const WIN_USER_RE = /([A-Za-z]:[\\/]Users[\\/])([^\\/:*?"<>|\r\n]+)/gi
const POSIX_HOME_RE = /((?:\/Users|\/home)\/)([^/\r\n]+)/g

/**
 * Scrub identifying information from a block of text.
 * @param {string} text
 * @param {{ homeDir?: string, userName?: string }} [ctx]
 * @returns {string}
 */
export function scrubText(text, ctx = {}) {
  if (typeof text !== 'string' || text.length === 0) return text
  const { homeDir, userName } = ctx
  let out = text

  // 1/2. Emails and IPv4 — independent of any path shape, so do them up front.
  out = out.replace(EMAIL_RE, '<email>')
  out = out.replace(IPV4_RE, '<ip>')

  // 3. Collapse deep absolute paths to their basename (drops any embedded account
  // name and local directory structure in one pass).
  out = out.replace(WIN_DEEP_PATH_RE, (m) => `…\\${m.split('\\').pop()}`)
  out = out.replace(POSIX_DEEP_PATH_RE, (m) => `…/${m.split('/').pop()}`)

  // 4. Short account paths the collapse didn't reach — redact just the name.
  out = out.replace(WIN_USER_RE, '$1<user>')
  out = out.replace(POSIX_HOME_RE, '$1<user>')

  // 5. Explicit home dir (covers non-standard install locations not under Users/home).
  if (typeof homeDir === 'string' && homeDir.length > 0) {
    out = out.replace(new RegExp(escapeRegExp(homeDir), 'gi'), '<HOME>')
  }

  // 6. Bare username token elsewhere in the text (embedded in a URL or a message).
  // Only when long enough to be unambiguous — a 2-char name would clobber innocent
  // substrings ("al" in "also").
  if (typeof userName === 'string' && userName.length >= 3) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(userName)}\\b`, 'g'), '<user>')
  }

  return out
}

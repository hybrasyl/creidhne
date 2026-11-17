import { realpathSync } from 'fs'
import { basename, dirname, isAbsolute, join, normalize, parse, sep } from 'path'

// Reject path-traversal attempts on a filename component supplied by the
// renderer. Resolves `candidate` against `parent` using `join` + `normalize`
// (no cwd dependency, so the helper is safe to use in tests where paths are
// synthetic). If `candidate` is itself absolute, it is normalized as-is.
//
// The trailing-separator check matters: a naive `startsWith(parent)` would
// accept "/parent-evil/x" because it begins with "/parent". Comparing
// against `parent + sep` blocks that near-miss.
export function assertInside(parent, candidate) {
  const absParent = normalize(parent).replace(/[\\/]+$/, '')
  const absCandidate = isAbsolute(candidate)
    ? normalize(candidate)
    : normalize(join(absParent, candidate))
  const parentWithSep = absParent + sep
  if (absCandidate !== absParent && !absCandidate.startsWith(parentWithSep)) {
    throw new Error(`Path traversal rejected: "${candidate}" escapes "${parent}"`)
  }
  return absCandidate
}

// Reject a renderer-supplied path that doesn't fall inside any of the
// currently-allowed session roots. Used by Category-A handlers that take
// a full absolute path with no implicit parent (fs:readFile, xml:loadCastable,
// etc.) — the renderer can't address arbitrary disk locations, only paths
// the user has authorised this session.
export function assertInsideAnyRoot(roots, candidate) {
  let rootCount = 0
  for (const root of roots) {
    rootCount++
    try {
      return assertInside(root, candidate)
    } catch {
      /* try next */
    }
  }
  if (rootCount === 0) {
    throw new Error(`Path "${candidate}" rejected: no allowed roots configured`)
  }
  throw new Error(`Path "${candidate}" is not inside any allowed root`)
}

// Predicate variant for callers that want to branch on the answer instead
// of catching a thrown error.
export function isInsideAnyRoot(roots, candidate) {
  for (const root of roots) {
    try {
      assertInside(root, candidate)
      return true
    } catch {
      /* try next */
    }
  }
  return false
}

// ── Filesystem roots (HTOO-679) ──────────────────────────────────────────────
//
// A drive or a filesystem root (`/`, `C:\`, `\\server\share\`) never becomes an
// allowed root: it would give the renderer the whole volume.
export function isFilesystemRoot(p) {
  if (typeof p !== 'string' || !p) return false
  const n = normalize(p)
  const root = parse(n).root
  return root !== '' && n.replace(/[\\/]+$/, '') === root.replace(/[\\/]+$/, '')
}

// ── Real-path containment (HTOO-681) ─────────────────────────────────────────
//
// The checks above compare path strings. A junction or a symlink below an
// allowed folder passes them and leads the I/O somewhere else. The checks
// below resolve links on both sides before they compare. The model is the same
// as Taliesin's (`docs/authority-model.md` there). These are synchronous so that
// every handler keeps its one-line `validatePath(p)` call; a realpath is a few
// system calls.
//
// A race stays open: a folder can change into a link between the check and the
// I/O. The check closes every case where the link exists first.

// `realpathSync.native` asks the OS, so a Windows junction resolves as well as
// a symlink. Strip a `\\?\` prefix, which Windows can add on a long path.
function realpathNative(p) {
  const real = realpathSync.native(p)
  return real.startsWith('\\\\?\\') && !real.startsWith('\\\\?\\UNC\\') ? real.slice(4) : real
}

/**
 * The real path of `p`. When `p` does not exist, the real path of its nearest
 * existing ancestor, with the missing part added back. A new file is thus
 * judged by the folder it will go into.
 */
export function realpathAllowMissing(p) {
  let cur = normalize(p)
  const tail = []
  for (;;) {
    try {
      const real = realpathNative(cur)
      return tail.length > 0 ? join(real, ...tail.reverse()) : real
    } catch (e) {
      if (e?.code !== 'ENOENT' && e?.code !== 'ENOTDIR') throw e
      const parent = dirname(cur)
      if (parent === cur) throw e
      tail.push(basename(cur))
      cur = parent
    }
  }
}

// Case folds on Windows, where the filesystem does. Both sides are real paths.
function fold(p) {
  return process.platform === 'win32' ? p.toLowerCase() : p
}

/** True when real path `child` is real path `parent` or below it. */
export function realContains(parent, child) {
  const a = fold(normalize(parent).replace(/[\\/]+$/, ''))
  const b = fold(normalize(child))
  return b === a || b.startsWith(a + sep) || (a.endsWith(sep) && b.startsWith(a))
}

/**
 * `assertInside`, then the same test on real paths. Returns the lexical path,
 * which is the one to use for the I/O.
 */
export function assertRealInside(parent, candidate) {
  const lexical = assertInside(parent, candidate)
  if (!realContains(realpathAllowMissing(parent), realpathAllowMissing(lexical))) {
    throw new Error(`Path "${candidate}" leaves "${parent}" through a link`)
  }
  return lexical
}

/**
 * `assertInsideAnyRoot`, then a real-path test: the target's real path must be
 * inside the real path of some allowed root. A link from one allowed root into
 * another allowed root passes. A root that is itself a link is allowed, because
 * the user chose it.
 */
export function assertRealInsideAnyRoot(roots, candidate) {
  const list = [...roots]
  const lexical = assertInsideAnyRoot(list, candidate)
  const realTarget = realpathAllowMissing(lexical)
  for (const root of list) {
    let realRoot
    try {
      realRoot = realpathAllowMissing(root)
    } catch {
      continue
    }
    if (realContains(realRoot, realTarget)) return { path: lexical, real: realTarget }
  }
  throw new Error(`Path "${candidate}" leaves every allowed root through a link`)
}

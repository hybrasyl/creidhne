import { isAbsolute, join, normalize, sep } from 'path'

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

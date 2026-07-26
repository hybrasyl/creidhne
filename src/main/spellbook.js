// Pure spellbook resolution + category reconcile helpers (no file IO), so the
// logic behind the spellbook:apply IPC handler is unit-testable.
//
// A spellbook is a Creidhne authoring convenience. Its runtime effect is that
// every castable it resolves to carries the book's name as a category, so a
// BehaviorSet can reference the whole book with one category token. A book
// resolves to (its individual castables) ∪ (all members of each included
// category), where category membership comes from the world index's
// castableCategoryMembers map.

/**
 * Resolve a spellbook to the full, deduped, sorted set of castable names it
 * covers. The book's own name is skipped when it appears in `categories` to
 * avoid a self-referential expansion through the tag this book creates.
 *
 * @param {{ name?: string, castables?: string[], categories?: string[] }} book
 * @param {Record<string, string[]>} categoryMembers - category → member names
 * @returns {string[]}
 */
export function resolveSpellbook(book, categoryMembers) {
  const members = categoryMembers || {}
  const bookName = typeof book?.name === 'string' ? book.name.trim() : ''
  const out = new Set()
  for (const n of Array.isArray(book?.castables) ? book.castables : []) {
    if (n && n.trim()) out.add(n.trim())
  }
  for (const cat of Array.isArray(book?.categories) ? book.categories : []) {
    const c = cat && cat.trim()
    if (!c || c === bookName) continue
    for (const m of members[c] || []) if (m) out.add(m)
  }
  return [...out].sort((a, b) => a.localeCompare(b))
}

/**
 * Compute the next category list for one castable when applying a book.
 * Strips the previous book name (rename), then adds or removes the current book
 * name based on whether the castable is in the resolved set. Order-preserving
 * for untouched categories.
 *
 * @param {string[]} orig - the castable's current categories
 * @param {{ bookName: string, prevName?: string|null, shouldHave: boolean }} opts
 * @returns {string[]}
 */
export function nextCategories(orig, { bookName, prevName, shouldHave }) {
  const base = Array.isArray(orig) ? orig : []
  let next = prevName ? base.filter((c) => c !== prevName) : [...base]
  const has = next.includes(bookName)
  if (shouldHave && !has) next.push(bookName)
  else if (!shouldHave && has) next = next.filter((c) => c !== bookName)
  return next
}

/**
 * True when two category lists hold the same set of values (order/dupe blind).
 * @param {string[]} a
 * @param {string[]} b
 */
export function sameCategorySet(a, b) {
  const sa = new Set(a || [])
  const sb = new Set(b || [])
  if (sa.size !== sb.size) return false
  for (const v of sa) if (!sb.has(v)) return false
  return true
}

/**
 * The set of castable names a book apply might touch: those that should be
 * tagged now, plus those currently carrying the book name, plus (on rename)
 * those carrying the previous name.
 *
 * @param {string[]} resolved - resolveSpellbook() output
 * @param {string} bookName
 * @param {string|null} prevName
 * @param {Record<string, string[]>} categoryMembers
 * @returns {string[]}
 */
export function affectedCastables(resolved, bookName, prevName, categoryMembers) {
  const members = categoryMembers || {}
  const affected = new Set(resolved || [])
  for (const n of members[bookName] || []) affected.add(n)
  if (prevName) for (const n of members[prevName] || []) affected.add(n)
  return [...affected]
}

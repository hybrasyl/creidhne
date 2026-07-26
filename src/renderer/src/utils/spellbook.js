// Renderer-side spellbook resolution — the twin of src/main/spellbook.js.
// Kept in sync deliberately: the renderer needs the resolved castable list for
// the live preview and the warn-before-write count without a round-trip to
// main. Main re-resolves authoritatively at save time from its own index.

/**
 * Resolve a spellbook to the full, deduped, sorted set of castable names it
 * covers: (its individual castables) ∪ (all members of each included category).
 * The book's own name is skipped when present in `categories`.
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
 * Number of castable files a save would rewrite: those newly gaining or losing
 * the book-name tag, plus (on rename) those losing the previous name. Used to
 * decide whether to warn before writing.
 *
 * @param {object} book
 * @param {Record<string, string[]>} categoryMembers
 * @param {string|null} prevName - the book's previously saved name, if renamed
 * @returns {number}
 */
export function spellbookWriteCount(book, categoryMembers, prevName) {
  const members = categoryMembers || {}
  const bookName = typeof book?.name === 'string' ? book.name.trim() : ''
  const resolved = new Set(resolveSpellbook(book, members))
  const current = new Set(members[bookName] || [])
  const prev = prevName && prevName !== bookName ? members[prevName] || [] : []

  const writeSet = new Set()
  for (const n of resolved) if (!current.has(n)) writeSet.add(n) // gaining the tag
  for (const n of current) if (!resolved.has(n)) writeSet.add(n) // losing the tag
  for (const n of prev) writeSet.add(n) // losing the previous name (rename)
  return writeSet.size
}

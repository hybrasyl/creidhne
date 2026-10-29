/**
 * The element table model, and the rules that the editor and the parser share
 * (HTOO-581, HXML-24).
 *
 * A table in the registry format has an `<Elements>` block that defines each
 * element, an optional `<Groups>` block, and `<Source>` rows that declare only
 * the pairs they need. A table in the old format has no `<Elements>` block: its
 * elements are its `<Source>` rows, and it declares every pair. `world` and
 * `ceridwen` keep the old format until the HS-1239 content migration, so the
 * editor opens both, and a save keeps the format it read.
 *
 * Multipliers stay the text that the file holds. The editor used to keep a
 * whole-number percentage, so `1.075` in the production table became 107 and
 * saved as `1.07`, with no edit.
 *
 * The model, all values strings unless noted:
 *
 *   name, comment
 *   defaultMultiplier   ElementTable/@DefaultMultiplier, '' when absent (the schema default is 1)
 *   registry            boolean: the file has an <Elements> block
 *   elements            [{ key, id, retailId, name, isDefault (boolean), ivernic }]
 *   groups              [{ key, members: [key, ...] }]
 *   sources             [{ element, defaultMultiplier, targets: [{ element, multiplier }] }]
 *
 * Imports nothing, so main, the renderer and the tests can all use it.
 */

/** The schema default for ElementTable/@DefaultMultiplier. */
export const TABLE_DEFAULT_MULTIPLIER = 1

/** Selectors that the server resolves from creature state; no key may take these names. */
export const RESERVED_SELECTORS = ['Current', 'Belt', 'Necklace']

/** The prefix of a group selector, as in `Random:Cardinal`. */
export const GROUP_SELECTOR_PREFIX = 'Random:'

/**
 * The HXML-24 element set: the Id and RetailId of each key that the design
 * names. Ids 0 to 9 keep their retail meaning; 7 (Wood) is retired; 10 to 14
 * held the old selectors and are not used again; new elements start at 15.
 */
export const HXML24_ELEMENT_IDS = {
  Force: { id: 0, retailId: 0 },
  Fire: { id: 1, retailId: 1 },
  Water: { id: 2, retailId: 2 },
  Wind: { id: 3, retailId: 3 },
  Earth: { id: 4, retailId: 4 },
  Light: { id: 5, retailId: 5 },
  Dark: { id: 6, retailId: 6 },
  Metal: { id: 8, retailId: 8 },
  Undead: { id: 9, retailId: 9 },
  Flesh: { id: 15, retailId: 0 },
  Spirit: { id: 16, retailId: 0 },
  Nature: { id: 17, retailId: 7 },
  Time: { id: 18, retailId: 0 },
  Stasis: { id: 19, retailId: 0 },
  Life: { id: 20, retailId: 0 },
  Arcane: { id: 21, retailId: 0 },
  Void: { id: 22, retailId: 0 }
}

const RETIRED_IDS = new Set([7, 10, 11, 12, 13, 14])
const FIRST_NEW_ID = 23

/** A new, empty element entry. */
export function blankElement(key) {
  return { key, id: '', retailId: '', name: '', isDefault: false, ivernic: '' }
}

/** The element keys, in table order. */
export function elementKeys(table) {
  return table.elements.map((e) => e.key)
}

/** A finite number from a multiplier's text, or null. */
export function parseMultiplier(text) {
  const t = String(text ?? '').trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** The Source row for `element`, or undefined. */
export function sourceRow(table, element) {
  return table.sources.find((s) => s.element === element)
}

/** The declared Target multiplier text for a pair, or ''. */
export function declaredMultiplier(table, source, target) {
  const row = sourceRow(table, source)
  return row?.targets.find((t) => t.element === target)?.multiplier ?? ''
}

/**
 * The multiplier the server uses for a pair: the Target entry, then the
 * Source row's DefaultMultiplier, then the table's (HXML-24, "Multiplier
 * lookup for a pair").
 */
export function effectiveMultiplier(table, source, target) {
  const row = sourceRow(table, source)
  const declared = parseMultiplier(row?.targets.find((t) => t.element === target)?.multiplier)
  if (declared !== null) return declared
  const rowDefault = parseMultiplier(row?.defaultMultiplier)
  if (rowDefault !== null) return rowDefault
  return parseMultiplier(table.defaultMultiplier) ?? TABLE_DEFAULT_MULTIPLIER
}

/**
 * Set or clear one pair. An empty `multiplier` clears the Target entry, so
 * the pair falls back to the row and table defaults. A new pair is added at
 * the end of its row, and a new row at the end of the table, so a save keeps
 * the order that the file had.
 */
export function setPair(table, source, target, multiplier) {
  const text = String(multiplier ?? '').trim()
  let sources = table.sources
  if (!sourceRow(table, source)) {
    if (text === '') return table
    sources = [...sources, { element: source, defaultMultiplier: '', targets: [] }]
  }
  return {
    ...table,
    sources: sources.map((row) => {
      if (row.element !== source) return row
      const has = row.targets.some((t) => t.element === target)
      if (!has && text === '') return row
      // A cleared pair keeps its place with no value, so retyping it does not
      // move it to the end of the row. The serializer does not write it.
      const targets = has
        ? row.targets.map((t) => (t.element === target ? { ...t, multiplier: text } : t))
        : [...row.targets, { element: target, multiplier: text }]
      return { ...row, targets }
    })
  }
}

/** Set a Source row's DefaultMultiplier. A new row is made only for a value. */
export function setRowDefault(table, source, multiplier) {
  const text = String(multiplier ?? '').trim()
  if (!sourceRow(table, source)) {
    if (text === '') return table
    return {
      ...table,
      sources: [...table.sources, { element: source, defaultMultiplier: text, targets: [] }]
    }
  }
  return {
    ...table,
    sources: table.sources.map((row) =>
      row.element === source ? { ...row, defaultMultiplier: text } : row
    )
  }
}

/** Rename an element key everywhere the table names it. */
export function renameElement(table, from, to) {
  if (from === to) return table
  const swap = (k) => (k === from ? to : k)
  return {
    ...table,
    elements: table.elements.map((e) => (e.key === from ? { ...e, key: to } : e)),
    groups: table.groups.map((g) => ({ ...g, members: g.members.map(swap) })),
    sources: table.sources.map((row) => ({
      ...row,
      element: swap(row.element),
      targets: row.targets.map((t) => ({ ...t, element: swap(t.element) }))
    }))
  }
}

/** Remove an element, its row, its column and its group memberships. */
export function removeElement(table, key) {
  return {
    ...table,
    elements: table.elements.filter((e) => e.key !== key),
    groups: table.groups.map((g) => ({ ...g, members: g.members.filter((m) => m !== key) })),
    sources: table.sources
      .filter((row) => row.element !== key)
      .map((row) => ({ ...row, targets: row.targets.filter((t) => t.element !== key) }))
  }
}

/**
 * Add an element. In the registry format a new element declares no pairs, so
 * it uses the defaults. The old format has no defaults: the server reads every
 * pair from the file, so the new row and column are filled with 1, as the
 * editor always did.
 */
export function addElement(table, key) {
  const element = blankElement(key)
  if (table.registry) {
    element.id = String(nextFreeId(table))
    return { ...table, elements: [...table.elements, element] }
  }
  const keys = [...elementKeys(table), key]
  return {
    ...table,
    elements: [...table.elements, element],
    sources: [
      ...table.sources.map((row) => ({
        ...row,
        targets: [...row.targets, { element: key, multiplier: '1' }]
      })),
      {
        element: key,
        defaultMultiplier: '',
        targets: keys.map((k) => ({ element: k, multiplier: '1' }))
      }
    ]
  }
}

/**
 * The lowest free Id from 23 up. New elements start at 15 in the design, and
 * 15 to 22 are the Ids it gives its own new elements, so a custom element
 * starts after them and cannot take an Id that one of them will need.
 */
export function nextFreeId(table) {
  const used = new Set(table.elements.map((e) => Number(e.id)))
  let id = FIRST_NEW_ID
  while (used.has(id) || RETIRED_IDS.has(id)) id++
  return id
}

/**
 * Give an old-format table an <Elements> block. Each key that HXML-24 names
 * takes its Id and RetailId; any other key takes the next free Id and
 * RetailId 0. Force is the default when the table has it, else the first
 * element. No key is renamed: `None` and `Wood` are the content migration's
 * to change, and validation names them.
 */
export function convertToRegistry(table) {
  if (table.registry) return table
  const used = new Set()
  const elements = table.elements.map((e) => {
    const known = HXML24_ELEMENT_IDS[e.key]
    const next = { ...e }
    if (known && !used.has(known.id)) {
      next.id = String(known.id)
      next.retailId = String(known.retailId)
      used.add(known.id)
    }
    return next
  })
  let id = FIRST_NEW_ID
  for (const e of elements) {
    if (e.id !== '') continue
    while (used.has(id) || RETIRED_IDS.has(id)) id++
    e.id = String(id)
    e.retailId = '0'
    used.add(id)
  }
  const defaultKey = elements.some((e) => e.key === 'Force') ? 'Force' : elements[0]?.key
  return {
    ...table,
    registry: true,
    elements: elements.map((e) => ({ ...e, isDefault: e.key === defaultKey }))
  }
}

/** Is `key` a name that no element or group may take? */
export function isReservedKey(key) {
  return RESERVED_SELECTORS.includes(key) || key.startsWith(GROUP_SELECTOR_PREFIX)
}

const isWholeIn = (text, lo, hi) => /^\d+$/.test(text) && Number(text) >= lo && Number(text) <= hi

/**
 * The problems that make the server or the schema refuse the table. Each is a
 * sentence for the editor to show. An empty list means the table is valid.
 */
export function validateElementTable(table) {
  const problems = []
  const keys = elementKeys(table)
  const keySet = new Set(keys)
  const dupes = (list) => [...new Set(list.filter((v, i) => list.indexOf(v) !== i))]

  for (const k of keys) if (k.trim() === '') problems.push('An element has no key.')
  for (const k of dupes(keys)) problems.push(`The key "${k}" is on more than one element.`)
  for (const k of keys.filter(isReservedKey))
    problems.push(`"${k}" is reserved for a selector, so no element can take it.`)

  if (table.registry) {
    for (const e of table.elements) {
      if (!isWholeIn(e.id, 0, 254))
        problems.push(`${e.key}: the Id must be a whole number from 0 to 254.`)
      if (e.retailId !== '' && !isWholeIn(e.retailId, 0, 9))
        problems.push(`${e.key}: the RetailId must be a whole number from 0 to 9.`)
    }
    for (const id of dupes(table.elements.map((e) => e.id).filter((id) => id !== '')))
      problems.push(`The Id ${id} is on more than one element.`)
    const defaults = table.elements.filter((e) => e.isDefault)
    if (defaults.length === 0) problems.push('No element is the default. Mark exactly one.')
    if (defaults.length > 1)
      problems.push(
        `${defaults.map((e) => e.key).join(', ')} are all marked default. Mark exactly one.`
      )

    const groupKeys = table.groups.map((g) => g.key)
    for (const g of groupKeys) if (g.trim() === '') problems.push('A group has no key.')
    for (const g of dupes(groupKeys))
      problems.push(`The group key "${g}" is on more than one group.`)
    for (const g of groupKeys.filter(isReservedKey))
      problems.push(`"${g}" is reserved for a selector, so no group can take it.`)
    for (const g of table.groups) {
      if (g.members.length === 0) problems.push(`The group ${g.key} has no members.`)
      for (const m of new Set(g.members.filter((m) => !keySet.has(m))))
        problems.push(`The group ${g.key} names "${m}", which is not an element of this table.`)
    }
  }

  const multiplierProblem = (where, text) => {
    if (String(text ?? '').trim() !== '' && parseMultiplier(text) === null)
      problems.push(`${where}: "${text}" is not a number.`)
  }
  multiplierProblem('The table default multiplier', table.defaultMultiplier)
  for (const s of dupes(table.sources.map((r) => r.element)))
    problems.push(`The element ${s} has more than one Source row.`)
  for (const row of table.sources) {
    if (!keySet.has(row.element))
      problems.push(`A Source row names "${row.element}", which is not an element of this table.`)
    multiplierProblem(`${row.element}: the row default multiplier`, row.defaultMultiplier)
    for (const t of dupes(row.targets.map((t) => t.element)))
      problems.push(`${row.element} has more than one multiplier against ${t}.`)
    for (const t of row.targets) {
      if (!keySet.has(t.element))
        problems.push(`${row.element} names "${t.element}", which is not an element of this table.`)
      multiplierProblem(`${row.element} against ${t.element}`, t.multiplier)
    }
  }

  // The old format has no defaults: the server reads each pair from the file.
  if (!table.registry) {
    const missing = []
    for (const s of keys)
      for (const t of keys)
        if (parseMultiplier(declaredMultiplier(table, s, t)) === null)
          missing.push(`${s} against ${t}`)
    if (missing.length)
      problems.push(
        `The old format needs a multiplier for every pair. These have none: ${missing.join(', ')}.`
      )
  }
  return problems
}

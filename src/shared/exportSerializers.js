// Serializers for a list of flat records plus an explicit column list.
//
// Deliberately entity-agnostic — nothing here knows about castables — because
// WP3 extends the report builder to the other XML types, and WP2 wants a live
// preview in the renderer. Electron-free for the same reason.
//
// A column is `{ key, header }`: the record keeps clean camelCase keys, and each
// preset owns the header text its consumer expects. Taking an explicit column
// list rather than reading `Object.keys(records[0])` also means an export's
// shape no longer depends on whichever record happened to come first.

/** Quotes a CSV field only when it needs it, doubling any embedded quote. */
export function esc(val) {
  const s = String(val ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Renders records as CSV with CRLF row separators and no trailing newline.
 *
 * `headerOnEmpty` decides what an empty record list produces: a lone header row,
 * or nothing at all. The two castable exports disagree on this and both
 * behaviours are established, so it is a per-preset choice rather than a default.
 */
export function recordsToCsv(records, columns, { headerOnEmpty = true } = {}) {
  if (records.length === 0 && !headerOnEmpty) return ''
  const rows = [columns.map((c) => esc(c.header)).join(',')]
  for (const record of records) {
    rows.push(columns.map((c) => esc(record[c.key])).join(','))
  }
  return rows.join('\r\n')
}

/**
 * Renders records as pretty-printed JSON, keyed by the columns' record keys.
 *
 * Projecting through the same column list as the CSV is what lets a JSON preset
 * and a CSV preset share one definition and stay identical by construction.
 */
export function recordsToJson(records, columns) {
  const projected = records.map((record) =>
    Object.fromEntries(columns.map((c) => [c.key, record[c.key]]))
  )
  return `${JSON.stringify(projected, null, 2)}\n`
}

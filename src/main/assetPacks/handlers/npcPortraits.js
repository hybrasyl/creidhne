// content_type: 'npc_portraits' (brigid's canonical name; see
// brigid Brigid.Data/AssetPacks/AssetPackRegistry.cs + NpcPortraitPack.cs)
//
// Replaces legacy npc/npcbase.dat SPF illustrations with uniform square PNGs.
// Unlike the flat-schema types, the key→file mapping is NOT derivable from the
// filename — it lives in the manifest:
//
//   "covers": {
//     "npc_portraits": {
//       "dimensions": [200, 200],
//       "portraits": { "Gobalt": "gobalt.png", "inn.spf": "inn_green.png" }
//     }
//   }
//
// The key is the literal Hybrasyl XML `Portrait` attribute value (e.g.
// "inn.spf" for a legacy SPF portrait, "Gobalt" for a modern bare name),
// matched case-insensitively. The value is the PNG entry name at the ZIP root.
//
// Because the mapping is manifest-driven we implement buildIndex(manifest,
// files) rather than the per-file parseEntry path. Coverage stores the
// original-case portrait keys (for display + as the value written back to the
// XML Portrait attribute); entries are keyed by the lowercased portrait key so
// resolveAsset('npcportrait', name) matches case-insensitively.

const SUBTYPE = 'npcportrait'

const lc = (s) => String(s).toLowerCase()
const basename = (p) => String(p).split('/').pop()

export default {
  contentType: 'npc_portraits',
  status: 'implemented',
  subtypes: [SUBTYPE],
  spec: 'brigid NpcPortraitPack.cs (covers.npc_portraits.portraits: key → png)',

  buildIndex(manifest, files) {
    const entries = new Map()
    const coverage = new Map()

    const portraits = manifest?.covers?.npc_portraits?.portraits
    if (!portraits || typeof portraits !== 'object') return { entries, coverage }

    // Lowercased ZIP basename → entry, for case-insensitive file resolution.
    const byName = new Map()
    for (const zipEntry of files) {
      if (zipEntry.path === '_manifest.json') continue
      if (zipEntry.type && zipEntry.type !== 'File') continue
      byName.set(lc(basename(zipEntry.path)), zipEntry)
    }

    const ids = new Set()
    for (const [rawKey, rawFile] of Object.entries(portraits)) {
      const key = typeof rawKey === 'string' ? rawKey.trim() : ''
      const file = typeof rawFile === 'string' ? rawFile.trim() : ''
      if (!key || !file) continue
      const entry = byName.get(lc(basename(file)))
      if (!entry) continue // manifest references a PNG that isn't in the ZIP
      entries.set(`${SUBTYPE}:${lc(key)}`, entry)
      ids.add(key) // original case — used for enumeration + XML round-trip
    }
    if (ids.size) coverage.set(SUBTYPE, ids)
    return { entries, coverage }
  },

  keyFor(subtype, id) {
    if (lc(subtype) !== SUBTYPE) return null
    return `${SUBTYPE}:${lc(id)}`
  },

  // Unused — buildIndex owns indexing — but kept for interface parity with the
  // flat-schema handlers.
  parseEntry() {
    return null
  }
}

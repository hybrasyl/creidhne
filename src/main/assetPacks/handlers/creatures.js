// content_type: 'creature_sprites' (brigid's canonical name; see
// brigid Brigid.Data/AssetPacks/AssetPackRegistry.cs + CreaturePack.cs)
//
// Replaces legacy MNS###.MPF creature sprites (hades.dat). Coverage is emergent
// from the ZIP directory layout (manifest `covers.creature_sprites` is empty):
//
//   creature_sprites/
//     creature_{spriteId:D5}/
//       stand/
//         n_001.png   master facing North (engine mirrors for West)
//         e_001.png   master facing East  (engine mirrors for South)
//
// spriteId maps 1:1 to the MPF number (Creidhne's creature sprite id). A pack
// may ship one or both pair-masters per creature. Because the mapping is
// directory-structured (not derivable from a flat basename), we implement
// buildIndex and pick ONE representative PNG per creature for the picker
// thumbnail: the East master (a front-ish right profile) when present, else the
// North master. Higher frame indices and other stances (walk/attack/…) are
// reserved by brigid's format but unused in phase 1, so we ignore them.

const SUBTYPE = 'creature'
// creature_sprites/creature_{id}/stand/{n|e}_001.png at the archive root.
const ENTRY_RE = /^creature_sprites\/creature_(\d+)\/stand\/(n|e)_001\.png$/i

export default {
  contentType: 'creature_sprites',
  status: 'implemented',
  subtypes: [SUBTYPE],
  spec: 'brigid CreaturePack.cs (creature_sprites/creature_{id}/stand/{n|e}_001.png)',

  buildIndex(_manifest, files) {
    const entries = new Map()
    const coverage = new Map()

    // Group masters by creature id: { n?: entry, e?: entry }.
    const byId = new Map()
    for (const zipEntry of files) {
      if (zipEntry.type && zipEntry.type !== 'File') continue
      const m = ENTRY_RE.exec(zipEntry.path)
      if (!m) continue
      const id = parseInt(m[1], 10)
      if (!Number.isFinite(id) || id <= 0) continue // brigid: spriteId > 0
      const dir = m[2].toLowerCase()
      if (!byId.has(id)) byId.set(id, {})
      byId.get(id)[dir] = zipEntry
    }

    const ids = new Set()
    for (const [id, pair] of byId) {
      const rep = pair.e || pair.n // prefer East master for the thumbnail
      if (!rep) continue
      entries.set(`${SUBTYPE}:${id}`, rep)
      ids.add(id)
    }
    if (ids.size) coverage.set(SUBTYPE, ids)
    return { entries, coverage }
  },

  keyFor(subtype, id) {
    if (String(subtype || '').toLowerCase() !== SUBTYPE) return null
    return `${SUBTYPE}:${id}`
  },

  // Unused — buildIndex owns indexing — but kept for interface parity.
  parseEntry() {
    return null
  }
}

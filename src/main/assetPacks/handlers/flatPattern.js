// Shared factory for the "flat" filename schema used by ability_icons,
// nation_badges, legend_mark_icons, and (when implemented) item_icons:
//
//   {subtype}{id:Dpadding}.{png|webp}
//
// e.g. "skill0001.png", "nation0042.png", "legend0007.png", "item13688.png".
//
// The flat schema stores each pack entry under the key "{subtype}:{id}" so
// resolveAsset(subtype, id) can do an O(1) lookup. Multi-frame schemas
// (eventual creatures / effects / ui_sprite_overrides packs) will need a
// different factory because their key shape is compound (id + frame).

const FLAT_PATTERN = /^([a-z]+)(\d+)\.(png|webp)$/i

/**
 * Build a content-type handler for the flat filename schema.
 *
 * @param {object} opts
 * @param {string} opts.contentType   manifest.content_type discriminator (e.g. 'ability_icons')
 * @param {string[]} opts.subtypes    permitted filename prefixes (e.g. ['skill','spell'])
 * @param {number} [opts.padding]     expected zero-pad width; informational only
 *                                    (we don't reject mis-padded entries — legacy
 *                                    packs in the wild use varying widths)
 * @param {string} [opts.spec]        URL or doc reference for traceability
 * @returns implemented handler (status: 'implemented')
 */
export function makeFlatPatternHandler({ contentType, subtypes, padding, spec }) {
  if (!contentType) throw new Error('makeFlatPatternHandler: contentType required')
  if (!Array.isArray(subtypes) || subtypes.length === 0) {
    throw new Error('makeFlatPatternHandler: subtypes must be a non-empty array')
  }
  const subtypeSet = new Set(subtypes.map((s) => s.toLowerCase()))

  return {
    contentType,
    status: 'implemented',
    subtypes: [...subtypeSet],
    padding,
    spec,
    /**
     * Parse a ZIP entry's full path. Returns { subtype, id, key } on a
     * recognized filename, null otherwise. Subdirectories are flattened
     * (only the basename matters for flat-schema types).
     */
    parseEntry(path) {
      const base = path.split('/').pop()
      const m = FLAT_PATTERN.exec(base)
      if (!m) return null
      const subtype = m[1].toLowerCase()
      if (!subtypeSet.has(subtype)) return null
      const id = parseInt(m[2], 10)
      if (!Number.isFinite(id)) return null
      return { subtype, id, key: `${subtype}:${id}` }
    },
    /**
     * Build the entry-cache key for a (subtype, id) lookup. Returns null if
     * the subtype isn't claimed by this handler — lets the loader skip packs
     * whose handler doesn't own the requested subtype.
     */
    keyFor(subtype, id) {
      const s = String(subtype || '').toLowerCase()
      if (!subtypeSet.has(s)) return null
      return `${s}:${id}`
    }
  }
}

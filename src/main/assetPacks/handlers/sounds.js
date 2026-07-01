// content_type: 'sound_effects' (brigid's canonical name; see
// brigid Brigid.Data/AssetPacks/AssetPackRegistry.cs + SfxPack.cs / AudioPack.cs)
//
// Replaces legacy legend.dat {id}.mp3 sound effects. Brigid names entries
// `sfx_{id}.{ext}` at the ZIP root, where {id} is the integer sound id (the
// value the server sends in SoundArgs.Sound when IsMusic is false — the SAME
// numbering as Creidhne's legend.dat sound picker) and {ext} ∈
// {wav, ogg, mp3, flac}. Zero-padding is tolerated (parsed via base-10 int);
// ids ≤ 0 are ignored, matching AudioPack's int.TryParse && id > 0 gate.
//
// Unlike the image types, the payload is audio: the loader's resolveAssetUrl
// infers the MIME from the entry extension, and the renderer plays the bytes
// directly (no decode/render step here).
//
// (Background music — content_type 'music' — is a per-map property owned by
// Taliesin, so Creidhne registers it out_of_scope; see handlers/music.js.)

const SUBTYPE = 'sfx'
const EXT = /^(wav|ogg|mp3|flac)$/i
// sfx_{id}.{ext} at the archive root (basename only — brigid rejects nested).
const SFX_PATTERN = /^sfx_(\d+)\.(wav|ogg|mp3|flac)$/i

export default {
  contentType: 'sound_effects',
  status: 'implemented',
  subtypes: [SUBTYPE],
  spec: 'brigid SfxPack.cs (sfx_{id}.{wav|ogg|mp3|flac} at ZIP root)',

  parseEntry(path) {
    const base = String(path).split('/').pop()
    // Reject nested entries — brigid only honors flat archive-root files.
    if (base !== path) return null
    const m = SFX_PATTERN.exec(base)
    if (!m) return null
    const id = parseInt(m[1], 10)
    if (!Number.isFinite(id) || id <= 0) return null // brigid: id > 0
    return { subtype: SUBTYPE, id, key: `${SUBTYPE}:${id}` }
  },

  keyFor(subtype, id) {
    if (String(subtype || '').toLowerCase() !== SUBTYPE) return null
    return `${SUBTYPE}:${id}`
  },

  // Exposed for parity/testing — the allowed audio extensions.
  isAllowedExtension(ext) {
    return EXT.test(String(ext || ''))
  }
}

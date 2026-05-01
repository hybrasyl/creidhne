// content_type: 'sounds' (Creidhne-defined; not yet in Comhaigne)
//
// Will cover sound effects shipped today as numbered entries inside
// sound.dat. The wire shape is similar to ability_icons (flat numeric ID
// per asset), but the asset payloads are audio (MP3/WAV/OGG) rather than
// PNG — the loader's current "PNG buffer in, PNG buffer out" assumption
// doesn't apply.
//
// Open questions to resolve in a Comhaigne scoping pass before
// implementing:
//   1. Audio container format. MP3 keeps file sizes small; WAV is
//      simpler but bigger; OGG is open-source. The legacy client used
//      a custom WAV-like format — modern packs likely target MP3.
//   2. Filename schema. Likely flat: sound{id:D4}.mp3.
//   3. Whether music (background tracks) is the same content_type or
//      a sibling 'music' type — the legacy archive bundles both.
//   4. Streaming vs. preload. Long tracks shouldn't be cached as
//      whole buffers; the loader needs a streaming variant.
//
// Likely flat schema with audio extensions; will need to extend
// flatPattern.js (or add an audioFlatPattern.js) to permit non-PNG
// extensions when this lands.

export default {
  contentType: 'sounds',
  status: 'planned',
  subtypes: [],
  spec: 'TBD: needs Comhaigne scoping pass',
  parseEntry() {
    return null
  },
  keyFor() {
    return null
  }
}

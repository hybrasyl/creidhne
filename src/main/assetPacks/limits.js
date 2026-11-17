// Resource limits for .datf asset packs (HTOO-684).
//
// A pack is a zip that the user drops into a folder, so its metadata and its
// content are untrusted input. Without limits, a hostile or damaged pack can
// make main allocate without bound: a huge entry count in the central
// directory, a huge manifest, or an entry that inflates far past the size it
// declares.
//
// Each limit is far above the packs that exist. Measured on 2026-11-17 over the
// 17 packs in the Brigid assets folder and the client folder: the largest pack
// is 5.9 MB, the most entries 799, the largest manifest 327 bytes, the largest
// entry 4.7 MB (a music track), the most uncompressed 5.9 MB, and the highest
// ratio 6.8 (1.1 for an entry above 1 MiB). A production music or tile pack can
// be much larger, so the limits leave room for that.

const MiB = 1024 * 1024
const GiB = 1024 * MiB

export const PACK_LIMITS = Object.freeze({
  /** The .datf file itself. This also bounds the central directory that the zip reader parses. */
  maxPackBytes: 2 * GiB,
  /** Entries in the central directory. */
  maxEntries: 200_000,
  /** `_manifest.json`, uncompressed. */
  maxManifestBytes: 16 * MiB,
  /** One asset, uncompressed. A long WAV or FLAC track is the largest real case. */
  maxEntryBytes: 256 * MiB,
  /** All entries together, uncompressed, as the central directory declares. */
  maxTotalBytes: 8 * GiB,
  /** Uncompressed / compressed, for an entry above `ratioFloorBytes`. */
  maxRatio: 100,
  ratioFloorBytes: 1 * MiB
})

/**
 * Check a pack's file size and central directory against the limits. Returns
 * a reason (one sentence) when the pack is refused, or null.
 */
export function packLimitViolation(fileBytes, files, limits = PACK_LIMITS) {
  if (fileBytes > limits.maxPackBytes) {
    return `the file is ${fileBytes} bytes, above the limit of ${limits.maxPackBytes}`
  }
  if (files.length > limits.maxEntries) {
    return `it has ${files.length} entries, above the limit of ${limits.maxEntries}`
  }
  let total = 0
  for (const f of files) {
    const size = Number(f.uncompressedSize)
    const packed = Number(f.compressedSize)
    if (!Number.isSafeInteger(size) || size < 0 || !Number.isSafeInteger(packed) || packed < 0) {
      return `entry "${f.path}" declares a size that is not valid`
    }
    const max = f.path === '_manifest.json' ? limits.maxManifestBytes : limits.maxEntryBytes
    if (size > max) return `entry "${f.path}" is ${size} bytes, above the limit of ${max}`
    if (size > limits.ratioFloorBytes && (packed === 0 || size / packed > limits.maxRatio)) {
      return `entry "${f.path}" compresses more than ${limits.maxRatio} to 1`
    }
    total += size
    if (total > limits.maxTotalBytes) {
      return `its entries hold more than ${limits.maxTotalBytes} bytes uncompressed`
    }
  }
  return null
}

/**
 * Read one zip entry into a buffer, and stop as soon as it passes `max` bytes.
 * The central directory's size is only a declaration: the inflate is what is
 * counted, so an entry that inflates past its declared size cannot make main
 * allocate past the limit.
 */
export function readEntryBounded(entry, max) {
  if (Number(entry.uncompressedSize) > max) {
    return Promise.reject(new Error(`entry "${entry.path}" is above the limit of ${max} bytes`))
  }
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    let done = false
    const stream = entry.stream()
    const fail = (err) => {
      if (done) return
      done = true
      stream.destroy?.()
      reject(err)
    }
    stream.on('data', (chunk) => {
      total += chunk.length
      if (total > max) {
        fail(new Error(`entry "${entry.path}" inflates past the limit of ${max} bytes`))
        return
      }
      chunks.push(chunk)
    })
    stream.on('error', fail)
    stream.on('end', () => {
      if (done) return
      done = true
      resolve(Buffer.concat(chunks, total))
    })
  })
}

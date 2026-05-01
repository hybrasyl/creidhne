// Manifest validation. Returns { ok: true, manifest } on success, or
// { ok: false, reason } when the manifest should be rejected. The reason
// is a single human-readable string suitable for a console.warn line.
//
// We're deliberately permissive about extra fields — handlers may consume
// type-specific manifest extensions (`covers.item_icons.no_dye`, etc.) that
// this layer doesn't know about.

const SUPPORTED_SCHEMA_VERSIONS = new Set([1])

export function validateManifest(rawJson) {
  if (rawJson == null || typeof rawJson !== 'object') {
    return { ok: false, reason: 'manifest is not an object' }
  }
  if (!SUPPORTED_SCHEMA_VERSIONS.has(rawJson.schema_version)) {
    return { ok: false, reason: `unsupported schema_version ${rawJson.schema_version}` }
  }
  if (!rawJson.content_type || typeof rawJson.content_type !== 'string') {
    return { ok: false, reason: 'missing or non-string content_type' }
  }
  if (!rawJson.pack_id || typeof rawJson.pack_id !== 'string') {
    return { ok: false, reason: 'missing or non-string pack_id' }
  }
  return { ok: true, manifest: rawJson }
}

export { SUPPORTED_SCHEMA_VERSIONS }

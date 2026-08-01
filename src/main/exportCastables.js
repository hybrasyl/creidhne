import { join } from 'path'
import { promises as fs } from 'fs'
import { parseCastableXml } from './castableXml.js'
import { listSection } from './fsHandlers.js'
import { castableToRecord } from '../shared/castableRecord.js'
import { getCastableExportPreset } from '../shared/castableExportPresets.js'
import { recordsToCsv, recordsToJson } from '../shared/exportSerializers.js'

// The one place a castable export touches disk. Everything downstream — the
// record, the serializers, the presets — is pure and lives in src/shared so
// WP2's report builder can reuse it in the renderer.
//
// `ctx` (the index's `castableTrainers`) is passed in rather than loaded here.
// That keeps this module free of indexService.js, so a test can exercise it
// against a temp directory without touching %LOCALAPPDATA%.

/**
 * Reads every active castable and maps it to a canonical record.
 *
 * Enumeration goes through `listSection`, which recurses into subfolders and
 * excludes the `.ignore` archive. A plain readdir did the second only by
 * accident — `.ignore` is a directory, so `isFile()` dropped it — and missed
 * subfolders entirely, silently omitting rows. Do not replace it.
 */
export async function collectCastableRecords(libraryPath, ctx = {}) {
  const castDir = join(libraryPath, 'castables')

  let active
  try {
    ;({ active } = await listSection(libraryPath, 'castables'))
  } catch {
    return { error: 'Could not read castables directory' }
  }

  const records = []
  for (const rel of active) {
    try {
      const xmlString = await fs.readFile(join(castDir, rel), 'utf-8')
      const castable = await parseCastableXml(xmlString)
      records.push(castableToRecord(castable, ctx))
    } catch {
      /* skip malformed file */
    }
  }
  return { records }
}

/**
 * Runs one named preset over a library.
 *
 * Returns `{ content, defaultName, format }` — the caller writes the file, so
 * this stays testable and the renderer never has to know a preset's file name.
 */
export async function runCastableExport(libraryPath, presetId, ctx = {}) {
  const preset = getCastableExportPreset(presetId)

  const { records, error } = await collectCastableRecords(libraryPath, ctx)
  if (error) return { error }

  const selected = preset.filter ? records.filter(preset.filter) : records
  const content =
    preset.format === 'json'
      ? recordsToJson(selected, preset.columns)
      : recordsToCsv(selected, preset.columns, { headerOnEmpty: preset.headerOnEmpty })

  return { content, defaultName: preset.defaultFileName, format: preset.format }
}

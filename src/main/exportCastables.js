import { join } from 'path'
import { promises as fs } from 'fs'
import { parseCastableXml } from './castableXml.js'
import { listSection } from './fsHandlers.js'
import { castableToRecord, resolveColumns } from '../shared/castableRecord.js'
import { getCastableExportPreset } from '../shared/castableExportPresets.js'
import { compileRules } from '../shared/reportRules.js'
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
 * Renders records through one report definition.
 *
 * A definition is `{ format, columns, match, rules, headerOnEmpty }` — the shape
 * a built-in preset and a user's stored report share. Pure, so the renderer's
 * live preview counts rows through the same code that writes the file.
 */
export function renderReport(records, definition) {
  const columns = resolveColumns(definition.columns)
  const selected = records.filter(compileRules(definition))
  const content =
    definition.format === 'json'
      ? recordsToJson(selected, columns)
      : recordsToCsv(selected, columns, { headerOnEmpty: definition.headerOnEmpty })

  return { content, total: records.length, matched: selected.length }
}

/**
 * Runs one report definition over a library.
 *
 * Returns `{ content, defaultName, format }` — the caller writes the file, so
 * this stays testable and the renderer never has to know a report's file name.
 */
export async function runCastableReport(libraryPath, definition, ctx = {}) {
  const { records, error } = await collectCastableRecords(libraryPath, ctx)
  if (error) return { error }

  const { content, total, matched } = renderReport(records, definition)
  return {
    content,
    defaultName: definition.defaultFileName ?? defaultNameFor(definition),
    format: definition.format,
    total,
    matched
  }
}

/** A user's report has no contracted file name, so one is derived from its label. */
export function defaultNameFor(definition) {
  const slug =
    String(definition?.label ?? 'report')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'report'
  return `${slug}.${definition?.format === 'json' ? 'json' : 'csv'}`
}

/** Runs one of the three fixed built-in reports, by id. */
export async function runCastableExport(libraryPath, presetId, ctx = {}) {
  return runCastableReport(libraryPath, getCastableExportPreset(presetId), ctx)
}

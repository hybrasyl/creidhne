import { join } from 'path'
import { promises as fs } from 'fs'
import { parseCastableXml } from './castableXml.js'
import { parseItemXml } from './itemXml.js'
import { listSection } from './fsHandlers.js'
import { getCastableExportPreset } from '../shared/castableExportPresets.js'
import { getEntity, resolveColumns, compileDefinition } from '../shared/reportEntities.js'
import { recordsToCsv, recordsToJson } from '../shared/exportSerializers.js'

// The one place a report touches disk. Everything downstream — the record mappers,
// the serializers, the rule engine, the presets — is pure and lives in src/shared,
// so the renderer's live preview runs the same code that writes the file.
//
// **The only per-entity thing main knows is which parser to call.** The mappers
// cannot live here because the renderer needs them; the parsers cannot live in
// src/shared because they use xml2js. So the registry in reportEntities.js carries
// everything else — the catalogue, the filter vocabulary, the mapper, the subdir —
// and this table stays two lines long per type.
//
// Named reportRun.js since WP3. It was exportCastables.js, which stopped being true
// the moment it read items.
const PARSERS = {
  castables: parseCastableXml,
  items: parseItemXml
}

/**
 * Reads every active record of one entity and maps it to a canonical record.
 *
 * Enumeration goes through `listSection`, which recurses into subfolders and
 * excludes the `.ignore` archive. A plain readdir did the second only by
 * accident — `.ignore` is a directory, so `isFile()` dropped it — and missed
 * subfolders entirely, silently omitting rows. Do not replace it.
 *
 * `ctx` (the index lookups — `castableTrainers` for castables, `itemVendors` and
 * `itemLootSets` for items) is passed in rather than loaded here. That keeps this
 * module free of indexService.js, so a test can exercise it against a temp
 * directory without touching %LOCALAPPDATA%.
 */
export async function collectRecords(libraryPath, entity, ctx = {}) {
  const { subdir, toRecord } = getEntity(entity)
  const parse = PARSERS[entity]
  if (!parse) throw new Error(`No parser registered for report entity: ${entity}`)

  const dir = join(libraryPath, subdir)

  let active
  try {
    ;({ active } = await listSection(libraryPath, subdir))
  } catch {
    return { error: `Could not read ${subdir} directory` }
  }

  const records = []
  for (const rel of active) {
    try {
      const xmlString = await fs.readFile(join(dir, rel), 'utf-8')
      records.push(toRecord(await parse(xmlString), ctx))
    } catch {
      /* skip malformed file */
    }
  }
  return { records }
}

/** Kept for the castable tests and callers that predate the entity argument. */
export function collectCastableRecords(libraryPath, ctx = {}) {
  return collectRecords(libraryPath, 'castables', ctx)
}

/**
 * Renders records through one report definition.
 *
 * A definition is `{ entity, format, columns, match, rules, headerOnEmpty }` — the
 * shape a built-in preset and a user's stored report share. Pure, so the renderer's
 * live preview counts rows through the same code that writes the file.
 *
 * The columns and the rules resolve against **that entity's** catalogue, so a
 * castable column on an items report throws here rather than writing a blank
 * column into a file somebody reads as data.
 */
export function renderReport(records, definition) {
  const columns = resolveColumns(definition.entity, definition.columns)
  const selected = records.filter(compileDefinition(definition))
  const content =
    definition.format === 'json'
      ? recordsToJson(selected, columns)
      : recordsToCsv(selected, columns, { headerOnEmpty: definition.headerOnEmpty })

  return { content, total: records.length, matched: selected.length }
}

/**
 * Runs one report definition over a library.
 *
 * Returns `{ content, defaultName, format, total, matched }` — the caller writes the
 * file, so this stays testable and the renderer never has to know a report's file
 * name.
 */
export async function runReport(libraryPath, definition, ctx = {}) {
  const { records, error } = await collectRecords(libraryPath, definition.entity, ctx)
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

/** Runs one of the three fixed built-in castable reports, by id. */
export async function runCastableExport(libraryPath, presetId, ctx = {}) {
  return runReport(libraryPath, getCastableExportPreset(presetId), ctx)
}

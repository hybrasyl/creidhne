import { execFile } from 'child_process'
import { existsSync, promises as fs } from 'fs'
import { join } from 'path'
import { INDEX_TYPES, listSectionFiles } from '@eriscorp/hybindex-ts'
import { REFERENCE_SITES, REFERENCED_TYPES } from '../../shared/entityReferences.js'
import {
  DUPLICATE_CHECKED_TYPES,
  duplicateNameStatus,
  nameCollisionKey
} from '../../shared/nameCollision.js'
import { duplicateKeyGroups } from '../../shared/duplicateKeys.js'
import { shouldOfferRepair } from '../../shared/renameRepair.js'
import {
  STAGED_TYPES,
  STAGING_FOLDER_TYPES,
  releaseClashes,
  stagedFileFor,
  stagedKeyClash,
  stagedNames,
  stagedOnlyReferences
} from '../../shared/staging.js'
import {
  REPORT_ENTITY_NAMES,
  findEntity,
  presetsFor,
  validateDefinition
} from '../../shared/reportEntities.js'
import { validateElementTable } from '../../shared/elementTable.js'
import { validateTrait } from '../../shared/traitValidate.js'
import { validateSpecies } from '../../shared/speciesValidate.js'
import { referencedNames } from '../entityRefScan.js'
import { applyRename, scanReferences } from '../entityRefRepair.js'
import { releaseFiles, stageFiles } from '../staging.js'
import { collectRecords, renderReport } from '../reportRun.js'
import { parseElementTableXml } from '../elementTableXml.js'
import { parseTraitXml } from '../traitXml.js'
import { parseSpeciesXml } from '../speciesXml.js'
import { KNOWN_DRIFT, validateHybrasylXml } from '../xsdValidator.js'
import { NAMED_TYPES, readEntityName, rewriteEntityName } from './entityName.js'
import { AgentError, fileSide, guardWrite, worldPath, worldRel } from './context.js'

/**
 * One function for each command of the world agent (WP8). Each one calls the
 * function the GUI calls; a difference between the two is a bug. Every path in
 * a result is relative to the world root, with forward slashes.
 */

const key = (name) => nameCollisionKey(String(name ?? '').trim())
const livePath = (type, rel) => `xml/${type}/${rel}`
const stagedPath = (type, rel) => `.staging/${type}/${rel}`

/** Lists longer than this are cut unless the command is given `--all`. */
export const LIST_LIMIT = 25

function cut(list, all) {
  return all || list.length <= LIST_LIMIT
    ? { items: list }
    : { items: list.slice(0, LIST_LIMIT), more: list.length - LIST_LIMIT }
}

function assertType(type, allowed, what) {
  if (!allowed.includes(type)) {
    throw new AgentError(`${what} takes a type of ${allowed.join(', ')}, not "${type}"`)
  }
}

/** `{ rel: name }` for one type's live files, archived ones included (`.ignore/…`). */
function liveNamesByFile(index, type) {
  if (type === 'maps') {
    return Object.fromEntries((index?.mapDetails || []).map((d) => [d.filename, d.name]))
  }
  return index?.[`${type}NamesByFilename`] || {}
}

const isArchivedRel = (rel) => rel.split('/').includes('.ignore')

/** Every file of `type` whose name has the key of `name`: live (not archived) and staged. */
function claimants(index, staged, type, name) {
  const k = key(name)
  const live = Object.entries(liveNamesByFile(index, type))
    .filter(([rel, n]) => !isArchivedRel(rel) && key(n) === k)
    .map(([rel]) => rel)
  const stagedFiles = Object.entries(staged?.[type]?.namesByFilename || {})
    .filter(([, n]) => key(n) === k)
    .map(([rel]) => rel)
  return { live: live.sort(), staged: stagedFiles.sort() }
}

async function readFileText(abs) {
  try {
    return await fs.readFile(abs, 'utf8')
  } catch (err) {
    throw new AgentError(`Cannot read ${abs}: ${err.code || err.message}`)
  }
}

/** A world file the agent named, with where it sits. */
function locate(ctx, file) {
  const abs = worldPath(ctx, file)
  const where = fileSide(ctx, abs)
  if (!where) throw new AgentError(`${file} is not under xml/<type>/ or .staging/<type>/`)
  return { abs, ...where, path: worldRel(ctx, abs) }
}

// ── Read ─────────────────────────────────────────────────────────────────────

/** The entities whose name key holds `text`, exact matches first. */
export async function find(ctx, text, { type, all } = {}) {
  const q = key(text)
  if (!q) throw new AgentError('find needs a name')
  const index = await ctx.index()
  const staged = await ctx.staged()
  const types = type ? [type] : [...new Set([...INDEX_TYPES, ...STAGING_FOLDER_TYPES])]
  const hits = []
  for (const t of types) {
    for (const [rel, name] of Object.entries(liveNamesByFile(index, t))) {
      const k = key(name)
      if (k.includes(q)) {
        const side = isArchivedRel(rel) ? 'archived' : 'live'
        hits.push({ type: t, name, side, file: livePath(t, rel), exact: k === q })
      }
    }
    for (const [rel, name] of Object.entries(staged?.[t]?.namesByFilename || {})) {
      const k = key(name)
      if (k.includes(q))
        hits.push({ type: t, name, side: 'staged', file: stagedPath(t, rel), exact: k === q })
    }
  }
  hits.sort((a, b) => Number(b.exact) - Number(a.exact) || a.name.localeCompare(b.name))
  return { query: text, total: hits.length, ...cut(hits, all) }
}

/** Lua files that hold the name as a quoted string, case folded. Report only. */
export async function scanScripts(ctx, name) {
  const dir = join(ctx.root, 'scripts')
  if (!existsSync(dir)) return { searched: false, hits: [] }
  const k = key(name)
  const hits = []
  const walk = async (sub) => {
    for (const entry of await fs.readdir(join(dir, sub), { withFileTypes: true })) {
      const rel = sub ? `${sub}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (entry.name !== '.ignore' && !entry.name.startsWith('.')) await walk(rel)
      } else if (entry.name.toLowerCase().endsWith('.lua')) {
        const lines = (await fs.readFile(join(dir, rel), 'utf8')).split(/\r?\n/)
        lines.forEach((line, i) => {
          for (const m of line.matchAll(/(["'])((?:(?!\1).)*)\1/g)) {
            if (key(m[2]) === k) {
              hits.push({ file: `scripts/${rel}`, line: i + 1, text: line.trim().slice(0, 200) })
              break
            }
          }
        })
      }
    }
  }
  await walk('')
  return { searched: true, anchored: false, hits }
}

/** The files that name an entity, live and staged, with a count for each. */
export async function refs(ctx, type, name, { scripts, all } = {}) {
  assertType(type, REFERENCED_TYPES, 'refs')
  const live = await scanReferences(ctx.lib, type, name)
  const staged = await scanReferences(ctx.staging, type, name)
  const files = [
    ...live.files.map((f) => ({
      file: livePath(f.sourceType, f.rel),
      type: f.sourceType,
      count: f.count,
      side: 'live'
    })),
    ...staged.files.map((f) => ({
      file: stagedPath(f.sourceType, f.rel),
      type: f.sourceType,
      count: f.count,
      side: 'staged'
    }))
  ]
  const unreadable = [
    ...live.unreadable.map((f) => livePath(f.sourceType, f.rel)),
    ...staged.unreadable.map((f) => stagedPath(f.sourceType, f.rel))
  ]
  return {
    type,
    name,
    total: live.total + staged.total,
    files: cut(files, all),
    unreadable,
    ...(scripts ? { scripts: await scanScripts(ctx, name) } : {})
  }
}

/** The status of a referenced name: live, staged-only, or missing. */
function referenceStatus(index, staged, type, name) {
  const k = key(name)
  if ((index?.[type] || []).some((n) => key(n) === k)) return 'live'
  if (stagedNames(staged, type).some((n) => key(n) === k)) return 'staged-only'
  return 'missing'
}

/** The entities one file names, and whether each one resolves. */
export async function namesIn(ctx, file) {
  const f = locate(ctx, file)
  const index = await ctx.index()
  const staged = await ctx.staged()
  const found = referencedNames(await readFileText(f.abs), f.type)
  const names = []
  for (const type of Object.keys(found).sort()) {
    for (const name of found[type])
      names.push({ type, name, status: referenceStatus(index, staged, type, name) })
  }
  const count = (s) => names.filter((n) => n.status === s).length
  return {
    file: f.path,
    type: f.type,
    side: f.side,
    summary: { live: count('live'), stagedOnly: count('staged-only'), missing: count('missing') },
    names
  }
}

/** Whether a name collides with a live, archived or staged entity of the type. */
export async function collide(ctx, type, name) {
  assertType(type, DUPLICATE_CHECKED_TYPES, 'collide')
  const index = await ctx.index()
  const staged = await ctx.staged()
  const live = duplicateNameStatus({ libraryIndex: index, type, name })
  const files = claimants(index, staged, type, name)
  const archived = Object.entries(liveNamesByFile(index, type))
    .filter(([rel, n]) => isArchivedRel(rel) && key(n) === key(name))
    .map(([rel]) => livePath(type, rel))
  return {
    type,
    name,
    collides: live === 'active' || files.staged.length > 0,
    live,
    staged: files.staged.length > 0,
    files: [
      ...files.live.map((rel) => livePath(type, rel)),
      ...archived,
      ...files.staged.map((rel) => stagedPath(type, rel))
    ]
  }
}

/** The keys that more than one active file holds (the server loads one of them). */
export async function duplicates(ctx, { type } = {}) {
  const groups = duplicateKeyGroups(await ctx.index())
    .filter((g) => !type || g.type === type)
    .map((g) => ({ ...g, files: g.files.map((rel) => livePath(g.type, rel)) }))
  return { total: groups.length, groups }
}

/** The source types whose files can name another entity. */
const SOURCE_TYPES = [
  ...new Set(
    Object.values(REFERENCE_SITES)
      .flat()
      .map((s) => s.type)
  )
].sort()

/**
 * The world's problems:
 * - stagedOnly: a live file names an entity that exists only in staging. The
 *   server cannot resolve it, and nothing else reports it.
 * - missing: a file names an entity that exists nowhere. The server reports
 *   these at load; they are counted for each edge and listed up to the limit.
 * - duplicates: keys that more than one active file holds.
 * - stagedTwins: staged files whose name is already live. Release refuses them.
 */
export async function check(ctx, { type, all } = {}) {
  const index = await ctx.index()
  const staged = await ctx.staged()
  const stagedOnly = []
  const missing = []
  const unreadable = []
  const sources = type ? SOURCE_TYPES.filter((t) => t === type) : SOURCE_TYPES
  for (const [root, side] of [
    [ctx.lib, 'live'],
    [ctx.staging, 'staged']
  ]) {
    if (!existsSync(root)) continue
    for (const src of sources) {
      const { dir, active } = await listSectionFiles(root, src)
      for (const rel of active) {
        let xml
        try {
          xml = await fs.readFile(join(dir, rel), 'utf8')
        } catch {
          unreadable.push(side === 'live' ? livePath(src, rel) : stagedPath(src, rel))
          continue
        }
        const file = side === 'live' ? livePath(src, rel) : stagedPath(src, rel)
        for (const [target, names] of Object.entries(referencedNames(xml, src))) {
          for (const name of names) {
            const status = referenceStatus(index, staged, target, name)
            if (status === 'staged-only' && side === 'live')
              stagedOnly.push({ file, type: target, name })
            else if (status === 'missing') missing.push({ file, side, type: target, name })
          }
        }
      }
    }
  }
  const byEdge = {}
  for (const m of missing) {
    const edge = `${m.file.split('/')[1]} -> ${m.type}`
    byEdge[edge] = (byEdge[edge] || 0) + 1
  }
  const dupes = (await duplicates(ctx, { type })).groups
  const stagedTwins = []
  for (const t of Object.keys(staged).sort()) {
    if (type && t !== type) continue
    for (const rel of Object.keys(staged[t].namesByFilename || {}).sort()) {
      const clash = stagedKeyClash(index, staged, t, rel)
      if (clash?.live.length)
        stagedTwins.push({
          file: stagedPath(t, rel),
          name: clash.name,
          live: clash.live.map((r) => livePath(t, r))
        })
    }
  }
  return {
    summary: {
      stagedOnly: stagedOnly.length,
      missing: missing.length,
      duplicates: dupes.length,
      stagedTwins: stagedTwins.length,
      unreadable: unreadable.length
    },
    stagedOnly: cut(stagedOnly, all),
    missing: { byEdge, ...cut(missing, all) },
    duplicates: cut(dupes, all),
    stagedTwins: cut(stagedTwins, all),
    unreadable
  }
}

/** The staged files of each type, and how each one stands against the live world. */
export async function staging(ctx, { type } = {}) {
  const index = await ctx.index()
  const staged = await ctx.staged()
  const types = Object.keys(staged)
    .filter((t) => !type || t === type)
    .sort()
  const out = []
  for (const t of types) {
    const files = Object.entries(staged[t].namesByFilename || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([rel, name]) => {
        const clash = stagedKeyClash(index, staged, t, rel)
        return {
          file: stagedPath(t, rel),
          name,
          liveTwin: (clash?.live || []).map((r) => livePath(t, r)),
          stagedTwin: (clash?.staged || []).map((r) => stagedPath(t, r))
        }
      })
    out.push({ type: t, count: files.length, files })
  }
  return { types: out }
}

/** Report rows for castables or items, as JSON, through a preset or rules. */
export async function report(ctx, entity, { preset, rules, columns, match, all } = {}) {
  if (!findEntity(entity)) {
    throw new AgentError(
      `report takes an entity of ${REPORT_ENTITY_NAMES.join(', ')}, not "${entity}"`
    )
  }
  let definition
  if (preset) {
    const found = presetsFor(entity).find((p) => p.id === preset)
    if (!found) {
      const ids = presetsFor(entity).map((p) => p.id)
      throw new AgentError(`No ${entity} preset "${preset}". The presets: ${ids.join(', ')}`)
    }
    definition = found
  } else {
    let parsedRules = []
    if (rules) {
      try {
        parsedRules = JSON.parse(rules)
      } catch (err) {
        throw new AgentError(`--rules is not JSON: ${err.message}`)
      }
    }
    const cols = columns
      ? columns === 'all'
        ? findEntity(entity).columns.map((c) => c.key)
        : columns
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean)
      : ['name']
    definition = { entity, columns: cols, match: match ?? 'all', rules: parsedRules }
  }
  const problems = validateDefinition(definition)
  if (problems.length) throw new AgentError(`The report is not valid: ${problems.join('; ')}`)
  const index = await ctx.index()
  const reportCtx = {
    castableTrainers: index?.castableTrainers || {},
    itemVendors: index?.itemVendors || {},
    itemLootSets: index?.itemLootSets || {}
  }
  const { records, error } = await collectRecords(ctx.lib, entity, reportCtx)
  if (error) throw new AgentError(error)
  const { content, total, matched } = renderReport(records, { ...definition, format: 'json' })
  const rows = JSON.parse(content)
  return { entity, preset: preset ?? null, total, matched, rows: cut(rows, all) }
}

function gitChangedXml(root) {
  return new Promise((done) =>
    execFile(
      'git',
      ['status', '--porcelain', '-z', '--untracked-files=all'],
      { cwd: root },
      (err, out) => {
        if (err) return done([])
        const paths = out
          .split('\0')
          .filter(Boolean)
          .map((entry) => entry.slice(3))
          .filter((p) => /^(xml|\.staging)\//.test(p) && p.toLowerCase().endsWith('.xml'))
        done([...new Set(paths)])
      }
    )
  )
}

/** XSD validation of the files, or of each changed world file in the work tree. */
export async function validate(ctx, files = [], { xsdRoot } = {}) {
  const targets = files.length ? files : await gitChangedXml(ctx.root)
  const results = []
  for (const file of targets) {
    const f = locate(ctx, file)
    if (!existsSync(f.abs)) continue // a deleted file in the git status
    const xml = await readFileText(f.abs)
    let drift = KNOWN_DRIFT[f.type] ?? null
    if (f.type === 'elementtables' && !(await parseElementTableXml(xml)).registry)
      drift = 'the old element table format; the schema refuses it by design (HTOO-581)'
    const result = await validateHybrasylXml(xml, f.path, { xsdRoot })
    const errors = String(result.rawOutput ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/validates$/.test(l))
    results.push({
      file: f.path,
      valid: result.valid,
      ...(result.valid ? {} : { errors: errors.slice(0, 20), drift })
    })
  }
  const invalid = results.filter((r) => !r.valid)
  return {
    checked: results.length,
    from: files.length ? 'arguments' : 'git status',
    summary: {
      valid: results.length - invalid.length,
      invalid: invalid.length,
      drift: invalid.filter((r) => r.drift).length
    },
    results
  }
}

/** The element table's problems, and whether it is in the old format. */
export async function elementTable(ctx, file) {
  const f = locate(ctx, file)
  const table = await parseElementTableXml(await readFileText(f.abs))
  return { file: f.path, oldFormat: !table.registry, problems: validateElementTable(table) }
}

/** The checks the server runs on a trait at load. */
export async function trait(ctx, file) {
  const f = locate(ctx, file)
  const index = await ctx.index()
  const t = await parseTraitXml(await readFileText(f.abs))
  return { file: f.path, name: t.name, problems: validateTrait(t, index?.traits ?? null) }
}

/** The checks the server runs on a species at load. */
export async function species(ctx, file) {
  const f = locate(ctx, file)
  const index = await ctx.index()
  const s = await parseSpeciesXml(await readFileText(f.abs))
  const problems = validateSpecies(
    s,
    index?.speciesDetails
      ? {
          details: index.speciesDetails,
          bodyIds: index.speciesBodyIds,
          duplicateNames: index.speciesDuplicateNames,
          originalKey: s.key
        }
      : undefined
  )
  return { file: f.path, key: s.key, problems }
}

// ── Write ────────────────────────────────────────────────────────────────────

/** The lines that differ between two texts, as `{ line, before, after }`. */
function changedLines(before, after) {
  const a = before.split('\n')
  const b = after.split('\n')
  const out = []
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i])
      out.push({ line: i + 1, before: (a[i] ?? '').trim(), after: (b[i] ?? '').trim() })
  }
  return out
}

/**
 * Rename an entity: its own `<Name>` (a one-line text edit), then every
 * reference to it in live and staged files. With `refsOnly`, the references
 * only, for an entity a person renamed by hand.
 *
 * Refused: a new name that is already active or staged; an old name that two
 * files claim (every reference to it is ambiguous); with `refsOnly`, an old
 * name that an entity still has (its references still resolve).
 */
export async function rename(ctx, type, oldName, newName, { refsOnly, write, scripts, all } = {}) {
  assertType(type, NAMED_TYPES, 'rename')
  if (!key(oldName) || !key(newName)) throw new AgentError('rename needs an old and a new name')
  if (oldName.trim() === newName.trim())
    throw new AgentError('The old and the new name are the same')
  const index = await ctx.index()
  const staged = await ctx.staged()
  const warnings = []

  // With refsOnly the new name is the entity's own, so it is expected to be taken.
  const sameKey = key(oldName) === key(newName) || refsOnly
  if (!sameKey && DUPLICATE_CHECKED_TYPES.includes(type)) {
    const status = duplicateNameStatus({ libraryIndex: index, type, name: newName })
    if (status === 'active') throw new AgentError(`"${newName}" is already an active ${type} name`)
    if (status === 'archived') warnings.push(`"${newName}" is the name of an archived ${type} file`)
  }
  if (!sameKey && claimants(index, staged, type, newName).staged.length) {
    throw new AgentError(`"${newName}" is already a staged ${type} name`)
  }

  const old = claimants(index, staged, type, oldName)
  let entity = null
  if (refsOnly) {
    if (old.live.length || old.staged.length) {
      const files = [
        ...old.live.map((r) => livePath(type, r)),
        ...old.staged.map((r) => stagedPath(type, r))
      ]
      throw new AgentError(
        `"${oldName}" is still the name of ${files.join(', ')}; its references resolve`
      )
    }
    if (
      !claimants(index, staged, type, newName).live.length &&
      !claimants(index, staged, type, newName).staged.length
    )
      warnings.push(`No ${type} file is named "${newName}" yet`)
  } else if (old.live.length === 1) {
    entity = { side: 'live', rel: old.live[0], abs: join(ctx.lib, type, old.live[0]) }
  } else if (old.live.length === 0 && old.staged.length === 1) {
    entity = { side: 'staged', rel: old.staged[0], abs: join(ctx.staging, type, old.staged[0]) }
  } else if (old.live.length === 0 && old.staged.length === 0) {
    throw new AgentError(`No ${type} file is named "${oldName}"`)
  } else {
    const files = [
      ...old.live.map((r) => livePath(type, r)),
      ...old.staged.map((r) => stagedPath(type, r))
    ]
    throw new AgentError(`"${oldName}" is claimed by more than one file: ${files.join(', ')}`)
  }

  // The GUI's rule (HTOO-378): a staged entity counts claimants over live AND
  // staged files, so a staged twin of a live entity is never repaired.
  const offerIndex =
    entity?.side === 'staged'
      ? { [type]: [...(index?.[type] || []), ...stagedNames(staged, type)] }
      : index
  const offer = refsOnly
    ? REFERENCE_SITES[type]?.length
      ? { offer: true }
      : { offer: false, reason: 'no-references-possible' }
    : shouldOfferRepair({ libraryIndex: offerIndex, type, oldName, newName, isExisting: true })
  if (!offer.offer && offer.reason === 'ambiguous-old-name')
    warnings.push(`References are not repointed: "${oldName}" has more than one claimant`)

  let entityPlan = null
  let entityNext = null
  if (entity) {
    const before = await readFileText(entity.abs)
    try {
      entityNext = rewriteEntityName(type, before, oldName, newName)
    } catch (err) {
      throw new AgentError(`${worldRel(ctx, entity.abs)}: ${err.message}`)
    }
    entityPlan = {
      file: worldRel(ctx, entity.abs),
      side: entity.side,
      lines: changedLines(before, entityNext)
    }
  }

  let references = { total: 0, files: [] }
  if (offer.offer) {
    const scan = await refs(ctx, type, oldName, { all: true })
    references = { total: scan.total, files: scan.files.items, unreadable: scan.unreadable }
  }
  const lua = scripts ? await scanScripts(ctx, oldName) : undefined

  const changed = []
  const failed = []
  if (write) {
    if (entity) {
      await fs.writeFile(guardWrite(ctx, entity.abs), entityNext, 'utf8')
      changed.push(worldRel(ctx, entity.abs))
    }
    if (offer.offer) {
      const guard = (p) => guardWrite(ctx, p)
      const live = await applyRename(ctx.lib, type, oldName, newName, guard)
      const stagedRes = await applyRename(ctx.staging, type, oldName, newName, guard)
      changed.push(
        ...live.changed.map((f) => livePath(f.sourceType, f.rel)),
        ...stagedRes.changed.map((f) => stagedPath(f.sourceType, f.rel))
      )
      failed.push(
        ...live.failed.map((f) => ({ file: livePath(f.sourceType, f.rel), error: f.error })),
        ...stagedRes.failed.map((f) => ({ file: stagedPath(f.sourceType, f.rel), error: f.error }))
      )
      const liveTypes = live.changed.map((f) => f.sourceType)
      await ctx.refresh([...(entity?.side === 'live' ? [type] : []), ...liveTypes])
    } else if (entity?.side === 'live') {
      await ctx.refresh([type])
    }
  }

  return {
    type,
    oldName,
    newName,
    entity: entityPlan,
    references: { ...references, files: cut(references.files, all) },
    ...(offer.offer ? {} : { repair: offer.reason }),
    ...(lua ? { scripts: lua } : {}),
    warnings,
    written: !!write,
    changed,
    failed
  }
}

/** A list of files of one type on one side, as absolute paths. */
function filesOn(ctx, type, files, side) {
  const base = side === 'live' ? join(ctx.lib, type) : join(ctx.staging, type)
  return files.map((file) => {
    const f = locate(ctx, file)
    if (f.type !== type || (side === 'live' ? f.side !== 'live' : f.side !== 'staged')) {
      const where = side === 'live' ? `xml/${type}/ (not archived)` : `.staging/${type}/`
      throw new AgentError(`${f.path} is not in ${where}`)
    }
    if (!existsSync(f.abs)) throw new AgentError(`${f.path} does not exist`)
    return {
      ...f,
      dest: side === 'live' ? join(ctx.staging, type, f.rel) : join(ctx.lib, type, f.rel),
      base
    }
  })
}

/**
 * Move live files to `.staging/<type>/`. Names the live files that refer to
 * each one, because after the move they name a staged-only entity.
 */
export async function stage(ctx, type, files, { write } = {}) {
  assertType(type, STAGED_TYPES, 'stage')
  const list = filesOn(ctx, type, files, 'live')
  const moves = []
  for (const f of list) {
    const name = NAMED_TYPES.includes(type) ? readEntityName(type, await readFileText(f.abs)) : ''
    let referrers = []
    if (name && REFERENCE_SITES[type]?.length) {
      const scan = await scanReferences(ctx.lib, type, name)
      referrers = scan.files.map((r) => livePath(r.sourceType, r.rel)).sort()
    }
    moves.push({
      from: f.path,
      to: worldRel(ctx, f.dest),
      name,
      conflict: existsSync(f.dest),
      liveReferrers: referrers
    })
  }
  const warnings = moves
    .filter((m) => m.liveReferrers.length)
    .map(
      (m) =>
        `${m.liveReferrers.length} live file(s) name "${m.name}"; after the move they name a staged-only ${type}`
    )
  let result = { ok: [], failed: [] }
  if (write) {
    result = await stageFiles(
      ctx.lib,
      type,
      list.map((f) => f.abs),
      (p) => guardWrite(ctx, p)
    )
    await ctx.refresh([type])
  }
  return {
    type,
    moves,
    warnings,
    written: !!write,
    changed: result.ok.flatMap((m) => [worldRel(ctx, m.src), worldRel(ctx, m.dest)]),
    failed: result.failed.map((m) => ({ file: worldRel(ctx, m.src), reason: m.reason }))
  }
}

/**
 * Move staged files to `xml/<type>/`. Refused when a name is already live, or
 * when two files of the release share one. The staged-only entities a file
 * names are listed as needs; `withDeps` releases them too, and theirs.
 */
export async function release(ctx, type, files, { write, withDeps } = {}) {
  assertType(type, STAGING_FOLDER_TYPES, 'release')
  const index = await ctx.index()
  const staged = await ctx.staged()
  const batch = new Map() // "type\0rel" → { type, rel, abs, path, requestedBy }
  const add = (t, rel, requestedBy) => {
    const k = `${t}\0${rel}`
    if (batch.has(k)) return false
    const abs = join(ctx.staging, t, rel)
    batch.set(k, { type: t, rel, abs, path: worldRel(ctx, abs), requestedBy })
    return true
  }
  for (const f of filesOn(ctx, type, files, 'staged')) add(type, f.rel, null)

  // Follow the staged-only names each file holds, breadth first.
  const needs = []
  const queue = [...batch.values()]
  while (queue.length) {
    const f = queue.shift()
    const found = referencedNames(await readFileText(f.abs), f.type)
    for (const dep of stagedOnlyReferences(found, index, staged)) {
      const rel = stagedFileFor(staged, dep.type, dep.name)
      if (!rel) continue
      if (batch.has(`${dep.type}\0${rel}`)) continue
      needs.push({
        file: stagedPath(dep.type, rel),
        type: dep.type,
        name: dep.name,
        neededBy: f.path
      })
      if (withDeps && STAGING_FOLDER_TYPES.includes(dep.type) && add(dep.type, rel, f.path))
        queue.push(batch.get(`${dep.type}\0${rel}`))
    }
  }

  const entries = [...batch.values()].map((f) => ({
    ...f,
    name: staged?.[f.type]?.namesByFilename?.[f.rel] ?? ''
  }))
  const clashes = releaseClashes(entries, index).map((c) => ({
    file: c.path,
    name: c.name,
    reason: c.reason
  }))
  const moves = entries.map((f) => ({
    from: f.path,
    to: livePath(f.type, f.rel),
    name: f.name,
    ...(f.requestedBy ? { neededBy: f.requestedBy } : {}),
    conflict: existsSync(join(ctx.lib, f.type, f.rel))
  }))
  const unmet = withDeps ? [] : needs
  const warnings = unmet.map(
    (n) => `${n.neededBy} names "${n.name}", which only ${n.file} has; release it too (--with-deps)`
  )

  if (write && clashes.length) {
    throw new AgentError(
      `Release refused: ${clashes.map((c) => `${c.file} ("${c.name}", ${c.reason === 'live' ? 'already live' : 'twice in this release'})`).join('; ')}`
    )
  }
  const changed = []
  const failed = []
  if (write) {
    const byType = new Map()
    for (const f of entries) byType.set(f.type, [...(byType.get(f.type) || []), f.abs])
    for (const [t, srcs] of byType) {
      const r = await releaseFiles(ctx.lib, t, srcs, (p) => guardWrite(ctx, p))
      changed.push(...r.ok.flatMap((m) => [worldRel(ctx, m.src), worldRel(ctx, m.dest)]))
      failed.push(...r.failed.map((m) => ({ file: worldRel(ctx, m.src), reason: m.reason })))
    }
    await ctx.refresh([...byType.keys()])
  }
  return { type, moves, clashes, needs: unmet, warnings, written: !!write, changed, failed }
}

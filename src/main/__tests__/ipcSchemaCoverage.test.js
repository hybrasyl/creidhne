import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

/**
 * HTOO-370. Every registered IPC channel must have a recorded answer to one
 * question: what validates the payload the renderer sends it?
 *
 * The schemas are the smaller half of this card. A one-time sweep of ninety-odd
 * handlers does not stay swept, and this card is its own evidence — it was filed
 * saying "four of 89", and by the time anyone came back the real number was seven
 * of 92. It had moved in the good direction and nobody noticed, which means it
 * could as easily have moved the other way. A count in a document cannot hold a
 * boundary.
 *
 * So the channel list is read out of `index.js`, which is the only thing that can
 * be authoritative about what is registered. Each channel is then either
 *
 *   - validated: a `parseOrLog(schemaCtx, '<channel>'` call exists for it, or
 *   - listed in EXEMPT below with a category and a reason.
 *
 * Add a handler and the suite names the channel you did not classify. Delete one
 * and it names the stale exempt entry. Neither is satisfiable by editing a number.
 *
 * The channel argument must be a LITERAL for this to see it. That is a real
 * constraint on `index.js`, and it is why `schemas/worldEntity.js` deliberately
 * does not export a channel→schema table for the fourteen save handlers to be
 * registered from: a loop over such a table would hide all fourteen from the
 * check that exists to keep them registered.
 */

const MAIN_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'index.js'),
  'utf8'
)

/** Every `ipc.handle('channel'` registration. */
const registeredChannels = [...MAIN_SRC.matchAll(/ipc\.handle\(\s*'([^']+)'/g)].map((m) => m[1])

/** Every `parseOrLog(schemaCtx, 'channel'` call site. */
const validatedChannels = new Set(
  [...MAIN_SRC.matchAll(/parseOrLog\(\s*schemaCtx,\s*'([^']+)'/g)].map((m) => m[1])
)

/**
 * Why a channel needs no schema. The categories are not a filing convenience —
 * each is the argument for why the exposure is closed:
 *
 * - `no-payload` — takes no renderer argument. Nothing to validate.
 * - `path-only` — every argument is a path or a path component, and
 *   `pathSafety.js` owns those. A non-string reaches `normalize()` and throws
 *   there, so the boundary still fails closed; it just fails with Node's message
 *   instead of ours.
 * - `registry-key` — a lookup key into an in-memory structure. A wrong key finds
 *   nothing and writes nothing.
 *
 * The rule that decides membership is whether the payload gets WRITTEN, not
 * whether it is a string. That rule is what moved `castable:addCategoryBulk` and
 * `spellbook:apply` out of this table: their arguments look like names, and they
 * are written into every castable file the names select.
 */
const EXEMPT = {
  // ── no payload ────────────────────────────────────────────────────────────
  'settings:load': { category: 'no-payload', reason: 'reads settings.json' },
  'get-user-data-path': { category: 'no-payload', reason: 'returns a constant' },
  'app:getVersion': { category: 'no-payload', reason: 'returns app.getVersion()' },
  'app:checkForUpdates': { category: 'no-payload', reason: 'queries the release feed' },
  'app:revealSettings': { category: 'no-payload', reason: 'shows settings.json in the OS shell' },
  'app:launchCompanion': {
    category: 'no-payload',
    reason: 'main resolves the companion; the renderer names no path'
  },
  'app:companionStatus': { category: 'no-payload', reason: 'reports the resolved companion' },
  'constants:loadXsdTypes': { category: 'no-payload', reason: 'reads the bundled XSDs' },
  'diagnostics:build': { category: 'no-payload', reason: 'assembles the report in main' },
  'diagnostics:revealLogs': { category: 'no-payload', reason: 'opens the log directory' },
  'dialog:openFile': { category: 'no-payload', reason: 'an unfiltered open dialog' },
  'dialog:openExeFile': {
    category: 'no-payload',
    reason: 'the companion picker; filters come from main'
  },
  'open-directory': { category: 'no-payload', reason: 'a directory picker' },
  'pack:listActive': { category: 'no-payload', reason: 'lists loaded packs' },
  'pack:reload': { category: 'no-payload', reason: 'reloads from configured sources' },
  'pack:suggestedBrigidAssetsPath': { category: 'no-payload', reason: 'returns a derived path' },

  // ── path-only ─────────────────────────────────────────────────────────────
  'fs:readFile': { category: 'path-only', reason: 'validatePath' },
  'fs:listSection': {
    category: 'path-only',
    reason: 'library path via validatePath; `type` via assertInside against it'
  },
  'fs:moveFile': { category: 'path-only', reason: 'both paths via validatePath' },
  'fs:archiveFile': { category: 'path-only', reason: 'both paths via validatePath' },
  'fs:archiveFiles': { category: 'path-only', reason: 'every path via validatePath' },
  'fs:unarchiveFiles': { category: 'path-only', reason: 'every path via validatePath' },
  'fs:trashFiles': { category: 'path-only', reason: 'every path via validatePath' },
  'fs:duplicateFile': { category: 'path-only', reason: 'validatePath' },
  'fs:checkClientPath': { category: 'path-only', reason: 'validatePath' },
  'fs:readClientFile': {
    category: 'path-only',
    reason: 'client root via validatePath; `rel` via assertInside against it'
  },
  'script:open': {
    category: 'path-only',
    reason: 'library root via validatePath; the relative path via assertInside'
  },
  'lua:setupEnvironment': {
    category: 'path-only',
    reason: 'validatePath; the stub content it writes is generated in main, not sent'
  },
  'index:build': { category: 'path-only', reason: 'validatePath' },
  'index:load': { category: 'path-only', reason: 'validatePath' },
  'index:status': { category: 'path-only', reason: 'validatePath' },
  'index:delete': { category: 'path-only', reason: 'validatePath' },
  'index:buildSection': {
    category: 'path-only',
    reason: 'library path via validatePath; `section` names a directory under it'
  },
  'constants:loadUserConstants': { category: 'path-only', reason: 'validatePath' },
  'constants:scanCategories': { category: 'path-only', reason: 'validatePath' },
  'constants:scanCookies': { category: 'path-only', reason: 'validatePath' },
  'constants:scanCreatureFamilies': { category: 'path-only', reason: 'validatePath' },
  'constants:scanNpcJobs': { category: 'path-only', reason: 'validatePath' },
  'constants:scanVendorTabs': { category: 'path-only', reason: 'validatePath' },
  'formulas:load': { category: 'path-only', reason: 'validatePath' },
  'formulas:import': { category: 'path-only', reason: 'validatePath; reads, does not write' },
  'reports:load': { category: 'path-only', reason: 'validatePath; the file is validated on load' },
  'export:castablesBalancingCsv': {
    category: 'path-only',
    reason: 'validatePath; the preset id is a literal fixed in main'
  },
  'export:castablesWebCsv': {
    category: 'path-only',
    reason: 'validatePath; the preset id is a literal fixed in main'
  },
  'export:castablesWebJson': {
    category: 'path-only',
    reason: 'validatePath; the preset id is a literal fixed in main'
  },
  'xml:loadItem': { category: 'path-only', reason: 'validatePath' },
  'xml:loadRecipe': { category: 'path-only', reason: 'validatePath' },
  'xml:loadNpc': { category: 'path-only', reason: 'validatePath' },
  'xml:loadNation': { category: 'path-only', reason: 'validatePath' },
  'xml:loadLoot': { category: 'path-only', reason: 'validatePath' },
  'xml:loadVariantGroup': { category: 'path-only', reason: 'validatePath' },
  'xml:loadLocalization': { category: 'path-only', reason: 'validatePath' },
  'xml:loadCreature': { category: 'path-only', reason: 'validatePath' },
  'xml:loadElementTable': { category: 'path-only', reason: 'validatePath' },
  'xml:loadStatus': { category: 'path-only', reason: 'validatePath' },
  'xml:loadCastable': { category: 'path-only', reason: 'validatePath' },
  'xml:loadBehaviorSet': { category: 'path-only', reason: 'validatePath' },
  'xml:loadSpawngroup': { category: 'path-only', reason: 'validatePath' },
  'xml:loadServerConfig': { category: 'path-only', reason: 'validatePath' },

  // ── registry-key ──────────────────────────────────────────────────────────
  'pack:listCoveredIds': {
    category: 'registry-key',
    reason: 'subtype keys an in-memory coverage map; an unknown key returns an empty list'
  },
  'pack:resolveAsset': {
    category: 'registry-key',
    reason: 'subtype + id key the same map; a miss returns null'
  },
  'pack:resolveAssetUrl': {
    category: 'registry-key',
    reason: 'subtype + id key the same map; a miss returns null'
  },
  'reference:load': {
    category: 'registry-key',
    reason: 'library path via validatePath; type + name look up a record and return it'
  },
  'formulas:castableInfo': {
    category: 'registry-key',
    reason: 'library path via validatePath; the castable name keys the index, read-only'
  }
}

const EXEMPT_CATEGORIES = new Set(['no-payload', 'path-only', 'registry-key'])

/**
 * The list this card is actually about, spelled out rather than derived. Removing
 * a parse from any one of these fails HERE, naming it, instead of quietly moving
 * it into the exempt table.
 */
const MUST_VALIDATE = [
  'xml:saveItem',
  'xml:saveRecipe',
  'xml:saveNpc',
  'xml:saveNation',
  'xml:saveLoot',
  'xml:saveVariantGroup',
  'xml:saveLocalization',
  'xml:saveCreature',
  'xml:saveElementTable',
  'xml:saveStatus',
  'xml:saveCastable',
  'xml:saveBehaviorSet',
  'xml:saveSpawngroup',
  'xml:saveServerConfig',
  'fs:writeFile',
  'dialog:saveFile',
  'castable:addCategoryBulk',
  'spellbook:apply',
  'settings:save',
  'constants:addValue',
  'constants:saveUserConstants',
  'formulas:save',
  'reports:save',
  'reports:preview',
  'export:castablesReport',
  'diagnostics:reportRendererError',
  'diagnostics:openIssue',
  'diagnostics:copyReport'
]

describe('IPC schema coverage (HTOO-370)', () => {
  it('finds the channels and the parse sites at all', () => {
    // Guards the two regexes. If either stops matching — a rename, a reformat —
    // every other assertion here would pass vacuously against an empty set,
    // which is the one way a test shaped like this fails silently.
    expect(registeredChannels.length).toBeGreaterThan(85)
    expect(validatedChannels.size).toBeGreaterThan(20)
  })

  it('registers no channel twice', () => {
    const dupes = registeredChannels.filter((c, i) => registeredChannels.indexOf(c) !== i)
    expect(dupes, `channels registered more than once: ${dupes.join(', ')}`).toEqual([])
  })

  it('accounts for every registered channel — validated, or exempt with a reason', () => {
    const unaccounted = registeredChannels.filter((c) => !validatedChannels.has(c) && !EXEMPT[c])
    expect(
      unaccounted,
      `These IPC channels validate no payload and are not listed as exempt:\n` +
        unaccounted.map((c) => `  - ${c}`).join('\n') +
        `\n\nAdd a parseOrLog(schemaCtx, '<channel>', <schema>, payload) call, or add the ` +
        `channel to EXEMPT in this file with its category and the reason it needs none. ` +
        `See HTOO-370.`
    ).toEqual([])
  })

  it('carries no stale exempt entry for a channel that no longer exists', () => {
    const registered = new Set(registeredChannels)
    const stale = Object.keys(EXEMPT).filter((c) => !registered.has(c))
    expect(stale, `EXEMPT names channels that are not registered: ${stale.join(', ')}`).toEqual([])
  })

  it('does not exempt a channel that is also validated', () => {
    // A contradiction rather than a redundancy: whichever of the two is wrong,
    // the reason recorded against the channel no longer describes it.
    const both = Object.keys(EXEMPT).filter((c) => validatedChannels.has(c))
    expect(both, `listed as exempt but also parsed: ${both.join(', ')}`).toEqual([])
  })

  it('gives every exempt channel a known category and a non-empty reason', () => {
    for (const [channel, { category, reason }] of Object.entries(EXEMPT)) {
      expect(EXEMPT_CATEGORIES.has(category), `${channel}: unknown category "${category}"`).toBe(
        true
      )
      expect(reason.length, `${channel}: empty reason`).toBeGreaterThan(0)
    }
  })

  it('validates every channel whose payload it writes', () => {
    for (const channel of MUST_VALIDATE) {
      expect(registeredChannels, `${channel} is no longer registered`).toContain(channel)
      expect(validatedChannels.has(channel), `${channel} no longer parses its payload`).toBe(true)
    }
  })

  it('validates all fourteen world-writing save channels', () => {
    // Derived rather than restated, so a fifteenth entity type is covered the day
    // its handler is added and cannot be forgotten here.
    const saveChannels = registeredChannels.filter((c) => c.startsWith('xml:save'))
    expect(saveChannels.length, 'the xml:save* detector found nothing').toBe(14)
    const unvalidated = saveChannels.filter((c) => !validatedChannels.has(c))
    expect(unvalidated, 'these world-writing channels validate nothing').toEqual([])
  })
})

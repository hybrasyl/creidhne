import { describe, it, expect } from 'vitest'
import {
  STAGED_TYPES,
  STAGING_FOLDER_TYPES,
  stagingRootFor,
  stagedEntry,
  mergeStagedIndex,
  stagedOnlyNameSet,
  stagedOnlyReferences,
  stagedFileFor,
  stagedKeyClash,
  releaseClashes
} from '../staging.js'
import { PAGE_FOR_TYPE } from '../../renderer/src/utils/typePages.js'
import { outboundSites, REFERENCE_SITES } from '../entityReferences.js'

// HTOO-453: the pure half of staging. The disk half is src/main/__tests__/staging.test.js.

describe('STAGED_TYPES', () => {
  it('is every file-backed page’s type', () => {
    // A new page gets staging, or this fails: PAGE_FOR_TYPE is itself pinned to
    // the pages by openFileSites.test.js.
    expect([...STAGED_TYPES].sort()).toEqual(Object.keys(PAGE_FOR_TYPE).sort())
  })
})

describe('STAGING_FOLDER_TYPES', () => {
  it('is the staged types and the maps that Taliesin stages (HTOO-636)', () => {
    expect([...STAGING_FOLDER_TYPES].sort()).toEqual([...STAGED_TYPES, 'maps'].sort())
    expect(STAGED_TYPES).not.toContain('maps')
  })

  it('holds every type that a staged file can name', () => {
    // A staged entity that a file names must be in the staged index, or the
    // notice and Release cannot see it. Read from the table, so a new target
    // fails here until staging indexes it.
    const named = Object.entries(REFERENCE_SITES)
      .filter(([, sites]) => sites.length)
      .map(([target]) => target)
    expect(named, 'the reference table has stopped being read').toContain('maps')
    expect(named.filter((t) => !STAGING_FOLDER_TYPES.includes(t))).toEqual([])
  })
})

describe('stagingRootFor', () => {
  it('is the folder beside xml/', () => {
    expect(stagingRootFor('E:/world/xml')).toBe('E:/world/.staging')
    expect(stagingRootFor('E:/world/xml/')).toBe('E:/world/.staging')
  })
})

describe('stagedEntry', () => {
  it('keeps the names and drops the cross-references', () => {
    const fields = {
      castables: ['A'],
      castablesNamesByFilename: { 'a.xml': 'A' },
      castablesDuplicateNames: {},
      castableClasses: { a: 'Wizard' }
    }
    expect(stagedEntry('castables', fields)).toEqual({
      names: ['A'],
      namesByFilename: { 'a.xml': 'A' },
      duplicateNames: {}
    })
  })

  it('is empty for a type with no staged files', () => {
    expect(stagedEntry('items', {})).toEqual({ names: [], namesByFilename: {}, duplicateNames: {} })
  })

  it('takes a map’s filename from its detail, which hybindex-ts gives maps instead', () => {
    const fields = {
      maps: ['Mileth', 'No Id'],
      mapsDuplicateNames: {},
      mapDetails: [{ id: 500, name: 'Mileth', filename: 'towns/mileth.xml', x: 10, y: 10 }]
    }
    expect(stagedEntry('maps', fields)).toEqual({
      names: ['Mileth', 'No Id'],
      namesByFilename: { 'towns/mileth.xml': 'Mileth' },
      duplicateNames: {}
    })
  })
})

const live = {
  statuses: ['Burning', 'Frozen'],
  statusesNamesByFilename: { 'burning.xml': 'Burning', '.ignore/old.xml': 'Ancient' },
  castables: ['Ambush'],
  castablesNamesByFilename: { 'monk_ambush.xml': 'Ambush' },
  castableClasses: { ambush: 'Monk' }
}
const staged = {
  statuses: {
    names: ['Crouch', 'frozen'],
    namesByFilename: { 'animist/crouch.xml': 'Crouch', 'animist/frozen.xml': 'frozen' },
    duplicateNames: {}
  },
  castables: {
    names: ['Ambush', 'Claw'],
    namesByFilename: { 'animist/ambush.xml': 'Ambush', 'animist/claw.xml': 'Claw' },
    duplicateNames: {}
  }
}

describe('mergeStagedIndex', () => {
  it('adds the staged names to each type’s live names', () => {
    const merged = mergeStagedIndex(live, staged)
    expect(merged.statuses).toEqual(['Burning', 'Crouch', 'Frozen', 'frozen'])
    expect(merged.castables).toEqual(['Ambush', 'Claw'])
  })

  it('keeps every other field, and does not change the live index', () => {
    const merged = mergeStagedIndex(live, staged)
    expect(merged.castableClasses).toBe(live.castableClasses)
    expect(live.castables).toEqual(['Ambush'])
  })

  it('adds the staged maps, which no page stages (HTOO-636)', () => {
    const maps = { maps: { names: ['Hidden Grove'], namesByFilename: {}, duplicateNames: {} } }
    expect(mergeStagedIndex({ maps: ['Mileth'] }, maps).maps).toEqual(['Hidden Grove', 'Mileth'])
  })
})

describe('stagedOnlyNameSet', () => {
  it('is the staged names with no live entity, by collision key', () => {
    // `frozen` is live as `Frozen`: the server keys them as one.
    expect([...stagedOnlyNameSet(live, staged, 'statuses')]).toEqual(['Crouch'])
    expect([...stagedOnlyNameSet(live, staged, 'castables')]).toEqual(['Claw'])
  })
})

describe('stagedOnlyReferences', () => {
  it('reports a name that is staged and not live', () => {
    const refs = { statuses: ['Crouch', 'Burning', 'Nowhere'], castables: ['Claw'] }
    expect(stagedOnlyReferences(refs, live, staged)).toEqual([
      { type: 'castables', name: 'Claw' },
      { type: 'statuses', name: 'Crouch' }
    ])
  })

  it('reports nothing for a file with no references', () => {
    expect(stagedOnlyReferences(undefined, live, staged)).toEqual([])
  })
})

describe('stagedFileFor', () => {
  it('finds the staged file with a name, by collision key', () => {
    expect(stagedFileFor(staged, 'statuses', 'crouch')).toBe('animist/crouch.xml')
    expect(stagedFileFor(staged, 'statuses', 'Missing')).toBeNull()
  })
})

describe('stagedKeyClash', () => {
  it('names the live twin of a staged file', () => {
    expect(stagedKeyClash(live, staged, 'castables', 'animist/ambush.xml')).toEqual({
      name: 'Ambush',
      live: ['monk_ambush.xml'],
      staged: []
    })
  })

  it('does not count an archived live file', () => {
    const idx = { statusesNamesByFilename: { '.ignore/crouch.xml': 'Crouch' } }
    expect(stagedKeyClash(idx, staged, 'statuses', 'animist/crouch.xml')).toBeNull()
  })

  it('names another staged file with the key', () => {
    const twoStaged = {
      items: { names: ['Pot'], namesByFilename: { 'a.xml': 'Pot', 'b.xml': 'pot' } }
    }
    expect(stagedKeyClash({}, twoStaged, 'items', 'a.xml')).toEqual({
      name: 'Pot',
      live: [],
      staged: ['b.xml']
    })
  })

  it('is null for a file with no clash', () => {
    expect(stagedKeyClash(live, staged, 'castables', 'animist/claw.xml')).toBeNull()
  })
})

describe('releaseClashes', () => {
  it('refuses a name that is already live', () => {
    const release = [{ type: 'castables', rel: 'animist/ambush.xml', name: 'Ambush' }]
    expect(releaseClashes(release, live)).toEqual([{ ...release[0], reason: 'live' }])
  })

  it('refuses two files with one key in the same release', () => {
    const release = [
      { type: 'items', rel: 'a.xml', name: 'Pot' },
      { type: 'items', rel: 'b.xml', name: 'POT' }
    ]
    expect(releaseClashes(release, live).map((c) => c.reason)).toEqual(['batch', 'batch'])
  })

  it('allows one key in two different types', () => {
    const release = [
      { type: 'items', rel: 'a.xml', name: 'Claw' },
      { type: 'castables', rel: 'animist/claw.xml', name: 'Claw' }
    ]
    expect(releaseClashes(release, live)).toEqual([])
  })

  it('does not check a file with no name', () => {
    expect(releaseClashes([{ type: 'items', rel: 'a.xml', name: '' }], live)).toEqual([])
  })
})

describe('outboundSites', () => {
  it('is the reference table read by source type', () => {
    const sites = outboundSites('castables')
    // Guard the guard: castables name items and statuses, at least.
    expect(sites.length).toBeGreaterThan(0)
    for (const { targetType, site } of sites) {
      expect(site.type).toBe('castables')
      expect(REFERENCE_SITES[targetType]).toContain(site)
    }
    const total = Object.values(REFERENCE_SITES)
      .flat()
      .filter((s) => s.type === 'castables').length
    expect(sites).toHaveLength(total)
  })
})

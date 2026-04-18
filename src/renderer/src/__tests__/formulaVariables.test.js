import { describe, it, expect } from 'vitest'
import {
  VARIABLE_PREFIXES,
  STAT_GROUPS,
  getStatsForPrefix,
  getStatGroupsForPrefix,
  ALL_STAT_BLOCK_STATS,
  STAT_BLOCK_GROUPS,
  RAND_VARIABLES
} from '../data/formulaVariables'

// ── VARIABLE_PREFIXES ───────────────────────────────────────────────────────

describe('VARIABLE_PREFIXES', () => {
  it('has SOURCE, TARGET, MAP', () => {
    const keys = VARIABLE_PREFIXES.map((p) => p.key)
    expect(keys).toContain('SOURCE')
    expect(keys).toContain('TARGET')
    expect(keys).toContain('MAP')
  })
})

// ── getStatsForPrefix ───────────────────────────────────────────────────────

describe('getStatsForPrefix', () => {
  it('SOURCE stats include core stats', () => {
    const stats = getStatsForPrefix('SOURCE')
    const keys = stats.map((s) => s.key)
    expect(keys).toContain('SOURCESTR')
    expect(keys).toContain('SOURCEINT')
    expect(keys).toContain('SOURCEWIS')
    expect(keys).toContain('SOURCECON')
    expect(keys).toContain('SOURCEDEX')
  })

  it('SOURCE stats include combat stats', () => {
    const stats = getStatsForPrefix('SOURCE')
    const keys = stats.map((s) => s.key)
    expect(keys).toContain('SOURCEDMG')
    expect(keys).toContain('SOURCEHIT')
    expect(keys).toContain('SOURCEAC')
    expect(keys).toContain('SOURCEMR')
    expect(keys).toContain('SOURCECRIT')
  })

  it('SOURCE stats include weapon stats', () => {
    const stats = getStatsForPrefix('SOURCE')
    const keys = stats.map((s) => s.key)
    expect(keys).toContain('SOURCEWEAPONSMALLDAMAGE')
    expect(keys).toContain('SOURCEWEAPONLARGEDAMAGE')
  })

  it('SOURCE stats include modifiers', () => {
    const stats = getStatsForPrefix('SOURCE')
    const keys = stats.map((s) => s.key)
    expect(keys).toContain('SOURCEINBOUNDDAMAGEMODIFIER')
    expect(keys).toContain('SOURCELIFESTEAL')
    expect(keys).toContain('SOURCEDODGE')
  })

  it('SOURCE stats include base/bonus variants', () => {
    const stats = getStatsForPrefix('SOURCE')
    const keys = stats.map((s) => s.key)
    expect(keys).toContain('SOURCEBASESTR')
    expect(keys).toContain('SOURCEBONUSSTR')
    expect(keys).toContain('SOURCEBASEDMG')
    expect(keys).toContain('SOURCEBONUSDMG')
  })

  it('TARGET stats mirror SOURCE stats', () => {
    const source = getStatsForPrefix('SOURCE')
    const target = getStatsForPrefix('TARGET')
    // Same count — both get the same stat definitions
    expect(target.length).toBe(source.length)
    // TARGET keys start with TARGET
    expect(target.every((s) => s.key.startsWith('TARGET'))).toBe(true)
  })

  it('MAP stats only include map-specific stats', () => {
    const stats = getStatsForPrefix('MAP')
    const keys = stats.map((s) => s.key)
    expect(keys).toContain('MAPX')
    expect(keys).toContain('MAPY')
    expect(keys).toContain('MAPTILES')
    expect(keys).toContain('MAPBASELEVEL')
    // MAP should NOT include core stats
    expect(keys).not.toContain('MAPSTR')
    expect(keys).not.toContain('MAPLEVEL')
  })

  it('all stats have key, label, group, and groupId', () => {
    const stats = getStatsForPrefix('SOURCE')
    for (const s of stats) {
      expect(s.key).toBeTruthy()
      expect(s.label).toBeTruthy()
      expect(s.group).toBeTruthy()
      expect(s.groupId).toBeTruthy()
    }
  })
})

// ── getStatGroupsForPrefix ──────────────────────────────────────────────────

describe('getStatGroupsForPrefix', () => {
  it('SOURCE groups include Core Stats', () => {
    const groups = getStatGroupsForPrefix('SOURCE')
    const labels = groups.map((g) => g.label)
    expect(labels).toContain('Core Stats')
  })

  it('SOURCE groups include Weapon', () => {
    const groups = getStatGroupsForPrefix('SOURCE')
    const labels = groups.map((g) => g.label)
    expect(labels).toContain('Weapon')
  })

  it('MAP groups include Map but not Core Stats', () => {
    const groups = getStatGroupsForPrefix('MAP')
    const labels = groups.map((g) => g.label)
    expect(labels).toContain('Map')
    expect(labels).not.toContain('Core Stats')
    expect(labels).not.toContain('Weapon')
  })

  it('each group has stats with key and label', () => {
    const groups = getStatGroupsForPrefix('SOURCE')
    for (const g of groups) {
      expect(g.label).toBeTruthy()
      expect(g.stats.length).toBeGreaterThan(0)
      for (const s of g.stats) {
        expect(s.key).toBeTruthy()
        expect(s.label).toBeTruthy()
      }
    }
  })
})

// ── Legacy exports ──────────────────────────────────────────────────────────

describe('legacy exports', () => {
  it('ALL_STAT_BLOCK_STATS matches getStatsForPrefix SOURCE', () => {
    const fromFn = getStatsForPrefix('SOURCE')
    expect(ALL_STAT_BLOCK_STATS.length).toBe(fromFn.length)
  })

  it('STAT_BLOCK_GROUPS matches getStatGroupsForPrefix SOURCE', () => {
    const fromFn = getStatGroupsForPrefix('SOURCE')
    expect(STAT_BLOCK_GROUPS.length).toBe(fromFn.length)
  })
})

// ── RAND_VARIABLES ──────────────────────────────────────────────────────────

describe('RAND_VARIABLES', () => {
  it('has 4 rand variables', () => {
    expect(RAND_VARIABLES).toHaveLength(4)
  })

  it('each has key, label, and max', () => {
    for (const r of RAND_VARIABLES) {
      expect(r.key).toMatch(/^RAND_\d+$/)
      expect(r.label).toBeTruthy()
      expect(r.max).toBeGreaterThan(0)
    }
  })
})

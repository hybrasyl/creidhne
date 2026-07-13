import { describe, it, expect } from 'vitest'
import { getHandler, listHandlers, listImplementedHandlers } from '../handlers/index.js'

describe('handler registry', () => {
  it('returns null for unknown content_types', () => {
    expect(getHandler('unknown_type')).toBeNull()
    expect(getHandler('')).toBeNull()
    expect(getHandler(undefined)).toBeNull()
  })

  it('exposes the implemented content types', () => {
    expect(getHandler('ability_icons')?.status).toBe('implemented')
    expect(getHandler('nation_badges')?.status).toBe('implemented')
    expect(getHandler('legend_mark_icons')?.status).toBe('implemented')
    expect(getHandler('item_icons')?.status).toBe('implemented')
    expect(getHandler('npc_portraits')?.status).toBe('implemented')
    expect(getHandler('sound_effects')?.status).toBe('implemented')
    expect(getHandler('creature_sprites')?.status).toBe('implemented')
  })

  it('creature_sprites handler indexes {n|e}_001 masters, preferring the East master', () => {
    const h = getHandler('creature_sprites')
    expect(h.subtypes).toEqual(['creature'])
    expect(typeof h.buildIndex).toBe('function')
    expect(h.keyFor('creature', 1000)).toBe('creature:1000')

    const files = [
      { path: 'creature_sprites/creature_01000/stand/n_001.png', type: 'File' },
      { path: 'creature_sprites/creature_01000/stand/e_001.png', type: 'File' },
      { path: 'creature_sprites/creature_02000/stand/n_001.png', type: 'File' }, // N only
      { path: 'creature_sprites/creature_03000/stand/n_002.png', type: 'File' }, // wrong frame
      { path: 'creature_sprites/creature_00000/stand/e_001.png', type: 'File' } // id 0 rejected
    ]
    const { entries, coverage } = h.buildIndex({}, files)
    expect([...coverage.get('creature')].sort((a, b) => a - b)).toEqual([1000, 2000])
    // Creature 1000 has both masters → representative is the East one.
    expect(entries.get('creature:1000')?.path).toBe(
      'creature_sprites/creature_01000/stand/e_001.png'
    )
    // Creature 2000 has only the North master → that's the representative.
    expect(entries.get('creature:2000')?.path).toBe(
      'creature_sprites/creature_02000/stand/n_001.png'
    )
    expect(entries.has('creature:3000')).toBe(false)
  })

  it('sound_effects handler claims subtype "sfx" and parses sfx_{id}.{ext}', () => {
    const h = getHandler('sound_effects')
    expect(h.subtypes).toEqual(['sfx'])
    expect(h.parseEntry('sfx_0042.ogg')).toEqual({ subtype: 'sfx', id: 42, key: 'sfx:42' })
    expect(h.parseEntry('sfx_7.wav')).toEqual({ subtype: 'sfx', id: 7, key: 'sfx:7' })
    expect(h.keyFor('sfx', 42)).toBe('sfx:42')
    // Rejects: id 0 (brigid id > 0), nested paths, non-audio ext, bad prefix.
    expect(h.parseEntry('sfx_0000.wav')).toBeNull()
    expect(h.parseEntry('nested/sfx_1.wav')).toBeNull()
    expect(h.parseEntry('sfx_1.png')).toBeNull()
    expect(h.parseEntry('snd_1.wav')).toBeNull()
  })

  it('npc_portraits handler claims subtype "npcportrait" and indexes from the manifest', () => {
    const h = getHandler('npc_portraits')
    expect(h.subtypes).toEqual(['npcportrait'])
    expect(typeof h.buildIndex).toBe('function')
    expect(h.keyFor('npcportrait', 'Inn.SPF')).toBe('npcportrait:inn.spf')

    const files = [
      { path: '_manifest.json', type: 'File' },
      { path: 'gobalt.png', type: 'File' },
      { path: 'inn_green.png', type: 'File' }
    ]
    const manifest = {
      covers: {
        npc_portraits: {
          dimensions: [200, 200],
          portraits: { Gobalt: 'gobalt.png', 'inn.spf': 'inn_green.png' }
        }
      }
    }
    const { entries, coverage } = h.buildIndex(manifest, files)
    // Coverage keeps original-case portrait keys for display/XML round-trip.
    expect([...coverage.get('npcportrait')].sort()).toEqual(['Gobalt', 'inn.spf'])
    // Entries are keyed case-insensitively for resolution.
    expect(entries.get('npcportrait:gobalt')?.path).toBe('gobalt.png')
    expect(entries.get('npcportrait:inn.spf')?.path).toBe('inn_green.png')
  })

  it('npc_portraits buildIndex skips manifest entries whose PNG is absent from the ZIP', () => {
    const h = getHandler('npc_portraits')
    const files = [{ path: 'present.png', type: 'File' }]
    const manifest = {
      covers: {
        npc_portraits: {
          portraits: { Here: 'present.png', Missing: 'gone.png' }
        }
      }
    }
    const { entries, coverage } = h.buildIndex(manifest, files)
    expect([...coverage.get('npcportrait')]).toEqual(['Here'])
    expect(entries.has('npcportrait:missing')).toBe(false)
  })

  it('item_icons handler claims subtype "item" with 5-digit padding', () => {
    const h = getHandler('item_icons')
    expect(h.subtypes).toEqual(['item'])
    expect(h.padding).toBe(5)
    expect(h.parseEntry('item13688.png')).toEqual({
      subtype: 'item',
      id: 13688,
      key: 'item:13688'
    })
  })

  it('exposes the planned content types as stubs', () => {
    for (const ct of ['effects', 'display_sprites']) {
      const h = getHandler(ct)
      expect(h, ct).not.toBeNull()
      expect(h.status, ct).toBe('planned')
      // Stubs must never claim subtypes — their entries are always ignored.
      expect(h.subtypes, ct).toEqual([])
    }
  })

  it('listHandlers returns all 14 registered handlers', () => {
    expect(
      listHandlers()
        .map((h) => h.contentType)
        .sort()
    ).toEqual([
      'ability_icons',
      'creature_sprites',
      'display_sprites',
      'effects',
      'item_icons',
      'legend_mark_icons',
      'music',
      'nation_badges',
      'npc_portraits',
      'sound_effects',
      'static_tiles',
      'town_maps',
      'ui_sprite_overrides',
      'world_maps'
    ])
  })

  it('exposes UI/runtime-only + Taliesin-owned types as out_of_scope (recognized, silently skipped)', () => {
    for (const ct of ['ui_sprite_overrides', 'static_tiles', 'world_maps', 'town_maps', 'music']) {
      const h = getHandler(ct)
      expect(h, ct).not.toBeNull()
      expect(h.status, ct).toBe('out_of_scope')
      expect(h.subtypes, ct).toEqual([])
    }
  })

  it('listImplementedHandlers omits planned stubs', () => {
    expect(
      listImplementedHandlers()
        .map((h) => h.contentType)
        .sort()
    ).toEqual([
      'ability_icons',
      'creature_sprites',
      'item_icons',
      'legend_mark_icons',
      'nation_badges',
      'npc_portraits',
      'sound_effects'
    ])
  })

  it('every implemented handler exposes a non-empty subtypes array', () => {
    for (const h of listImplementedHandlers()) {
      expect(h.subtypes.length, h.contentType).toBeGreaterThan(0)
    }
  })

  it('subtype claims do not overlap across implemented handlers', () => {
    const seen = new Map()
    for (const h of listImplementedHandlers()) {
      for (const s of h.subtypes) {
        expect(
          seen.has(s),
          `subtype ${s} claimed by both ${seen.get(s)} and ${h.contentType}`
        ).toBe(false)
        seen.set(s, h.contentType)
      }
    }
  })
})

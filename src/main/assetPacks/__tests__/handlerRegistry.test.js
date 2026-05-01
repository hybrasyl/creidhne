import { describe, it, expect } from 'vitest'
import {
  getHandler,
  listHandlers,
  listImplementedHandlers
} from '../handlers/index.js'

describe('handler registry', () => {
  it('returns null for unknown content_types', () => {
    expect(getHandler('unknown_type')).toBeNull()
    expect(getHandler('')).toBeNull()
    expect(getHandler(undefined)).toBeNull()
  })

  it('exposes the three implemented content types', () => {
    expect(getHandler('ability_icons')?.status).toBe('implemented')
    expect(getHandler('nation_badges')?.status).toBe('implemented')
    expect(getHandler('legend_mark_icons')?.status).toBe('implemented')
  })

  it('exposes the five planned content types as stubs', () => {
    for (const ct of [
      'item_icons',
      'creatures',
      'effects',
      'display_sprites',
      'sounds'
    ]) {
      const h = getHandler(ct)
      expect(h, ct).not.toBeNull()
      expect(h.status, ct).toBe('planned')
      // Stubs must never claim subtypes — their entries are always ignored.
      expect(h.subtypes, ct).toEqual([])
    }
  })

  it('listHandlers returns all 9 registered handlers', () => {
    expect(listHandlers().map((h) => h.contentType).sort()).toEqual([
      'ability_icons',
      'creatures',
      'display_sprites',
      'effects',
      'item_icons',
      'legend_mark_icons',
      'nation_badges',
      'sounds',
      'ui_sprite_overrides'
    ])
  })

  it('exposes ui_sprite_overrides as out_of_scope (valid Comhaigne type, not consumed by Creidhne)', () => {
    const h = getHandler('ui_sprite_overrides')
    expect(h).not.toBeNull()
    expect(h.status).toBe('out_of_scope')
    expect(h.subtypes).toEqual([])
  })

  it('listImplementedHandlers omits planned stubs', () => {
    expect(listImplementedHandlers().map((h) => h.contentType).sort()).toEqual([
      'ability_icons',
      'legend_mark_icons',
      'nation_badges'
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
        expect(seen.has(s), `subtype ${s} claimed by both ${seen.get(s)} and ${h.contentType}`).toBe(false)
        seen.set(s, h.contentType)
      }
    }
  })
})

import { describe, it, expect } from 'vitest'
import {
  formulaCategoryLabel,
  formulaCategoryColor,
  knownFormulaCategories
} from '../utils/formulaCategory'

// The chip these functions back is rendered in two places — the Formulas file
// list and the formula picker dialog. Both call the same functions, so covering
// the mapping here covers both. The renderer test project is node-only, so the
// JSX itself is verified by hand.

describe('formulaCategoryColor', () => {
  it('maps each known category to its own palette color', () => {
    expect(formulaCategoryColor('damage')).toBe('error')
    expect(formulaCategoryColor('heal')).toBe('success')
    expect(formulaCategoryColor('conversion')).toBe('secondary')
    expect(formulaCategoryColor('shield')).toBe('primary')
    expect(formulaCategoryColor('stat')).toBe('info')
    expect(formulaCategoryColor('cast_cost')).toBe('warning')
    expect(formulaCategoryColor('general')).toBe('default')
  })

  it('gives every known category a truthy MUI color', () => {
    for (const category of knownFormulaCategories()) {
      expect(formulaCategoryColor(category)).toBeTruthy()
    }
  })

  it('falls back to default for an unknown category', () => {
    expect(formulaCategoryColor('nonsense')).toBe('default')
    expect(formulaCategoryColor('DAMAGE')).toBe('default')
  })

  it('colors an absent category default, not damage', () => {
    // Deliberate: the label reads 'damage' but the color stays grey. This
    // reproduces the picker dialog's behavior from before the chip was shared,
    // so extracting it changed nothing on screen.
    expect(formulaCategoryColor(undefined)).toBe('default')
    expect(formulaCategoryColor(null)).toBe('default')
    expect(formulaCategoryColor('')).toBe('default')
  })
})

describe('formulaCategoryLabel', () => {
  it('uses the category verbatim when there is one', () => {
    expect(formulaCategoryLabel('heal')).toBe('heal')
    expect(formulaCategoryLabel('cast_cost')).toBe('cast_cost')
    expect(formulaCategoryLabel('nonsense')).toBe('nonsense')
  })

  it('labels an absent category damage', () => {
    expect(formulaCategoryLabel(undefined)).toBe('damage')
    expect(formulaCategoryLabel(null)).toBe('damage')
    expect(formulaCategoryLabel('')).toBe('damage')
  })
})

describe('knownFormulaCategories', () => {
  it('lists the seven categories the editor offers', () => {
    expect(knownFormulaCategories()).toEqual([
      'damage',
      'heal',
      'conversion',
      'shield',
      'stat',
      'cast_cost',
      'general'
    ])
  })

  it('hands back a fresh array so a caller cannot mutate the map', () => {
    const first = knownFormulaCategories()
    first.push('injected')
    expect(knownFormulaCategories()).not.toContain('injected')
  })
})

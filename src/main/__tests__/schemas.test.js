import { describe, it, expect } from 'vitest'
import {
  settingsSchema,
  constantsSchema,
  constantsAddValueSchema,
  formulasSchema
} from '../schemas/index.js'

// ─── settings ────────────────────────────────────────────────────────────────

describe('settingsSchema', () => {
  const valid = {
    libraries: ['/lib1'],
    activeLibrary: '/lib1',
    theme: 'light',
    clientPath: null,
    taliesinPath: null,
    iconPickerMode: 'vanilla',
    nationCrestPickerMode: 'vanilla'
  }

  it('accepts a fully-populated valid payload', () => {
    expect(settingsSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects libraries as a string', () => {
    const r = settingsSchema.safeParse({ ...valid, libraries: '/lib1' })
    expect(r.success).toBe(false)
  })

  it('rejects an unknown picker mode', () => {
    const r = settingsSchema.safeParse({ ...valid, iconPickerMode: 'glorious' })
    expect(r.success).toBe(false)
  })

  it('accepts null for nullable path fields', () => {
    expect(
      settingsSchema.safeParse({
        ...valid,
        clientPath: null,
        taliesinPath: null,
        activeLibrary: null
      }).success
    ).toBe(true)
  })

  it('rejects a missing required field', () => {
    const { theme: _drop, ...rest } = valid
    expect(settingsSchema.safeParse(rest).success).toBe(false)
  })
})

// ─── constants ───────────────────────────────────────────────────────────────

describe('constantsSchema', () => {
  it('accepts a record of string-arrays', () => {
    const r = constantsSchema.safeParse({
      itemCategories: ['Weapon', 'Armor'],
      vendorTabs: [],
      cookies: ['QuestStarted']
    })
    expect(r.success).toBe(true)
  })

  it('rejects a non-string-array value', () => {
    const r = constantsSchema.safeParse({ itemCategories: [1, 2, 3] })
    expect(r.success).toBe(false)
  })

  it('rejects a nested object value', () => {
    const r = constantsSchema.safeParse({ cookies: [{ name: 'X' }] })
    expect(r.success).toBe(false)
  })
})

describe('constantsAddValueSchema', () => {
  it('accepts a valid type/value pair', () => {
    expect(constantsAddValueSchema.safeParse({ type: 'cookies', value: 'X' }).success).toBe(true)
  })

  it('rejects an empty type', () => {
    expect(constantsAddValueSchema.safeParse({ type: '', value: 'X' }).success).toBe(false)
  })

  it('rejects an empty value', () => {
    expect(constantsAddValueSchema.safeParse({ type: 'cookies', value: '' }).success).toBe(false)
  })
})

// ─── formulas ────────────────────────────────────────────────────────────────

describe('formulasSchema', () => {
  const valid = {
    settings: {
      budgetModifier: {
        mode: 'none',
        application: 'additive',
        lines: { baseline: 4, step: 0.03, cap: null },
        cooldown: { baseline: 6, step: 0.01, cap: 0.2 }
      },
      customVariables: { LevelUpper: 110 },
      coefficients: {},
      defaultPatternId: null
    },
    patterns: [],
    formulas: [{ id: 'abc', name: 'damage', formula: 'STR * 2' }]
  }

  it('accepts a fully-populated valid payload', () => {
    expect(formulasSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts the empty container shape (loadFormulas EMPTY)', () => {
    expect(
      formulasSchema.safeParse({
        settings: {},
        patterns: [],
        formulas: []
      }).success
    ).toBe(true)
  })

  it('rejects formulas without an id', () => {
    const r = formulasSchema.safeParse({
      ...valid,
      formulas: [{ name: 'no-id', formula: 'X' }]
    })
    expect(r.success).toBe(false)
  })

  it('rejects patterns as an object instead of array', () => {
    const r = formulasSchema.safeParse({ ...valid, patterns: {} })
    expect(r.success).toBe(false)
  })

  it('rejects budgetModifier with a non-numeric baseline', () => {
    const r = formulasSchema.safeParse({
      ...valid,
      settings: {
        ...valid.settings,
        budgetModifier: {
          ...valid.settings.budgetModifier,
          lines: { baseline: 'four', step: 0.03, cap: null }
        }
      }
    })
    expect(r.success).toBe(false)
  })
})

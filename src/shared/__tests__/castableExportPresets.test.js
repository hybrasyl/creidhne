import { describe, it, expect } from 'vitest'
import { CASTABLE_EXPORT_PRESETS, getCastableExportPreset } from '../castableExportPresets.js'
import { CASTABLE_COLUMNS } from '../castableRecord.js'

const byId = (id) => getCastableExportPreset(id)

// The balancing workbook lives outside this repo and reads these headers in
// this order. Spelled out again here so a header change has to be made twice,
// deliberately, rather than slipping through a refactor of the preset file.
const BALANCING_HEADERS = [
  'Name',
  'Element',
  'Type',
  'Lines',
  'Cooldown',
  'Class',
  'IsAssail',
  'Deprecated?',
  'Specialty',
  'Is Test?',
  'isGM?',
  'Description1',
  'Category1',
  'Category2',
  'Category3',
  'Category4',
  'Category5',
  'Category6',
  'Intent Use Type',
  'Intent Shape',
  'Intent Targets',
  'Req1 Class',
  'Req1 Lvl Min',
  'Req1 Str',
  'Req1 Int',
  'Req1 Wis',
  'Req1 Con',
  'Req1 Dex',
  'Cast Cost',
  'HealType',
  'HealFormula',
  'DamageType',
  'DamageFlags',
  'DamageFormula',
  'StatusAdd1',
  'StatAdd1Dur',
  'StatAdd1Int',
  'StatAdd1Tick',
  'StatAdd2',
  'StatAdd2Dur',
  'StatAdd2Int',
  'StatAdd2Tick',
  'StatAdd3',
  'StatAdd3Dur',
  'StatAdd3Int',
  'StatAdd3Tick',
  'StatRem1',
  'StatRem1IsCat',
  'StatRem1Quant',
  'StatRem2',
  'StatRem2IsCat',
  'StatRem2Quant',
  'StatRem3',
  'StatRem3IsCat',
  'StatRem3Quant',
  'StatRem4',
  'StatRem4IsCat',
  'StatRem4Quant'
]

const WEB_HEADERS = [
  'Name',
  'Icon',
  'Description',
  'Class',
  'Subclass',
  'Location',
  'StatStr',
  'StatInt',
  'StatWis',
  'StatDex',
  'StatCon',
  'Mats',
  'Level',
  'Type',
  'CastCost',
  'Cooldown'
]

describe('castable export presets', () => {
  it('defines exactly the three exports', () => {
    expect(CASTABLE_EXPORT_PRESETS.map((p) => p.id)).toEqual(['balancingCsv', 'webCsv', 'webJson'])
  })

  it('gives every preset a label, a description and a default file name', () => {
    for (const preset of CASTABLE_EXPORT_PRESETS) {
      expect(preset.label, preset.id).toBeTruthy()
      expect(preset.description, preset.id).toBeTruthy()
      expect(preset.defaultFileName, preset.id).toBeTruthy()
    }
  })

  it('matches each default file name to its format', () => {
    for (const preset of CASTABLE_EXPORT_PRESETS) {
      expect(preset.defaultFileName.endsWith(`.${preset.format}`), preset.id).toBe(true)
    }
  })

  it('selects only fields the record actually has', () => {
    const known = new Set(CASTABLE_COLUMNS.map((c) => c.key))
    for (const preset of CASTABLE_EXPORT_PRESETS) {
      for (const col of preset.columns) {
        expect(known.has(col.key), `${preset.id}: ${col.key}`).toBe(true)
      }
    }
  })

  it('gives every column a header', () => {
    for (const preset of CASTABLE_EXPORT_PRESETS) {
      for (const col of preset.columns) {
        expect(col.header, `${preset.id}: ${col.key}`).toBeTruthy()
      }
    }
  })
})

describe('balancingCsv', () => {
  it('keeps the workbook headers in their established order', () => {
    expect(byId('balancingCsv').columns.map((c) => c.header)).toEqual(BALANCING_HEADERS)
  })

  it('includes every castable', () => {
    expect(byId('balancingCsv').filter).toBeNull()
  })

  it('emits nothing at all for an empty library', () => {
    expect(byId('balancingCsv').headerOnEmpty).toBe(false)
  })

  it('reads the raw requirement stats, not the web-defaulted ones', () => {
    const keys = byId('balancingCsv').columns.map((c) => c.key)
    expect(keys).toContain('reqStr')
    expect(keys).not.toContain('statStr')
  })
})

describe('webCsv and webJson', () => {
  it('uses the website ability browser headers in order', () => {
    expect(byId('webCsv').columns.map((c) => c.header)).toEqual(WEB_HEADERS)
  })

  // Identity, not deep equality: sharing the array is what makes it structurally
  // impossible for the two web outputs to drift apart.
  it('shares one column array between the CSV and the JSON', () => {
    expect(byId('webJson').columns).toBe(byId('webCsv').columns)
  })

  it('shares one filter function between the CSV and the JSON', () => {
    expect(byId('webJson').filter).toBe(byId('webCsv').filter)
  })

  it('excludes test and GM abilities', () => {
    const { filter } = byId('webCsv')
    expect(filter({ isTest: false, isGM: false })).toBe(true)
    expect(filter({ isTest: true, isGM: false })).toBe(false)
    expect(filter({ isTest: false, isGM: true })).toBe(false)
    expect(filter({ isTest: true, isGM: true })).toBe(false)
  })

  it('reads the web-defaulted requirement stats, not the raw ones', () => {
    const keys = byId('webCsv').columns.map((c) => c.key)
    expect(keys).toContain('statStr')
    expect(keys).not.toContain('reqStr')
  })

  it('emits a header row for an empty library', () => {
    expect(byId('webCsv').headerOnEmpty).toBe(true)
  })
})

describe('getCastableExportPreset', () => {
  it('returns the preset for a known id', () => {
    expect(getCastableExportPreset('webJson').id).toBe('webJson')
  })

  it('throws rather than exporting the wrong thing for an unknown id', () => {
    expect(() => getCastableExportPreset('nope')).toThrow(/Unknown castable export preset: nope/)
  })
})

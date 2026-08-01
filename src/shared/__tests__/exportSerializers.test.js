import { describe, it, expect } from 'vitest'
import { esc, recordsToCsv, recordsToJson } from '../exportSerializers.js'

const COLUMNS = [
  { key: 'name', header: 'Name' },
  { key: 'level', header: 'Req1 Lvl Min' }
]

describe('esc', () => {
  it('leaves a plain value alone', () => {
    expect(esc('Ard Ioc')).toBe('Ard Ioc')
    expect(esc('42')).toBe('42')
  })

  it('quotes a value containing a comma', () => {
    expect(esc('Mileth Priest, Danaan Priest')).toBe('"Mileth Priest, Danaan Priest"')
  })

  it('quotes a value containing a newline', () => {
    expect(esc('two\nlines')).toBe('"two\nlines"')
  })

  it('quotes and doubles embedded quotes', () => {
    expect(esc('the "big" one')).toBe('"the ""big"" one"')
    expect(esc('hits hard, the "big" one')).toBe('"hits hard, the ""big"" one"')
  })

  it('renders nullish as empty', () => {
    expect(esc(null)).toBe('')
    expect(esc(undefined)).toBe('')
    expect(esc('')).toBe('')
  })

  it('stringifies booleans and numbers', () => {
    expect(esc(false)).toBe('false')
    expect(esc(true)).toBe('true')
    expect(esc(0)).toBe('0')
  })
})

describe('recordsToCsv', () => {
  it('takes the header text from the column, not the record key', () => {
    const csv = recordsToCsv([{ name: 'A', level: '1' }], COLUMNS)
    expect(csv.split('\r\n')[0]).toBe('Name,Req1 Lvl Min')
  })

  it('emits columns in the order given, not the record order', () => {
    const reversed = [...COLUMNS].reverse()
    const csv = recordsToCsv([{ name: 'A', level: '1' }], reversed)
    expect(csv).toBe('Req1 Lvl Min,Name\r\n1,A')
  })

  it('renders a key the record lacks as an empty cell', () => {
    const csv = recordsToCsv([{ name: 'A' }], COLUMNS)
    expect(csv).toBe('Name,Req1 Lvl Min\r\nA,')
  })

  it('separates rows with CRLF and adds no trailing newline', () => {
    const csv = recordsToCsv(
      [
        { name: 'A', level: '1' },
        { name: 'B', level: '2' }
      ],
      COLUMNS
    )
    expect(csv).toBe('Name,Req1 Lvl Min\r\nA,1\r\nB,2')
    expect(csv.endsWith('\n')).toBe(false)
  })

  it('escapes cells through esc', () => {
    const csv = recordsToCsv([{ name: 'a, b', level: '"x"' }], COLUMNS)
    expect(csv).toBe('Name,Req1 Lvl Min\r\n"a, b","""x"""')
  })

  it('escapes a header that needs it', () => {
    const csv = recordsToCsv([], [{ key: 'a', header: 'Comma, Header' }])
    expect(csv).toBe('"Comma, Header"')
  })

  // The two castable exports disagree here and both behaviours are established.
  it('emits a header for no records by default', () => {
    expect(recordsToCsv([], COLUMNS)).toBe('Name,Req1 Lvl Min')
  })

  it('emits nothing at all for no records when headerOnEmpty is false', () => {
    expect(recordsToCsv([], COLUMNS, { headerOnEmpty: false })).toBe('')
  })
})

describe('recordsToJson', () => {
  it('keys objects by the column key, not the header', () => {
    const json = JSON.parse(recordsToJson([{ name: 'A', level: '1' }], COLUMNS))
    expect(json).toEqual([{ name: 'A', level: '1' }])
  })

  it('includes only the listed columns', () => {
    const json = JSON.parse(recordsToJson([{ name: 'A', level: '1', secret: 'x' }], COLUMNS))
    expect(json[0]).not.toHaveProperty('secret')
    expect(Object.keys(json[0])).toEqual(['name', 'level'])
  })

  it('renders a missing key as undefined, which JSON drops', () => {
    const json = JSON.parse(recordsToJson([{ name: 'A' }], COLUMNS))
    expect(json[0].level).toBeUndefined()
  })

  it('preserves booleans rather than stringifying them', () => {
    const json = JSON.parse(recordsToJson([{ flag: false }], [{ key: 'flag', header: 'Flag' }]))
    expect(json[0].flag).toBe(false)
  })

  it('produces an empty array for no records', () => {
    expect(JSON.parse(recordsToJson([], COLUMNS))).toEqual([])
  })

  it('is pretty printed and ends with a newline', () => {
    const out = recordsToJson([{ name: 'A', level: '1' }], COLUMNS)
    expect(out).toContain('\n  {\n')
    expect(out.endsWith('\n')).toBe(true)
  })
})

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { buildSection } from '@eriscorp/hybindex-ts'
import { STAGED_TYPES } from '../../../shared/staging.js'
import {
  NAMED_TYPES,
  NAME_ELEMENT_TYPES,
  ROOT_ATTRIBUTE_DEFAULT,
  ROOT_ATTRIBUTE_NAME,
  readEntityName,
  rewriteEntityName
} from '../entityName.js'

// The name rule restates hybindex-ts (it does not export ATTR_NAME_MAP), so
// this pins the copy to the package: for one real file of each type, the
// index's name and readEntityName's name must agree, before and after a rename.

const FIXTURES = join(__dirname, '..', '..', '__tests__', 'fixtures', 'xml')

let lib
let cacheDir
const prevCache = process.env.HYBINDEX_CACHE_DIR

beforeAll(() => {
  lib = mkdtempSync(join(tmpdir(), 'creidhne-entityname-'))
  cacheDir = mkdtempSync(join(tmpdir(), 'creidhne-entityname-cache-'))
  process.env.HYBINDEX_CACHE_DIR = cacheDir
})

afterAll(() => {
  rmSync(lib, { recursive: true, force: true })
  rmSync(cacheDir, { recursive: true, force: true })
  if (prevCache === undefined) delete process.env.HYBINDEX_CACHE_DIR
  else process.env.HYBINDEX_CACHE_DIR = prevCache
})

function fixtureFor(type) {
  const dir = join(FIXTURES, type)
  const file = readdirSync(dir).find((f) => f.endsWith('.xml'))
  return { file, xml: readFileSync(join(dir, file), 'utf8') }
}

async function indexName(type, file, xml) {
  const dir = join(lib, type)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), xml)
  const { fields } = await buildSection(lib, type)
  return fields[`${type}NamesByFilename`]?.[file]
}

describe('entityName: the name rule hybindex-ts reads', () => {
  it('covers every stageable type, in exactly one of the two shapes', () => {
    expect([...NAMED_TYPES].sort()).toEqual([...STAGED_TYPES].sort())
    for (const type of NAME_ELEMENT_TYPES) expect(ROOT_ATTRIBUTE_NAME[type]).toBeUndefined()
  })

  it.each(NAMED_TYPES)('%s: agrees with the index, before and after a rename', async (type) => {
    const fixture = fixtureFor(type)
    const { file } = fixture
    let { xml } = fixture
    const name = readEntityName(type, xml)
    expect(name).not.toBe('') // guard the guard: the fixture has a name to agree on
    expect(await indexName(type, file, xml)).toBe(name)

    // A file named by the default (no attribute) cannot be renamed by a text
    // edit; the agreement still holds, and a rename refuses. Give it the
    // attribute to test the rename.
    if (ROOT_ATTRIBUTE_DEFAULT[type] && name === ROOT_ATTRIBUTE_DEFAULT[type]) {
      expect(() => rewriteEntityName(type, xml, name, 'X')).toThrow('no Name attribute')
      xml = xml.replace(/(<[A-Za-z]+)(\s|>)/, (m, tag, after) => `${tag} Name="Named"${after}`)
      expect(readEntityName(type, xml)).toBe('Named')
      expect(await indexName(type, file, xml)).toBe('Named')
    }
    const current = readEntityName(type, xml)

    const renamed = rewriteEntityName(type, xml, current, 'Agent & Renamed')
    expect(readEntityName(type, renamed)).toBe('Agent & Renamed')
    expect(await indexName(type, file, renamed)).toBe('Agent & Renamed')
    // One line changes, and nothing else does.
    const before = xml.split('\n')
    const after = renamed.split('\n')
    expect(after.length).toBe(before.length)
    expect(after.filter((line, i) => line !== before[i])).toHaveLength(1)
  })

  it('refuses a rewrite when the file has another name', () => {
    const xml = '<Status Name="Poison"><Effects/></Status>'
    expect(() => rewriteEntityName('statuses', xml, 'Burn', 'Fire')).toThrow(
      'The file is named "Poison", not "Burn"'
    )
  })

  it('changes the root attribute only, never the same attribute deeper in the file', () => {
    const xml = '<Status Name="Poison">\n  <Add Name="Poison"/>\n</Status>'
    expect(rewriteEntityName('statuses', xml, 'Poison', 'Venom')).toBe(
      '<Status Name="Venom">\n  <Add Name="Poison"/>\n</Status>'
    )
  })

  it('compares decoded and writes escaped', () => {
    const xml = '<Item><Name>Crow &amp; Cask</Name></Item>'
    expect(readEntityName('items', xml)).toBe('Crow & Cask')
    expect(rewriteEntityName('items', xml, 'Crow & Cask', 'Fox <&> Hound')).toBe(
      '<Item><Name>Fox &lt;&amp;&gt; Hound</Name></Item>'
    )
  })
})

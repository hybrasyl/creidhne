import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseSpeciesXml, serializeSpeciesXml } from '../speciesXml.js'

// The Species root type (HXML-37, HTOO-618).

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const WITH_BODIES = readFileSync(
  join(
    process.cwd(),
    'src',
    'main',
    '__tests__',
    'fixtures',
    'xml',
    'species',
    'species_dwarf.xml'
  ),
  'utf8'
)

const BRANCH = `<?xml version="1.0"?>
<Species xmlns="${XMLNS}" Key="HillDwarf" Id="5" Origin="Aosda" PlayerOption="Starter" BranchOf="Dwarf">
  <Names Singular="Hill Dwarf" Plural="Hill Dwarves" Adjective="Hill-Dwarven"/>
  <Bodies>
    <Body Key="Ruddy" Id="50" Default="true"/>
  </Bodies>
</Species>
`

const LOCKED = `<?xml version="1.0"?>
<Species xmlns="${XMLNS}" Key="Fomori" Id="9" Origin="Fanaidhe" PlayerOption="Locked" Affinity="Dark" Resistance="Light">
  <Names Singular="Fomor" Plural="Fomori" Adjective="Fomorian"/>
</Species>
`

const norm = (s) =>
  s
    .replace(/\r\n/g, '\n')
    .replace(/\s+\/>/g, '/>')
    .trim()

describe('round trip', () => {
  it.each([
    ['a species with bodies', WITH_BODIES],
    ['a branch species', BRANCH],
    ['a Locked species with no bodies', LOCKED]
  ])('%s saves to the same XML with no edit', async (_, xml) => {
    expect(norm(serializeSpeciesXml(await parseSpeciesXml(xml)))).toBe(norm(xml))
  })
})

describe('parse', () => {
  it('reads every field', async () => {
    expect(await parseSpeciesXml(WITH_BODIES)).toEqual({
      key: 'Dwarf',
      comment: 'From the HTOO-618 card example',
      id: '4',
      origin: 'Aosda',
      playerOption: 'Starter',
      branchOf: '',
      affinity: 'Wind',
      resistance: 'Wind',
      names: { singular: 'Dwarf', plural: 'Dwarves', adjective: 'Dwarven' },
      description: 'Storm-and-stone people descended from the Gleodhar.',
      bodies: [
        { key: 'Ruddy', id: '40', name: 'Ruddy', isDefault: true, retailSkinColor: '' },
        { key: 'Ashen', id: '41', name: 'Ashen', isDefault: false, retailSkinColor: '3' }
      ]
    })
  })

  it('reads a branch without its own Affinity and Resistance', async () => {
    const s = await parseSpeciesXml(BRANCH)
    expect(s).toMatchObject({ branchOf: 'Dwarf', affinity: '', resistance: '' })
  })
})

describe('serialize', () => {
  it('writes Names always, and no empty Description or Bodies', async () => {
    const s = await parseSpeciesXml(LOCKED)
    const out = serializeSpeciesXml({ ...s, names: { singular: '', plural: '', adjective: '' } })
    expect(out).toContain('<Names Singular="" Plural="" Adjective=""/>')
    expect(out).not.toContain('<Description')
    expect(out).not.toContain('<Bodies')
  })

  it('writes the children in the schema order', async () => {
    const out = serializeSpeciesXml(await parseSpeciesXml(WITH_BODIES))
    const at = (tag) => out.indexOf(`<${tag}`)
    expect(at('Names')).toBeLessThan(at('Description'))
    expect(at('Description')).toBeLessThan(at('Bodies'))
  })
})

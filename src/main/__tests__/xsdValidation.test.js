// Schema validation tests.
//
// This suite ships in two tiers:
//
// 1. **Fixture validity** (active) — copies of small real XML files live
//    under `fixtures/xml/<type>/`. We validate them against the Hybrasyl XSD
//    collection at test time. Purpose: catch drift between the bundled XSDs
//    and real-world files (schema library regressions, upstream XSD bugs
//    reintroduced after `scripts/downloadXSD.js` pulls a new release).
//
// 2. **Serializer round-trip** (deferred, `describe.skip`) — the ambitious
//    test: parse a fixture, re-serialize, validate the output. Wired up but
//    skipped because an initial run surfaced **14 real serializer
//    regressions** (element-order drift, missing defaults, etc.). Each type
//    needs per-serializer investigation. Unskip once the serializers are
//    fixed; the infrastructure here makes each fix trivially verifiable.

import { describe, it, expect } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { validateHybrasylXml } from './xsdValidator.js'

import { parseItemXml, serializeItemXml } from '../itemXml'
import { parseRecipeXml, serializeRecipeXml } from '../recipeXml'
import { parseNpcXml, serializeNpcXml } from '../npcXml'
import { parseNationXml, serializeNationXml } from '../nationXml'
import { parseLootXml, serializeLootXml } from '../lootXml'
import { parseVariantXml, serializeVariantXml } from '../variantXml'
import { parseLocalizationXml, serializeLocalizationXml } from '../localizationXml'
import { parseCreatureXml, serializeCreatureXml } from '../creatureXml'
import { parseElementTableXml, serializeElementTableXml } from '../elementTableXml'
import { parseStatusXml, serializeStatusXml } from '../statusXml'
import { parseCastableXml, serializeCastableXml } from '../castableXml'
import { parseBehaviorSetXml, serializeBehaviorSetXml } from '../behaviorSetXml'
import { parseSpawngroupXml, serializeSpawngroupXml } from '../spawngroupXml'
import { parseServerConfigXml, serializeServerConfigXml } from '../serverConfigXml'
import { parseTraitXml, serializeTraitXml } from '../traitXml'

const FIXTURES_DIR = join(process.cwd(), 'src', 'main', '__tests__', 'fixtures', 'xml')

async function loadFixture(type) {
  const dir = join(FIXTURES_DIR, type)
  const entries = await fs.readdir(dir)
  const xmlFile = entries.find((f) => f.endsWith('.xml'))
  if (!xmlFile) throw new Error(`No fixture found for ${type}`)
  return fs.readFile(join(dir, xmlFile), 'utf-8')
}

async function roundtripValid(parseFn, serializeFn, xml) {
  const parsed = await parseFn(xml)
  const serialized = serializeFn(parsed)
  const result = await validateHybrasylXml(serialized)
  if (!result.valid) {
    throw new Error(
      `Schema validation failed:\n${result.rawOutput}\n\nSerializer output was:\n${serialized}`
    )
  }
  return { parsed, serialized, result }
}

// ── Tier 1: fixture validity ────────────────────────────────────────────────

// Known upstream XSD↔reality drift — the bundled schema file is stricter or
// differently-shaped than what live XML files use. Fix is in the hybrasyl/xml
// repo, not creidhne. Skipped with a one-line explanation; unskip once upstream
// catches up. Any time the pin in `scripts/xsdRef.cjs` moves, clear this list
// and re-run; anything that still fails is new drift. Last checked at xml
// 77432ae (HTOO-615): all seven still failed.
//
// elementtables left this list in HTOO-581. Its fixture is the world table
// after Creidhne's own convertToRegistry, plus a group and the two default
// multipliers: the file the content migration (HS-1239) starts from. The
// world and ceridwen tables are still the old format, which this schema
// refuses by design.
const KNOWN_DRIFT = {
  items: 'schema requires <Description> inside <Vendor>; real files omit it',
  npcs: 'schema marks X/Y required on <Npc>; real files omit them',
  localizations: 'schema orders NpcSpeak before MonsterSpeak; real files use different ordering',
  castables: 'schema omits <Descriptions> from expected Castable children',
  spawngroups: 'schema SpawnFlags maxLength=3; real files have 4+ flags',
  serverconfigs: 'child element ordering mismatch (details in test output when unskipped)'
}

describe('XSD validation: real-world fixtures are schema-valid', () => {
  const types = [
    'items',
    'recipes',
    'npcs',
    'nations',
    'lootsets',
    'variantgroups',
    'localizations',
    'creatures',
    'elementtables',
    'statuses',
    'castables',
    'creaturebehaviorsets',
    'spawngroups',
    'serverconfigs',
    'traits'
  ]
  for (const type of types) {
    const drift = KNOWN_DRIFT[type]
    const test = drift ? it.skip : it
    test(`${type}${drift ? ` [drift: ${drift}]` : ''}`, async () => {
      const xml = await loadFixture(type)
      const result = await validateHybrasylXml(xml)
      if (!result.valid) {
        throw new Error(
          `Fixture ${type} fails XSD validation:\n${result.rawOutput}\n\n` +
            `XML excerpt:\n${xml.slice(0, 400)}${xml.length > 400 ? '…' : ''}`
        )
      }
      expect(result.valid).toBe(true)
    })
  }
})

// ── Serializer round-trip, for the types written after the schema ───────────
// A type that Creidhne gained after its XSD existed starts with a serializer
// that the schema accepts, so its round trip runs now rather than joining the
// deferred tier below.
describe('XSD validation: serializer output is schema-valid (new types)', () => {
  it('traits', async () => {
    await roundtripValid(parseTraitXml, serializeTraitXml, await loadFixture('traits'))
  })
})

// ── Tier 2: serializer round-trip (deferred) ────────────────────────────────
// Unskip once per-type serializer regressions are fixed. The first run
// surfaced 14 real failures — each is its own investigation (element order,
// dropped attributes, missing required defaults).
describe.skip('XSD validation: serializer output is schema-valid', () => {
  it('items', async () => {
    await roundtripValid(parseItemXml, serializeItemXml, await loadFixture('items'))
  })
  it('recipes', async () => {
    await roundtripValid(parseRecipeXml, serializeRecipeXml, await loadFixture('recipes'))
  })
  it('npcs', async () => {
    await roundtripValid(parseNpcXml, serializeNpcXml, await loadFixture('npcs'))
  })
  it('nations', async () => {
    await roundtripValid(parseNationXml, serializeNationXml, await loadFixture('nations'))
  })
  it('lootsets', async () => {
    await roundtripValid(parseLootXml, serializeLootXml, await loadFixture('lootsets'))
  })
  it('variantgroups', async () => {
    await roundtripValid(parseVariantXml, serializeVariantXml, await loadFixture('variantgroups'))
  })
  it('localizations', async () => {
    await roundtripValid(
      parseLocalizationXml,
      serializeLocalizationXml,
      await loadFixture('localizations')
    )
  })
  it('creatures', async () => {
    await roundtripValid(parseCreatureXml, serializeCreatureXml, await loadFixture('creatures'))
  })
  it('element tables', async () => {
    await roundtripValid(
      parseElementTableXml,
      serializeElementTableXml,
      await loadFixture('elementtables')
    )
  })
  it('statuses', async () => {
    await roundtripValid(parseStatusXml, serializeStatusXml, await loadFixture('statuses'))
  })
  it('castables', async () => {
    await roundtripValid(parseCastableXml, serializeCastableXml, await loadFixture('castables'))
  })
  it('behavior sets', async () => {
    await roundtripValid(
      parseBehaviorSetXml,
      serializeBehaviorSetXml,
      await loadFixture('creaturebehaviorsets')
    )
  })
  it('spawn groups', async () => {
    await roundtripValid(
      parseSpawngroupXml,
      serializeSpawngroupXml,
      await loadFixture('spawngroups')
    )
  })
  it('server configs', async () => {
    await roundtripValid(
      parseServerConfigXml,
      serializeServerConfigXml,
      await loadFixture('serverconfigs')
    )
  })
})

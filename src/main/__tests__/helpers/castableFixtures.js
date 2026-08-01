import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, dirname } from 'path'

// A castables library that walks every branch of both export mappers, so the
// golden files in ../fixtures/export are a meaningful lock on their output.
// Each fixture names the branch it exists for; do not prune one without
// checking which assertion goes dark.

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

function castable({ name, attrs = '', meta = null, body = '' }) {
  const metaLine = meta ? `\n  <!-- creidhne:meta ${JSON.stringify(meta)} -->` : ''
  return (
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<Castable xmlns="${XMLNS}" ${attrs}>${metaLine}\n` +
    `  <Name>${name}</Name>\n${body}</Castable>\n`
  )
}

const descriptions = (text) =>
  `  <Descriptions>\n    <Description>${text}</Description>\n  </Descriptions>\n`

// 7 categories on purpose: the balancing sheet has Category1..6, so the
// seventh must fall off the end rather than shift a column.
const categories = (...names) =>
  `  <Categories>\n${names.map((n) => `    <Category>${n}</Category>`).join('\n')}\n  </Categories>\n`

const castCosts = (inner) =>
  `  <CastCosts>\n    <CastCost>\n${inner}    </CastCost>\n  </CastCosts>\n`

export const CASTABLE_FIXTURES = {
  // Baseline. Also the one with trainers in the injected index context, so the
  // golden covers a populated Location.
  'TopLevel.xml': castable({
    name: 'TopLevel',
    attrs: 'Book="PrimarySpell" Icon="1" Class="Wizard" Cooldown="5" Lines="2" Elements="Fire"',
    body: descriptions('A plain spell.') + categories('Offense', 'Fire')
  }),

  // deriveClass: every class listed collapses to "Universal".
  'AllSixClasses.xml': castable({
    name: 'AllSixClasses',
    attrs: 'Book="PrimarySkill" Icon="2" Class="Warrior Wizard Priest Rogue Monk Peasant"',
    body: descriptions('Anyone may learn this.')
  }),

  // deriveClass: absent Class attribute also collapses to "Universal".
  'NoClass.xml': castable({
    name: 'NoClass',
    attrs: 'Book="SecondarySkill" Icon="3"',
    body: descriptions('No class restriction.')
  }),

  // formatCastCost: the `SOURCEBASEMP * n` percentage branch.
  'PercentMana.xml': castable({
    name: 'PercentMana',
    attrs: 'Book="PrimarySpell" Icon="4" Class="Priest"',
    body: castCosts('      <Stat Mp="SOURCEBASEMP * 0.25"/>\n')
  }),

  // formatCastCost: the bare `^SOURCEBASEHP$` branch (no multiplier).
  'BareSourceHp.xml': castable({
    name: 'BareSourceHp',
    attrs: 'Book="PrimarySkill" Icon="5" Class="Monk"',
    body: castCosts('      <Stat Hp="SOURCEBASEHP"/>\n')
  }),

  // formatCastCost: gold percentage + an Item cost with Quantity > 1.
  'GoldAndItemCost.xml': castable({
    name: 'GoldAndItemCost',
    attrs: 'Book="UtilitySkill" Icon="6" Class="Rogue"',
    body: castCosts('      <Stat Gold="SOURCEGOLD * 0.1"/>\n      <Item Quantity="2">Ruby</Item>\n')
  }),

  // The whole point of output change 1: no <Requirements> element at all, so
  // `requirements[0]` is undefined and the two exports disagreed ('' vs '3').
  'NoRequirements.xml': castable({
    name: 'NoRequirements',
    attrs: 'Book="PrimarySpell" Icon="7" Class="Wizard"',
    body: descriptions('Has no requirements block.')
  }),

  // formatMats: gold + two items, one with Quantity 1 (no count prefix) and
  // one with Quantity 3 (prefixed). Also every Physical stat set distinctly so
  // a column-order mistake is visible rather than symmetric.
  'FullRequirement.xml': castable({
    name: 'FullRequirement',
    attrs: 'Book="SecondarySpell" Icon="8" Class="Priest"',
    body:
      descriptions('Fully specified requirement.') +
      `  <Requirements>\n    <Requirement Class="Priest">\n` +
      `      <Level Min="33"/>\n` +
      `      <Physical Str="11" Int="22" Wis="33" Con="44" Dex="55"/>\n` +
      `      <Gold>5000</Gold>\n` +
      `      <Items>\n        <Item Quantity="1">Emerald</Item>\n        <Item Quantity="3">Ruby</Item>\n      </Items>\n` +
      `    </Requirement>\n  </Requirements>\n`
  }),

  // A requirement with no <Physical> and no <Level>: the parser already
  // defaults the stats to '3', but levelMin stays '' — the second half of
  // output change 1.
  'RequirementNoPhysical.xml': castable({
    name: 'RequirementNoPhysical',
    attrs: 'Book="PrimarySkill" Icon="9" Class="Warrior"',
    body: `  <Requirements>\n    <Requirement Class="Warrior"/>\n  </Requirements>\n`
  }),

  // meta.specialty overrides the subclass label.
  'Specialty.xml': castable({
    name: 'Specialty',
    attrs: 'Book="PrimarySpell" Icon="10" Class="Priest"',
    meta: { specialty: 'Cleric' },
    body: descriptions('A cleric spell.')
  }),

  // Location falls back to the quest string when there is no trainer.
  'QuestOnly.xml': castable({
    name: 'QuestOnly',
    attrs: 'Book="PrimarySkill" Icon="11" Class="Rogue"',
    meta: { givenViaScript: true },
    body: descriptions('Awarded by a quest.')
  }),

  // Filtered out of both web exports, kept in balancing.
  'TestOnly.xml': castable({
    name: 'TestOnly',
    attrs: 'Book="PrimarySpell" Icon="12" Class="Wizard"',
    meta: { isTest: true },
    body: descriptions('Test ability.')
  }),

  'GmOnly.xml': castable({
    name: 'GmOnly',
    attrs: 'Book="PrimarySpell" Icon="13" Class="Wizard"',
    meta: { isGM: true },
    body: descriptions('GM ability.')
  }),

  // meta.deprecated reaches the balancing sheet's `Deprecated?` column.
  'Deprecated.xml': castable({
    name: 'Deprecated',
    attrs: 'Book="SecondarySkill" Icon="14" Class="Warrior"',
    meta: { deprecated: true },
    body: descriptions('No longer used.')
  }),

  // deriveShape: every shape at once, with >1 lines and >1 tiles so the plural
  // branches ("Line x2", "Tile x3") fire rather than the singular ones.
  'Shapes.xml': castable({
    name: 'Shapes',
    attrs: 'Book="PrimarySpell" Icon="15" Class="Wizard"',
    body:
      `  <Intents>\n    <Intent UseType="Target" MaxTargets="4">\n` +
      `      <Cross Radius="2"/>\n      <Square Side="3"/>\n      <Cone Radius="1"/>\n` +
      `      <Line Length="4"/>\n      <Line Length="5"/>\n` +
      `      <Tile RelativeX="1"/>\n      <Tile RelativeX="2"/>\n      <Tile RelativeX="3"/>\n` +
      `    </Intent>\n  </Intents>\n`
  }),

  // 3 status adds and 4 removes: exactly fills the balancing sheet's slots and
  // walks the StatusAdd1 / StatAdd2 / StatAdd3 header inconsistency.
  'Statuses.xml': castable({
    name: 'Statuses',
    attrs: 'Book="PrimarySpell" Icon="16" Class="Priest"',
    body:
      `  <Effects>\n    <Statuses>\n` +
      `      <Add Duration="10" Intensity="1" Tick="2">Poison</Add>\n` +
      `      <Add Duration="20" Intensity="2" Tick="4">Blind</Add>\n` +
      `      <Add Duration="30" Intensity="3" Tick="6">Slow</Add>\n` +
      `      <Remove IsCategory="true" Quantity="1">Debuff</Remove>\n` +
      `      <Remove Quantity="2">Poison</Remove>\n` +
      `      <Remove>Blind</Remove>\n` +
      `      <Remove IsCategory="true" Quantity="9">Curse</Remove>\n` +
      `    </Statuses>\n  </Effects>\n`
  }),

  // Heal and damage formulas, damage type and flags — balancing-only columns.
  'Formulas.xml': castable({
    name: 'Formulas',
    attrs: 'Book="PrimarySpell" Icon="17" Class="Priest"',
    body:
      `  <Effects>\n` +
      `    <Heal>\n      <Formula>SOURCEWIS * 2</Formula>\n    </Heal>\n` +
      `    <Damage Type="Magical">\n      <Flags>Nonlethal Bypass</Flags>\n      <Formula>SOURCEINT * 3</Formula>\n    </Damage>\n` +
      `  </Effects>\n`
  }),

  // deriveType returns "Utility Spell" where bookToType returns the raw book —
  // the fixture that keeps those two fields honestly distinct.
  'Utility.xml': castable({
    name: 'Utility',
    attrs: 'Book="UtilitySpell" Icon="18" Class="Peasant"',
    body: descriptions('A utility spell.')
  }),

  // The highest-risk cell in either export: `esc` must quote the field and
  // double the inner quotes. A seventh category checks the 6-column cap.
  'CommasAndQuotes.xml': castable({
    name: 'CommasAndQuotes',
    attrs: 'Book="PrimarySkill" Icon="19" Class="Monk"',
    body:
      descriptions('Hits hard, then harder; the "big" one.') +
      categories('One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven')
  }),

  // Recursion: one level and two levels deep.
  'universal/Nested.xml': castable({
    name: 'Nested',
    attrs: 'Book="PrimarySpell" Icon="20" Class="Wizard"'
  }),
  'wizard/offensive/DeepNested.xml': castable({
    name: 'DeepNested',
    attrs: 'Book="PrimarySpell" Icon="21" Class="Wizard"'
  }),

  // Must never appear in any export.
  '.ignore/Archived.xml': castable({
    name: 'Archived',
    attrs: 'Book="PrimarySpell" Icon="22" Class="Wizard"'
  }),

  // Skipped silently rather than failing the run.
  'Malformed.xml': `<?xml version="1.0"?>\n<Castable><Name>Malformed`
}

// Trainer names keyed by lowercased castable name, matching the index's
// `castableTrainers` shape. Injected rather than loaded so the golden covers a
// populated Location without needing a real index on disk.
export const CASTABLE_TRAINERS = {
  toplevel: ['Danaan Wizard Trainer', 'Rucesion Wizard Trainer'],
  fullrequirement: ['Mileth Priest Trainer']
}

/** Writes the fixture library to a fresh temp directory and returns its path. */
export function makeCastableLibrary() {
  const lib = mkdtempSync(join(tmpdir(), 'creidhne-export-'))
  for (const [rel, xml] of Object.entries(CASTABLE_FIXTURES)) {
    const target = join(lib, 'castables', rel)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, xml)
  }
  return lib
}

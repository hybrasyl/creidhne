// The three castable exports, as data.
//
// A preset is `{ id, label, description, format, defaultFileName, filter,
// headerOnEmpty, columns }` — no code beyond the filter predicate, so WP2 can
// present these as built-in report definitions and let a user clone one.
//
// The column lists are written out rather than generated. They are a contract
// with two consumers that live outside this repo (a balancing workbook and the
// Hybrasyl website), so a header change should be a visible line in a diff.

/** Test and GM abilities are internal; neither web consumer should see them. */
const notTestOrGM = (record) => !record.isTest && !record.isGM

// The balancing workbook's columns, in its established order.
const BALANCING_COLUMNS = [
  { key: 'name', header: 'Name' },
  { key: 'elements', header: 'Element' },
  { key: 'bookType', header: 'Type' },
  { key: 'lines', header: 'Lines' },
  { key: 'cooldown', header: 'Cooldown' },
  { key: 'classRaw', header: 'Class' },
  { key: 'isAssail', header: 'IsAssail' },
  { key: 'deprecated', header: 'Deprecated?' },
  { key: 'specialty', header: 'Specialty' },
  { key: 'isTest', header: 'Is Test?' },
  { key: 'isGM', header: 'isGM?' },
  { key: 'description', header: 'Description1' },
  { key: 'category1', header: 'Category1' },
  { key: 'category2', header: 'Category2' },
  { key: 'category3', header: 'Category3' },
  { key: 'category4', header: 'Category4' },
  { key: 'category5', header: 'Category5' },
  { key: 'category6', header: 'Category6' },
  { key: 'intentUseType', header: 'Intent Use Type' },
  { key: 'intentShape', header: 'Intent Shape' },
  { key: 'intentTargets', header: 'Intent Targets' },
  { key: 'reqClass', header: 'Req1 Class' },
  { key: 'level', header: 'Req1 Lvl Min' },
  { key: 'str', header: 'Req1 Str' },
  { key: 'int', header: 'Req1 Int' },
  { key: 'wis', header: 'Req1 Wis' },
  { key: 'con', header: 'Req1 Con' },
  { key: 'dex', header: 'Req1 Dex' },
  { key: 'castCostSummary', header: 'Cast Cost' },
  { key: 'healType', header: 'HealType' },
  { key: 'healFormula', header: 'HealFormula' },
  { key: 'damageType', header: 'DamageType' },
  { key: 'damageFlags', header: 'DamageFlags' },
  { key: 'damageFormula', header: 'DamageFormula' },
  { key: 'statusAdd1Name', header: 'StatusAdd1' },
  { key: 'statusAdd1Duration', header: 'StatusAdd1Dur' },
  { key: 'statusAdd1Intensity', header: 'StatusAdd1Int' },
  { key: 'statusAdd1Tick', header: 'StatusAdd1Tick' },
  { key: 'statusAdd2Name', header: 'StatusAdd2' },
  { key: 'statusAdd2Duration', header: 'StatusAdd2Dur' },
  { key: 'statusAdd2Intensity', header: 'StatusAdd2Int' },
  { key: 'statusAdd2Tick', header: 'StatusAdd2Tick' },
  { key: 'statusAdd3Name', header: 'StatusAdd3' },
  { key: 'statusAdd3Duration', header: 'StatusAdd3Dur' },
  { key: 'statusAdd3Intensity', header: 'StatusAdd3Int' },
  { key: 'statusAdd3Tick', header: 'StatusAdd3Tick' },
  { key: 'statusRemove1Name', header: 'StatRem1' },
  { key: 'statusRemove1IsCategory', header: 'StatRem1IsCat' },
  { key: 'statusRemove1Quantity', header: 'StatRem1Quant' },
  { key: 'statusRemove2Name', header: 'StatRem2' },
  { key: 'statusRemove2IsCategory', header: 'StatRem2IsCat' },
  { key: 'statusRemove2Quantity', header: 'StatRem2Quant' },
  { key: 'statusRemove3Name', header: 'StatRem3' },
  { key: 'statusRemove3IsCategory', header: 'StatRem3IsCat' },
  { key: 'statusRemove3Quantity', header: 'StatRem3Quant' },
  { key: 'statusRemove4Name', header: 'StatRem4' },
  { key: 'statusRemove4IsCategory', header: 'StatRem4IsCat' },
  { key: 'statusRemove4Quantity', header: 'StatRem4Quant' }
]

// The website ability browser's columns. The JSON preset reuses this exact
// array, so the two web outputs cannot drift.
const WEB_COLUMNS = [
  { key: 'name', header: 'Name' },
  { key: 'icon', header: 'Icon' },
  { key: 'description', header: 'Description' },
  { key: 'class', header: 'Class' },
  { key: 'subclass', header: 'Subclass' },
  { key: 'location', header: 'Location' },
  { key: 'str', header: 'StatStr' },
  { key: 'int', header: 'StatInt' },
  { key: 'wis', header: 'StatWis' },
  { key: 'con', header: 'StatCon' },
  { key: 'dex', header: 'StatDex' },
  { key: 'mats', header: 'Mats' },
  { key: 'level', header: 'Level' },
  { key: 'type', header: 'Type' },
  { key: 'castCost', header: 'CastCost' },
  { key: 'cooldown', header: 'Cooldown' }
]

export const CASTABLE_EXPORT_PRESETS = [
  {
    id: 'balancingCsv',
    label: 'Balancing CSV',
    description:
      'Every castable including test and GM abilities, with the full column set. For balancing and hand review in Excel.',
    format: 'csv',
    defaultFileName: 'castables_balancing.csv',
    filter: null,
    headerOnEmpty: false,
    columns: BALANCING_COLUMNS
  },
  {
    id: 'webCsv',
    label: 'Web CSV',
    description:
      'The column set the Hybrasyl website ability browser reads. Test and GM abilities excluded.',
    format: 'csv',
    defaultFileName: 'castables.csv',
    filter: notTestOrGM,
    headerOnEmpty: true,
    columns: WEB_COLUMNS
  },
  {
    id: 'webJson',
    label: 'Web JSON',
    description: 'The same web-facing data as JSON. Test and GM abilities excluded.',
    format: 'json',
    defaultFileName: 'castables.json',
    filter: notTestOrGM,
    columns: WEB_COLUMNS
  }
]

/** Looks a preset up by id. Throws rather than exporting the wrong thing. */
export function getCastableExportPreset(id) {
  const preset = CASTABLE_EXPORT_PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`Unknown castable export preset: ${id}`)
  return preset
}

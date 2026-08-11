// The three castable exports, as data — and, since WP2, as report definitions.
//
// A preset is `{ id, label, description, format, defaultFileName, match, rules,
// headerOnEmpty, columns }`. There is no code in it at all: the filter is a rule
// list in the same vocabulary a user's own report uses (src/shared/reportRules.js),
// so a user can clone a built-in and get something they can then edit.
//
// Before WP2 the filter was a predicate — `(record) => !record.isTest &&
// !record.isGM`. A stored report cannot hold a function, and a second filter
// mechanism for built-ins would mean a built-in a user cannot express. The
// golden fixtures in src/main/__tests__/fixtures/export/ prove the two forms
// produce byte-identical output.
//
// These three are fixed: they are clonable, never editable. Their column lists
// are a contract with two consumers outside this repo (a balancing workbook and
// the Hybrasyl website ability browser), so a header change must stay a visible
// line in a diff rather than a thing a user can do in the UI.

/** Test and GM abilities are internal; neither web consumer should see them. */
const NOT_TEST_OR_GM = {
  match: 'all',
  rules: [
    { field: 'isTest', op: 'is', value: false },
    { field: 'isGM', op: 'is', value: false }
  ]
}

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
    entity: 'castables',
    description:
      'Every castable including test and GM abilities, with the full column set. For balancing and hand review in Excel.',
    format: 'csv',
    defaultFileName: 'castables_balancing.csv',
    // No rules: every castable. This was `filter: null`.
    match: 'all',
    rules: [],
    headerOnEmpty: false,
    columns: BALANCING_COLUMNS
  },
  {
    id: 'webCsv',
    label: 'Web CSV',
    entity: 'castables',
    description:
      'The column set the Hybrasyl website ability browser reads. Test and GM abilities excluded.',
    format: 'csv',
    defaultFileName: 'castables.csv',
    ...NOT_TEST_OR_GM,
    headerOnEmpty: true,
    columns: WEB_COLUMNS
  },
  {
    id: 'webJson',
    label: 'Web JSON',
    entity: 'castables',
    description: 'The same web-facing data as JSON. Test and GM abilities excluded.',
    format: 'json',
    defaultFileName: 'castables.json',
    ...NOT_TEST_OR_GM,
    columns: WEB_COLUMNS
  }
]

/** Whether an id names one of the three fixed built-in reports. */
export function isBuiltInReport(id) {
  return CASTABLE_EXPORT_PRESETS.some((p) => p.id === id)
}

/** Looks a preset up by id. Throws rather than exporting the wrong thing. */
export function getCastableExportPreset(id) {
  const preset = CASTABLE_EXPORT_PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`Unknown castable export preset: ${id}`)
  return preset
}

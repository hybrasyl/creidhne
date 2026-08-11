// The built-in item report (WP3).
//
// **One, not three.** Castables ship three because two consumers outside this repo
// read them: a balancing workbook and the Hybrasyl website's ability browser. Items
// have no such consumer, and inventing a column contract that nothing reads is
// worse than shipping the one obvious report — a contract nobody checks is a
// contract that quietly stops being true.
//
// So this is a starting point rather than a promise. Its columns carry the fields a
// person reviewing item balance asks for first, and Clone is how anyone changes it.
// It is fixed for the same reason the castable built-ins are: a built-in a user can
// edit is a built-in that stops meaning what its name says.

export const ITEM_REPORT_PRESETS = [
  {
    id: 'itemsCsv',
    label: 'Items CSV',
    description:
      'Every item, with the identity, value, slot, damage and requirement columns. A starting point for balance review — clone it to change the columns.',
    entity: 'items',
    format: 'csv',
    defaultFileName: 'items.csv',
    match: 'all',
    rules: [],
    headerOnEmpty: true,
    columns: [
      { key: 'name', header: 'Name' },
      { key: 'slot', header: 'Slot' },
      { key: 'weaponType', header: 'WeaponType' },
      { key: 'value', header: 'Value' },
      { key: 'weight', header: 'Weight' },
      { key: 'durability', header: 'Durability' },
      { key: 'smallMin', header: 'SmallMin' },
      { key: 'smallMax', header: 'SmallMax' },
      { key: 'largeMin', header: 'LargeMin' },
      { key: 'largeMax', header: 'LargeMax' },
      { key: 'levelMin', header: 'LevelMin' },
      { key: 'abMin', header: 'AbMin' },
      { key: 'class', header: 'Class' },
      { key: 'gender', header: 'Gender' },
      { key: 'shopTab', header: 'ShopTab' },
      { key: 'vendors', header: 'SoldBy' },
      { key: 'lootSets', header: 'LootSets' },
      { key: 'statBonusStr', header: 'BonusStr' },
      { key: 'statBonusInt', header: 'BonusInt' },
      { key: 'statBonusWis', header: 'BonusWis' },
      { key: 'statBonusCon', header: 'BonusCon' },
      { key: 'statBonusDex', header: 'BonusDex' },
      { key: 'statBonusHp', header: 'BonusHp' },
      { key: 'statBonusMp', header: 'BonusMp' },
      { key: 'statBonusAc', header: 'BonusAc' },
      { key: 'statBonusMr', header: 'BonusMr' },
      { key: 'statBonusDmg', header: 'BonusDmg' },
      { key: 'statBonusHit', header: 'BonusHit' }
    ]
  }
]

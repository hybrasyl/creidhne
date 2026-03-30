import { join } from 'path'
import { promises as fs } from 'fs'
import { parseCastableXml } from './castableXml.js'

function mapCastableToRow(castable, fileName, index) {
  const req1    = castable.requirements[0] || {}
  const req2    = castable.requirements[1] || {}
  const descs   = castable.descriptions   || []
  const cats    = castable.categories     || []
  const intent  = castable.intents?.[0]  || {}
  const crosses = intent.crosses  || []
  const squares = intent.squares  || []
  const cones   = intent.cones    || []
  const lines   = intent.lines    || []
  const tiles   = intent.tiles    || []
  const rst     = castable.restrictions   || []
  const add     = castable.statuses?.add  || []
  const rem     = castable.statuses?.remove || []
  const flags   = intent.flags    || []

  const castCosts = castable.castCosts || []
  const hpCost   = castCosts.find(c => c.type === 'Hp')
  const mpCost   = castCosts.find(c => c.type === 'Mp')
  const goldCost = castCosts.find(c => c.type === 'Gold')
  const itemCost = castCosts.find(c => c.type === 'Item')

  const prereq1 = req1.prerequisites || {}
  const prereq2 = req2.prerequisites || {}

  return {
    'Index':              index,
    'File Name':          fileName,
    'Icon':               castable.icon,
    'Book':               castable.book,
    'Element':            castable.elements,
    'Lines':              castable.lines,
    'Class':              castable.class,
    'Cooldown':           castable.cooldown,
    'IsAssail':           castable.isAssail,
    'Reflect?':           castable.reflectable,
    'Breaks Stealth?':    castable.breakStealth,
    'Metafile Include?':  castable.includeInMetafile,
    'Deprecated?':        castable.meta?.deprecated      ?? false,
    'Given via Script?':  castable.meta?.givenViaScript  ?? false,
    'Specialty':          castable.meta?.specialty        ?? '',
    'Is Test?':           castable.meta?.isTest           ?? false,
    'isGM?':              castable.meta?.isGM             ?? false,
    'Is Trainer?':        castable.meta?.isTrainer        ?? false,
    'Name':               castable.name,

    'Description1':       descs[0]?.text  ?? '',
    'Description1 Class': descs[0]?.class ?? '',
    'Description2':       descs[1]?.text  ?? '',
    'Description2 Class': descs[1]?.class ?? '',
    'Description3':       descs[2]?.text  ?? '',
    'Description3 Class': descs[2]?.class ?? '',
    'Description4':       descs[3]?.text  ?? '',
    'Description4 Class': descs[3]?.class ?? '',
    'Description5':       descs[4]?.text  ?? '',
    'Description5 Class': descs[4]?.class ?? '',
    'Description6':       descs[5]?.text  ?? '',
    'Description6 Class': descs[5]?.class ?? '',

    'Category1':     cats[0] ?? '',
    'Category2':     cats[1] ?? '',
    'Category3':     cats[2] ?? '',
    'Category4':     cats[3] ?? '',
    'Category5':     cats[4] ?? '',
    'Category6':     cats[5] ?? '',
    'AllCategories': cats.join(', '),

    'UseType':       intent.useType    ?? '',
    'maxTargets':    intent.maxTargets ?? '',
    'IntentFlags':   flags.join(' '),
    'FlagHostile':   flags.includes('Hostile'),
    'FlagFriendly':  flags.includes('Friendly'),
    'FlagPvp':       flags.includes('Pvp'),
    'FlagGroup':     flags.includes('Group'),
    'FlagSelf':      flags.includes('Self'),
    'IsMap':         intent.map ?? false,

    'CrossRadius':    crosses[0]?.radius       ?? '',
    'CrossVE':        crosses[0]?.visualEffect ?? '',
    'SquareSides':    squares[0]?.side         ?? '',
    'SquareVE':       squares[0]?.visualEffect ?? '',
    'ConeRadius':     cones[0]?.radius         ?? '',
    'ConeDirection':  cones[0]?.direction      ?? '',
    'ConeVE':         cones[0]?.visualEffect   ?? '',

    'Line1Length':    lines[0]?.length       ?? '',
    'Line1Direction': lines[0]?.direction    ?? '',
    'Line1VE':        lines[0]?.visualEffect ?? '',
    'Line2Length':    lines[1]?.length       ?? '',
    'Line2Direction': lines[1]?.direction    ?? '',
    'Line2VE':        lines[1]?.visualEffect ?? '',
    'Line3Length':    lines[2]?.length       ?? '',
    'Line3Direction': lines[2]?.direction    ?? '',
    'Line3VE':        lines[2]?.visualEffect ?? '',
    'Line4Length':    lines[3]?.length       ?? '',
    'Line4Direction': lines[3]?.direction    ?? '',
    'Line4VE':        lines[3]?.visualEffect ?? '',

    'Tile1Direction': tiles[0]?.direction    ?? '',
    'Tile1RelX':      tiles[0]?.relativeX    ?? '',
    'Tile1RelY':      tiles[0]?.relativeY    ?? '',
    'Tile1VE':        tiles[0]?.visualEffect ?? '',
    'HasTile1':       tiles.length >= 1,
    'Tile2Direction': tiles[1]?.direction    ?? '',
    'Tile2RelX':      tiles[1]?.relativeX    ?? '',
    'Tile2RelY':      tiles[1]?.relativeY    ?? '',
    'Tile2VE':        tiles[1]?.visualEffect ?? '',
    'HasTile2':       tiles.length >= 2,
    'Tile3Direction': tiles[2]?.direction    ?? '',
    'Tile3RelX':      tiles[2]?.relativeX    ?? '',
    'Tile3RelY':      tiles[2]?.relativeY    ?? '',
    'Tile3VE':        tiles[2]?.visualEffect ?? '',
    'HasTile3':       tiles.length >= 3,
    'Tile4Direction': tiles[3]?.direction    ?? '',
    'Tile4RelX':      tiles[3]?.relativeX    ?? '',
    'Tile4RelY':      tiles[3]?.relativeY    ?? '',
    'Tile4VE':        tiles[3]?.visualEffect ?? '',
    'HasTile4':       tiles.length >= 4,
    'Tile5Direction': tiles[4]?.direction    ?? '',
    'Tile5RelX':      tiles[4]?.relativeX    ?? '',
    'Tile5RelY':      tiles[4]?.relativeY    ?? '',
    'Tile5VE':        tiles[4]?.visualEffect ?? '',
    'HasTile5':       tiles.length >= 5,

    'Monk':    castable.maxLevel?.monk    ?? '',
    'Warrior': castable.maxLevel?.warrior ?? '',
    'Peasant': castable.maxLevel?.peasant ?? '',
    'Wizard':  castable.maxLevel?.wizard  ?? '',
    'Priest':  castable.maxLevel?.priest  ?? '',
    'Rogue':   castable.maxLevel?.rogue   ?? '',

    'Req1 Class':   req1.class    ?? '',
    'Req1 Lvl Min': req1.levelMin ?? '',
    'Req1 Lvl Max': req1.levelMax ?? '',
    'Req1 Ab Min':  req1.abMin    ?? '',
    'Req1 Ab Max':  req1.abMax    ?? '',
    'FormulaGold':  '',
    'ManualGold':   '',
    'Req1 Gold':    req1.gold ?? '',
    'Req1 Str':     req1.str  ?? '',
    'Req1 Int':     req1.int  ?? '',
    'Req1 Wis':     req1.wis  ?? '',
    'Req1 Con':     req1.con  ?? '',
    'Req1 Dex':     req1.dex  ?? '',
    'ReqStatSum':        '',
    'Stats at level min': '',
    'Req1 Item1':       req1.items?.[0]?.itemName ?? '',
    'Req1 Drops?':      '',
    'Req1 Sold?':       '',
    'Req1 Item1 Count': req1.items?.[0]?.quantity ?? '',
    'Req1 Item2':       req1.items?.[1]?.itemName ?? '',
    'Req2 Drops?':      '',
    'Req2 Sold?':       '',
    'Req1 Item2 Count': req1.items?.[1]?.quantity ?? '',
    'Req1 Item3':       req1.items?.[2]?.itemName ?? '',
    'Req3 Drops?':      '',
    'Req3 Sold?':       '',
    'Req1 Item3 Count': req1.items?.[2]?.quantity ?? '',
    'Req1 Item4':       req1.items?.[3]?.itemName ?? '',
    'Req4 Drops?':      '',
    'Req4 Sold?':       '',
    'Req1 Item4 Count': req1.items?.[3]?.quantity ?? '',
    'Disable PreReq1?':  prereq1.deprecated    ?? false,
    'Req1 Spell Name1':  prereq1.castables?.[0]?.name  ?? '',
    'Req1 Spell Lvl1':   prereq1.castables?.[0]?.level ?? '',
    'Req1 Spell Name2':  prereq1.castables?.[1]?.name  ?? '',
    'Req1 Spell Lvl2':   prereq1.castables?.[1]?.level ?? '',
    'Req1ForbidC':       req1.forbidCookie    ?? '',
    'Req1ReqC':          req1.requireCookie   ?? '',
    'Req1Pre1ForbidC':   prereq1.forbidCookie   ?? '',
    'Req1Pre1ForbidMsg': prereq1.forbidMessage  ?? '',
    'Req1Pre1ReqC':      prereq1.requireCookie  ?? '',
    'Req1Pre1ReqMsg':    prereq1.requireMessage ?? '',
    'HasCookieReq?':     '',

    'Req2 Class': req2.class    ?? '',
    'Req2LvlMin': req2.levelMin ?? '',
    'Req2LvlMax': req2.levelMax ?? '',
    'Req2AbMin':  req2.abMin    ?? '',
    'Req2AbMax':  req2.abMax    ?? '',
    'Req2Gold':   req2.gold     ?? '',
    'Req2Str':    req2.str      ?? '',
    'Req2Int':    req2.int      ?? '',
    'Req2Wis':    req2.wis      ?? '',
    'Req2Con':    req2.con      ?? '',
    'Req2Dex':    req2.dex      ?? '',
    'Req2Item1':      req2.items?.[0]?.itemName ?? '',
    'Req2Item1Count': req2.items?.[0]?.quantity ?? '',
    'Req2Item2':      req2.items?.[1]?.itemName ?? '',
    'Req2Item2Count': req2.items?.[1]?.quantity ?? '',
    'Req2Item3':      req2.items?.[2]?.itemName ?? '',
    'Req2Item3Count': req2.items?.[2]?.quantity ?? '',
    'Req2Item4':      req2.items?.[3]?.itemName ?? '',
    'Req2Item4Count': req2.items?.[3]?.quantity ?? '',
    'Disable PreReq2?':  prereq2.deprecated    ?? false,
    'Req2SpellName1':    prereq2.castables?.[0]?.name  ?? '',
    'Req2SpellLvl1':     prereq2.castables?.[0]?.level ?? '',
    'Req2SpellName2':    prereq2.castables?.[1]?.name  ?? '',
    'Req2SpellLvl2':     prereq2.castables?.[1]?.level ?? '',
    'Req2ForbidC':       req2.forbidCookie    ?? '',
    'Req2ReqC':          req2.requireCookie   ?? '',
    'Req2Pre1ForbidC':   prereq2.forbidCookie   ?? '',
    'Req2Pre1ReqC':      prereq2.requireCookie  ?? '',
    'Req2Pre1ForbidMsg': prereq2.forbidMessage  ?? '',
    'Req2Pre1ReqCMsg':   prereq2.requireMessage ?? '',

    'RstItem1Slot':    rst[0]?.slot       ?? '',
    'RstItem1WType':   rst[0]?.weaponType ?? '',
    'RstItem1RType':   rst[0]?.type       ?? '',
    'RstItem1Message': rst[0]?.message    ?? '',
    'RstItem1Name':    rst[0]?.itemName   ?? '',
    'RstItem2Slot':    rst[1]?.slot       ?? '',
    'RstItem2WType':   rst[1]?.weaponType ?? '',
    'RstItem2RType':   rst[1]?.type       ?? '',
    'RstItem2Message': rst[1]?.message    ?? '',
    'RstItem2Name':    rst[1]?.itemName   ?? '',
    'RstItem3Slot':    rst[2]?.slot       ?? '',
    'RstItem3WType':   rst[2]?.weaponType ?? '',
    'RstItem3RType':   rst[2]?.type       ?? '',
    'RstItem3Message': rst[2]?.message    ?? '',
    'RstItem3Name':    rst[2]?.itemName   ?? '',
    'RstItem4Slot':    rst[3]?.slot       ?? '',
    'RstItem4WType':   rst[3]?.weaponType ?? '',
    'RstItem4RType':   rst[3]?.type       ?? '',
    'RstItem4Message': rst[3]?.message    ?? '',
    'RstItem4Name':    rst[3]?.itemName   ?? '',
    'HasRstItem1': '', 'HasRstItem2': '', 'HasRstItem3': '', 'HasRstItem4': '', 'HasRstItem?': '',

    'HP Stat': '', 'HP Modifier': '',
    'HP Flat Cost':   hpCost?.value   ?? '',
    'MP Stat': '', 'MP Modifier': '',
    'MP Flat Cost':   mpCost?.value   ?? '',
    'Gold Stat': '', 'Gold Modifier': '',
    'Gold Flat Cost': goldCost?.value ?? '',
    'Cost Item Name':  itemCost?.itemName ?? '',
    'Cost Item Count': itemCost?.quantity ?? '',
    'HasCastCost': '', 'HasHPCost?': '', 'HasGoldCost?': '', 'HasMPCost?': '', 'HasItemCost?': '',

    'OnCast Peasant ID': '', 'OnCast Peasant Speed': '',
    'OnCast Warrior ID': '', 'OnCast Warrior Speed': '',
    'OnCast Rogue ID':   '', 'OnCast Rogue Speed':   '',
    'OnCast Wizard ID':  '', 'OnCast Wizard Speed':  '',
    'OnCast Priest ID':  '', 'OnCast Priest Speed':  '',
    'OnCast Monk ID':    '', 'OnCast Monk Speed':    '',
    'OnCastTargetID': '', 'OnCastTargetSpeed': '',
    'OnEndPlayerMotionID': '', 'OnEndPlayerMotionSpeed': '', 'OnEndClass': '',
    'OnEndTargetID': '', 'OnEndTargetSpeed': '',
    'HasAnimation?': '', 'HasOnEnd?': '',
    'Sound': '',

    'HealType':        castable.heal?.kind    ?? '',
    'OldHealFormula':  '', 'HealFormulaLookup': '',
    'HealFormula':     castable.heal?.formula ?? '',
    'HealSimpleMin':   castable.heal?.min     ?? '',
    'HealSimpleMax':   castable.heal?.max     ?? '',
    'HealSimpleValue': castable.heal?.value   ?? '',
    'HasHeal?': '',

    'DamageType':        castable.damage?.type ?? '',
    'DamageFlags':       (castable.damage?.flags || []).join(' '),
    'FormulaLookUp': '', 'OldDamageFormula': '',
    'DamageFormula':     castable.damage?.formula ?? '',
    'DamageSimpleValue': castable.damage?.value   ?? '',
    'DamageSimpleMin':   castable.damage?.min     ?? '',
    'DamageSimpleMax':   castable.damage?.max     ?? '',
    'HasDamage?': '',

    'StatusAdd1':  add[0]?.name ?? '', 'StatAdd1Dur': add[0]?.duration ?? '', 'StatAdd1Int': add[0]?.intensity ?? '', 'StatAdd1Tick': add[0]?.tick ?? '',
    'StatAdd2':    add[1]?.name ?? '', 'StatAdd2Dur': add[1]?.duration ?? '', 'StatAdd2Int': add[1]?.intensity ?? '', 'StatAdd2Tick': add[1]?.tick ?? '',
    'StatAdd3':    add[2]?.name ?? '', 'StatAdd3Dur': add[2]?.duration ?? '', 'StatAdd3Int': add[2]?.intensity ?? '', 'StatAdd3Tick': add[2]?.tick ?? '',

    'StatRem1': rem[0]?.name ?? '', 'StatRem1IsCat': rem[0]?.isCategory ?? false, 'StatRem1Quant': rem[0]?.quantity ?? '',
    'StatRem2': rem[1]?.name ?? '', 'StatRem2IsCat': rem[1]?.isCategory ?? false, 'StatRem2Quant': rem[1]?.quantity ?? '',
    'StatRem3': rem[2]?.name ?? '', 'StatRem3IsCat': rem[2]?.isCategory ?? false, 'StatRem3Quant': rem[2]?.quantity ?? '',
    'StatRem4': rem[3]?.name ?? '', 'StatRem4IsCat': rem[3]?.isCategory ?? false, 'StatRem4Quant': rem[3]?.quantity ?? '',
    'HasStatus': '',

    'Rct1Script': '', 'Rct1RelX': '', 'Rct1RelY': '', 'Rct1Sprite': '', 'Rct1Expiration': '', 'Rct1Uses': '', 'Rct1Blocking': '', 'Rct1OwnerSee': '', 'Rct1StatusSee': '', 'Rct1GroupSee': '', 'Rct1CookieSee': '',
    'Rct2Script': '', 'Rct2RelX': '', 'Rct2RelY': '', 'Rct2Sprite': '', 'Rct2Expiration': '', 'Rct2Uses': '', 'Rct2Blocking': '', 'Rct2OwnerSee': '', 'Rct2StatusSee': '', 'Rct2GroupSee': '', 'Rct2CookieSee': '',
    'Rct3Script': '', 'Rct3RelX': '', 'Rct3RelY': '', 'Rct3Sprite': '', 'Rct3Expiration': '', 'Rct3Uses': '', 'Rct3Blocking': '', 'Rct3OwnerSee': '', 'Rct3StatusSee': '', 'Rct3GroupSee': '', 'Rct3CookieSee': '',
    'Rct4Script': '', 'Rct4RelX': '', 'Rct4RelY': '', 'Rct4Sprite': '', 'Rct4Expiration': '', 'Rct4Uses': '', 'Rct4Blocking': '', 'Rct4OwnerSee': '', 'Rct4StatusSee': '', 'Rct4GroupSee': '', 'Rct4CookieSee': '',
    'Rct5Script': '', 'Rct5RelX': '', 'Rct5RelY': '', 'Rct5Sprite': '', 'Rct5Expiration': '', 'Rct5Uses': '', 'Rct5Blocking': '', 'Rct5OwnerSee': '', 'Rct5StatusSee': '', 'Rct5GroupSee': '', 'Rct5CookieSee': '',
    'Rct6Script': '', 'Rct6RelX': '', 'Rct6RelY': '', 'Rct6Sprite': '', 'Rct6Expiration': '', 'Rct6Uses': '', 'Rct6Blocking': '', 'Rct6OwnerSee': '', 'Rct6StatusSee': '', 'Rct6GroupSee': '', 'Rct6CookieSee': '',
    'HasReact1?': '', 'HasReact2?': '', 'HasReact3?': '', 'HasReact4?': '', 'HasReact5?': '', 'HasReact6?': '', 'HasReactors?': '',

    'ScriptOverride': castable.scriptOverride,
    'Script':         castable.script ?? '',
    'HasEffect?':     '',

    'MasUses':  castable.mastery?.uses ?? '',
    'MasMods':  (castable.mastery?.modifiers || []).join(' '),
    'MasTiers': castable.mastery?.tiered ?? false,
    'ReqLevelViewer': '', 'Cooldown Time': '', 'HasMastery?': '',
    'Notes': '', 'Tag1': '', 'Tag2': '', 'Tag3': '',
  }
}

function esc(val) {
  const s = String(val ?? '')
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? `"${s.replace(/"/g, '""')}"` : s
}

export async function exportCastablesExcelCSV(libraryPath) {
  const castDir = join(libraryPath, 'castables')
  let entries
  try {
    entries = await fs.readdir(castDir, { withFileTypes: true })
  } catch {
    return { error: 'Could not read castables directory' }
  }

  const dataRows = []
  let index = 1
  for (const entry of entries.filter(e => e.isFile() && e.name.endsWith('.xml'))) {
    try {
      const xmlString = await fs.readFile(join(castDir, entry.name), 'utf-8')
      const castable  = await parseCastableXml(xmlString)
      dataRows.push(mapCastableToRow(castable, entry.name, index++))
    } catch { /* skip malformed file */ }
  }

  if (dataRows.length === 0) return { csv: '' }

  const headers = Object.keys(dataRows[0])
  const lines = [
    headers.map(esc).join(','),
    ...dataRows.map(row => headers.map(h => esc(row[h])).join(',')),
  ]
  return { csv: lines.join('\r\n') }
}

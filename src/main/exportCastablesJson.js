import { join } from 'path'
import { promises as fs } from 'fs'
import { parseCastableXml } from './castableXml.js'

function bookToType(book) {
  if (!book) return ''
  const b = book.toLowerCase()
  if (b.includes('skill')) return 'Skill'
  if (b.includes('spell')) return 'Spell'
  return book
}

function deriveShape(crosses, squares, cones, lines, tiles) {
  const parts = []
  if (crosses.length) parts.push(`Cross(r=${crosses[0].radius ?? '?'})`)
  if (squares.length) parts.push(`Square(s=${squares[0].side ?? '?'})`)
  if (cones.length) parts.push(`Cone(r=${cones[0].radius ?? '?'})`)
  if (lines.length > 1) parts.push(`Line x${lines.length}`)
  else if (lines.length) parts.push(`Line(len=${lines[0].length ?? '?'})`)
  if (tiles.length > 1) parts.push(`Tile x${tiles.length}`)
  else if (tiles.length) parts.push('Tile')
  return parts.join(', ')
}

function deriveCastCost(castCosts) {
  const hp = castCosts.find((c) => c.type === 'Hp')
  const mp = castCosts.find((c) => c.type === 'Mp')
  const gold = castCosts.find((c) => c.type === 'Gold')
  const item = castCosts.find((c) => c.type === 'Item')
  return [
    hp?.value ? `${hp.value} HP` : null,
    mp?.value ? `${mp.value} MP` : null,
    gold?.value ? `${gold.value} Gold` : null,
    item?.itemName
      ? item.quantity > 1
        ? `${item.itemName} x${item.quantity}`
        : item.itemName
      : null
  ]
    .filter(Boolean)
    .join(', ')
}

function mapCastableToRow(castable) {
  const req1 = castable.requirements[0] || {}
  const descs = castable.descriptions || []
  const cats = castable.categories || []
  const intent = castable.intents?.[0] || {}
  const crosses = intent.crosses || []
  const squares = intent.squares || []
  const cones = intent.cones || []
  const lines = intent.lines || []
  const tiles = intent.tiles || []
  const add = castable.statuses?.add || []
  const rem = castable.statuses?.remove || []

  return {
    Name: castable.name,
    Element: castable.elements,
    Type: bookToType(castable.book),
    Lines: castable.lines,
    Cooldown: castable.cooldown,
    Class: castable.class,
    IsAssail: castable.isAssail,
    'Deprecated?': castable.meta?.deprecated ?? false,
    Specialty: castable.meta?.specialty ?? '',
    'Is Test?': castable.meta?.isTest ?? false,
    'isGM?': castable.meta?.isGM ?? false,

    Description1: descs[0]?.text ?? '',

    Category1: cats[0] ?? '',
    Category2: cats[1] ?? '',
    Category3: cats[2] ?? '',
    Category4: cats[3] ?? '',
    Category5: cats[4] ?? '',
    Category6: cats[5] ?? '',

    'Intent Use Type': intent.useType ?? '',
    'Intent Shape': deriveShape(crosses, squares, cones, lines, tiles),
    'Intent Targets': intent.maxTargets ?? '',

    'Req1 Class': req1.class ?? '',
    'Req1 Lvl Min': req1.levelMin ?? '',
    'Req1 Str': req1.str ?? '',
    'Req1 Int': req1.int ?? '',
    'Req1 Wis': req1.wis ?? '',
    'Req1 Con': req1.con ?? '',
    'Req1 Dex': req1.dex ?? '',

    'Cast Cost': deriveCastCost(castable.castCosts || []),

    HealType: castable.heal?.kind ?? '',
    HealFormula: castable.heal?.formula ?? '',

    DamageType: castable.damage?.type ?? '',
    DamageFlags: (castable.damage?.flags || []).join(' '),
    DamageFormula: castable.damage?.formula ?? '',

    StatusAdd1: add[0]?.name ?? '',
    StatAdd1Dur: add[0]?.duration ?? '',
    StatAdd1Int: add[0]?.intensity ?? '',
    StatAdd1Tick: add[0]?.tick ?? '',
    StatAdd2: add[1]?.name ?? '',
    StatAdd2Dur: add[1]?.duration ?? '',
    StatAdd2Int: add[1]?.intensity ?? '',
    StatAdd2Tick: add[1]?.tick ?? '',
    StatAdd3: add[2]?.name ?? '',
    StatAdd3Dur: add[2]?.duration ?? '',
    StatAdd3Int: add[2]?.intensity ?? '',
    StatAdd3Tick: add[2]?.tick ?? '',

    StatRem1: rem[0]?.name ?? '',
    StatRem1IsCat: rem[0]?.isCategory ?? false,
    StatRem1Quant: rem[0]?.quantity ?? '',
    StatRem2: rem[1]?.name ?? '',
    StatRem2IsCat: rem[1]?.isCategory ?? false,
    StatRem2Quant: rem[1]?.quantity ?? '',
    StatRem3: rem[2]?.name ?? '',
    StatRem3IsCat: rem[2]?.isCategory ?? false,
    StatRem3Quant: rem[2]?.quantity ?? '',
    StatRem4: rem[3]?.name ?? '',
    StatRem4IsCat: rem[3]?.isCategory ?? false,
    StatRem4Quant: rem[3]?.quantity ?? ''
  }
}

function esc(val) {
  const s = String(val ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
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
  for (const entry of entries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
    try {
      const xmlString = await fs.readFile(join(castDir, entry.name), 'utf-8')
      const castable = await parseCastableXml(xmlString)
      dataRows.push(mapCastableToRow(castable))
    } catch {
      /* skip malformed file */
    }
  }

  if (dataRows.length === 0) return { csv: '' }

  const headers = Object.keys(dataRows[0])
  const lines = [
    headers.map(esc).join(','),
    ...dataRows.map((row) => headers.map((h) => esc(row[h])).join(','))
  ]
  return { csv: lines.join('\r\n') }
}

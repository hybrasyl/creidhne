import { join } from 'path'
import { promises as fs } from 'fs'
import { parseCastableXml } from './castableXml.js'
import { extractMeta } from './xmlCommentUtils.js'
import { listSection } from './fsHandlers.js'

// Lifted verbatim from the `export:castablesCSV` IPC handler so the behaviour is
// importable and can be frozen by a characterization test before WP1 reshapes it.
// The only change is that `castableTrainers` is passed in rather than loaded here:
// index loading is the caller's job, which keeps this module free of
// indexService.js and therefore testable without touching %LOCALAPPDATA%.

const ALL_CLASSES = ['Warrior', 'Wizard', 'Priest', 'Rogue', 'Monk', 'Peasant']

function deriveIcon(book, icon) {
  const isSpell = book.includes('Spell')
  return isSpell ? `spell${icon}.png` : `skill${icon}.png`
}

function deriveType(book) {
  switch (book) {
    case 'PrimarySkill':
    case 'SecondarySkill':
      return 'Skill'
    case 'PrimarySpell':
    case 'SecondarySpell':
      return 'Spell'
    case 'UtilitySkill':
      return 'Utility Skill'
    case 'UtilitySpell':
      return 'Utility Spell'
    default:
      return book
  }
}

function deriveClass(cls) {
  if (!cls) return 'Universal'
  const words = cls.split(/\s+/).filter(Boolean)
  if (words.length === 0 || ALL_CLASSES.every((c) => words.includes(c))) return 'Universal'
  return cls
}

function formatMats(req) {
  if (!req) return 'No Cost'
  const parts = []
  if (req.gold) parts.push(`${req.gold} gold`)
  for (const item of req.items || []) {
    const qty = Number(item.quantity) > 1 ? `${item.quantity} ` : ''
    parts.push(`${qty}${item.itemName}`)
  }
  return parts.length > 0 ? parts.join(', ') : 'No Cost'
}

function formatCastCost(castCosts) {
  if (!castCosts || castCosts.length === 0) return ''
  return castCosts
    .map((cost) => {
      if (cost.type === 'Item') return `${cost.quantity || 1} ${cost.itemName}`
      const val = String(cost.value || '')
      const hpMatch = /SOURCEBASEHP\s*\*\s*([\d.]+)/.exec(val)
      const mpMatch = /SOURCEBASEMP\s*\*\s*([\d.]+)/.exec(val)
      const gldMatch = /SOURCEGOLD\s*\*\s*([\d.]+)/.exec(val)
      if (hpMatch) return `${Math.round(Number(hpMatch[1]) * 100)}% of Base Health`
      if (mpMatch) return `${Math.round(Number(mpMatch[1]) * 100)}% of Base Mana`
      if (gldMatch) return `${Math.round(Number(gldMatch[1]) * 100)}% of Gold`
      if (/^SOURCEBASEHP$/i.test(val)) return '100% of Base Health'
      if (/^SOURCEBASEMP$/i.test(val)) return '100% of Base Mana'
      if (/^SOURCEGOLD$/i.test(val)) return '100% of Gold'
      if (cost.type === 'Hp') return `${val} HP`
      if (cost.type === 'Mp') return `${val} Mana`
      if (cost.type === 'Gold') return `${val} Gold`
      return val
    })
    .join(', ')
}

function esc(val) {
  const s = String(val ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

export async function exportCastablesWebCSV(libraryPath, castableTrainers = {}) {
  const castDir = join(libraryPath, 'castables')

  const header =
    'Name,Icon,Description,Class,Subclass,Location,StatStr,StatInt,StatWis,StatDex,StatCon,Mats,Level,Type,CastCost,Cooldown'
  const rows = [header]

  let active = []
  try {
    // See exportCastablesExcelCSV: `active` is recursive AND excludes the
    // archive explicitly, which a plain readdir did only as a side effect of
    // `isFile()` skipping the `.ignore` directory.
    ;({ active } = await listSection(libraryPath, 'castables'))
  } catch {
    return { error: 'Could not read castables directory' }
  }

  for (const rel of active) {
    try {
      const xmlString = await fs.readFile(join(castDir, rel), 'utf-8')
      const meta = extractMeta(xmlString)
      if (meta.isTest || meta.isGM) continue
      const castable = await parseCastableXml(xmlString)
      const req = castable.requirements[0] || null
      const trainers = castableTrainers[castable.name.toLowerCase()] || []
      let location = ''
      if (trainers.length > 0) location = trainers.join(', ')
      else if (meta.givenViaScript) location = 'Awarded by a Quest'
      const classLabel = deriveClass(castable.class)
      const subclass = meta.specialty || classLabel
      rows.push(
        [
          esc(castable.name),
          esc(deriveIcon(castable.book, castable.icon)),
          esc(castable.descriptions[0]?.text || ''),
          esc(classLabel),
          esc(subclass),
          esc(location),
          esc(req?.str || '3'),
          esc(req?.int || '3'),
          esc(req?.wis || '3'),
          esc(req?.dex || '3'),
          esc(req?.con || '3'),
          esc(formatMats(req)),
          esc(req?.levelMin || '1'),
          esc(deriveType(castable.book)),
          esc(formatCastCost(castable.castCosts)),
          esc(castable.cooldown || '')
        ].join(',')
      )
    } catch {
      /* skip malformed file */
    }
  }

  return { csv: rows.join('\r\n') }
}

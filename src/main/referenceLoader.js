import { promises as fs } from 'fs'
import { join } from 'path'
import { parseCastableXml } from './castableXml'
import { parseStatusXml } from './statusXml'
import { parseItemXml } from './itemXml'
import { parseCreatureXml } from './creatureXml'
import { parseNpcXml } from './npcXml'
import { parseNationXml } from './nationXml'
import { parseLootXml } from './lootXml'
import { parseRecipeXml } from './recipeXml'
import { parseVariantXml } from './variantXml'
import { parseLocalizationXml } from './localizationXml'
import { parseElementTableXml } from './elementTableXml'
import { parseBehaviorSetXml } from './behaviorSetXml'
import { parseSpawngroupXml } from './spawngroupXml'

// Type key = subdir name, aligning with libraryIndex field names.
// `idField` is the property on the parsed object used to match a picked name.
// Localizations use `locale` rather than a traditional name.
const TYPE_CONFIG = {
  castables: { parse: parseCastableXml, idField: 'name', label: 'Castable' },
  statuses: { parse: parseStatusXml, idField: 'name', label: 'Status' },
  items: { parse: parseItemXml, idField: 'name', label: 'Item' },
  creatures: { parse: parseCreatureXml, idField: 'name', label: 'Creature' },
  npcs: { parse: parseNpcXml, idField: 'name', label: 'NPC' },
  nations: { parse: parseNationXml, idField: 'name', label: 'Nation' },
  lootsets: { parse: parseLootXml, idField: 'name', label: 'Loot set' },
  recipes: { parse: parseRecipeXml, idField: 'name', label: 'Recipe' },
  variantgroups: { parse: parseVariantXml, idField: 'name', label: 'Variant group' },
  localizations: { parse: parseLocalizationXml, idField: 'locale', label: 'Localization' },
  elementtables: { parse: parseElementTableXml, idField: 'name', label: 'Element table' },
  creaturebehaviorsets: { parse: parseBehaviorSetXml, idField: 'name', label: 'Behavior set' },
  spawngroups: { parse: parseSpawngroupXml, idField: 'name', label: 'Spawn group' }
}

export const SUPPORTED_REFERENCE_TYPES = Object.keys(TYPE_CONFIG)

export const REFERENCE_TYPE_LABELS = Object.fromEntries(
  Object.entries(TYPE_CONFIG).map(([k, v]) => [k, v.label])
)

function valueMatches(parsed, idField, target) {
  const v = parsed?.[idField]
  return v != null && String(v).toLowerCase() === String(target).toLowerCase()
}

export async function loadReference(libraryPath, type, name) {
  const cfg = TYPE_CONFIG[type]
  if (!cfg) return { ok: false, error: `Unsupported type: ${type}` }
  if (!libraryPath || !name) return { ok: false, error: 'Missing libraryPath or name' }

  const dir = join(libraryPath, type)

  // Filename often matches the identifier — try that first.
  const guess = join(dir, `${name}.xml`)
  try {
    const raw = await fs.readFile(guess, 'utf-8')
    const parsed = await cfg.parse(raw)
    if (valueMatches(parsed, cfg.idField, name)) {
      return { ok: true, parsed, raw, path: guess }
    }
  } catch {
    /* fall through to full scan */
  }

  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return { ok: false, error: `Directory not found: ${dir}` }
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.xml')) continue
    const filePath = join(dir, entry.name)
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const parsed = await cfg.parse(raw)
      if (valueMatches(parsed, cfg.idField, name)) {
        return { ok: true, parsed, raw, path: filePath }
      }
    } catch {
      /* skip unreadable / unparseable files */
    }
  }

  return { ok: false, error: `No ${cfg.label} named "${name}" found.` }
}

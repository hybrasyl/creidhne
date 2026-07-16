import { promises as fs } from 'fs'
import { join } from 'path'
import { isArchivedPath } from '@eriscorp/hybindex-ts'
import { assertInside } from './pathSafety.js'
import { listSection } from './fsHandlers.js'
import { loadIndex } from './indexService.js'
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

  // Filename often matches the identifier — try that first. assertInside
  // catches a renderer-supplied `name` like `../escape` that would join out
  // of the type subdir; on traversal we fall through to the full scan (which
  // still constrains candidates to files listSection found under dir).
  let guess
  try {
    guess = assertInside(dir, `${name}.xml`)
  } catch {
    guess = null
  }
  if (guess) {
    try {
      const raw = await fs.readFile(guess, 'utf-8')
      const parsed = await cfg.parse(raw)
      if (valueMatches(parsed, cfg.idField, name)) {
        return { ok: true, parsed, raw, path: guess }
      }
    } catch {
      /* fall through to full scan */
    }
  }

  // Filename guess missed (e.g. a prefixed/renamed file). Use the world index's
  // filename→name map to parse just the one matching file instead of reading and
  // parsing the entire directory. Falls through to the full scan if the index is
  // unavailable or has no match.
  try {
    const index = await loadIndex(libraryPath)
    const namesByFilename = index?.[`${type}NamesByFilename`]
    if (namesByFilename) {
      const target = String(name).toLowerCase()
      // Archived entries share this map, keyed under `.ignore/`. A reference
      // must never resolve to content the server does not load, so skip them —
      // otherwise an archived file whose <Name> matches could satisfy a lookup
      // for a live one purely by iteration order.
      const hit = Object.entries(namesByFilename).find(
        ([key, nm]) => !isArchivedPath(key) && String(nm).toLowerCase() === target
      )
      if (hit) {
        let filePath = null
        try {
          filePath = assertInside(dir, hit[0])
        } catch {
          filePath = null
        }
        if (filePath) {
          try {
            const raw = await fs.readFile(filePath, 'utf-8')
            const parsed = await cfg.parse(raw)
            if (valueMatches(parsed, cfg.idField, name)) {
              return { ok: true, parsed, raw, path: filePath }
            }
          } catch {
            /* fall through to full scan */
          }
        }
      }
    }
  } catch {
    /* index unavailable — fall through to full scan */
  }

  // Full scan. `active` is recursive and excludes the archive, so this finds
  // files in subdirectories and still never resolves to `.ignore/` content.
  let active
  try {
    ;({ active } = await listSection(libraryPath, type))
  } catch {
    return { ok: false, error: `Directory not found: ${dir}` }
  }

  // listSectionFiles reports a missing directory as an empty list rather than
  // throwing, so an existence check is what still separates "no such type dir"
  // from "dir exists but holds no match" — two different errors to the user.
  if (!active.length) {
    try {
      await fs.access(dir)
    } catch {
      return { ok: false, error: `Directory not found: ${dir}` }
    }
  }

  for (const rel of active) {
    const filePath = join(dir, rel)
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

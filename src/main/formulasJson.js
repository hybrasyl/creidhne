import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'
import { getCreidhneFilePath, ensureCreidhneDir } from './worldData.js'

const DEFAULT_BUDGET_MODIFIER = {
  mode: 'none',
  application: 'additive',
  lines: { baseline: 4, step: 0.03, cap: null },
  cooldown: { baseline: 6, step: 0.01, cap: 0.2 },
}

const DEFAULT_SETTINGS = {
  budgetModifier: { ...DEFAULT_BUDGET_MODIFIER },
  customVariables: {},
  coefficients: {},
}

const EMPTY = {
  settings:  { ...DEFAULT_SETTINGS },
  patterns:  [],
  formulas:  [],
}

/**
 * Migrate legacy formulas.json that used { globals, templates } to the new
 * { settings, patterns } shape.  Returns a new object — never mutates input.
 */
function migrateIfNeeded(data) {
  if (!data.globals && !data.templates) return data

  const migrated = { ...data }

  // globals → settings.customVariables (old globals were free-form key/value)
  if (data.globals && !data.settings) {
    migrated.settings = {
      ...DEFAULT_SETTINGS,
      customVariables: { ...data.globals },
    }
  }
  delete migrated.globals

  // templates → patterns
  if (data.templates && !data.patterns) {
    migrated.patterns = [...data.templates]
  }
  delete migrated.templates

  return migrated
}

export function getFormulasPath(libraryPath) {
  return getCreidhneFilePath(libraryPath, 'formulas.json')
}

export async function loadFormulas(libraryPath) {
  try {
    const raw = JSON.parse(await fs.readFile(getFormulasPath(libraryPath), 'utf-8'))
    const data = migrateIfNeeded(raw)
    return {
      settings: { ...DEFAULT_SETTINGS, ...data.settings },
      patterns: data.patterns || [],
      formulas: data.formulas || [],
    }
  } catch {
    return { ...EMPTY }
  }
}

export async function saveFormulas(libraryPath, data) {
  await ensureCreidhneDir(libraryPath)
  await fs.writeFile(getFormulasPath(libraryPath), JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Parse a Lua formula export and merge into existing formulas data.
 * Format: one entry per line — name = "formula string"
 *
 * Returns { updated, added, duplicates: [{ name, formula, existingName }], data }
 */
export async function importFormulas(luaFilePath, existingData) {
  const text = await fs.readFile(luaFilePath, 'utf-8')
  const parsed = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('--')) continue
    const m = /^(\w+)\s*=\s*"(.*)"/.exec(line)
    if (m) parsed.push({ name: m[1], formula: m[2] })
  }

  const existing = existingData.formulas || []
  const byName    = new Map(existing.map((f) => [f.name, f]))
  const byFormula = new Map(existing.map((f) => [f.formula, f]))

  const updated = []
  const added = []
  const duplicates = []
  const result = existing.map((f) => ({ ...f }))

  for (const { name, formula } of parsed) {
    if (byName.has(name)) {
      const idx = result.findIndex((f) => f.name === name)
      result[idx] = { ...result[idx], formula }
      updated.push(name)
    } else {
      const dup = byFormula.get(formula)
      if (dup) duplicates.push({ name, formula, existingName: dup.name })
      result.push({ id: randomUUID(), name, description: '', category: 'damage', formula })
      added.push(name)
    }
  }

  return { updated: updated.length, added: added.length, duplicates, data: { ...existingData, formulas: result } }
}

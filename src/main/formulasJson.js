import { promises as fs } from 'fs'
import { getCreidhneFilePath, ensureCreidhneDir } from './worldData.js'

const EMPTY = {
  globals:   {},
  templates: [],
  formulas:  [],
}

export function getFormulasPath(libraryPath) {
  return getCreidhneFilePath(libraryPath, 'formulas.json')
}

export async function loadFormulas(libraryPath) {
  try {
    const data = JSON.parse(await fs.readFile(getFormulasPath(libraryPath), 'utf-8'))
    return { ...EMPTY, ...data }
  } catch {
    return { ...EMPTY }
  }
}

export async function saveFormulas(libraryPath, data) {
  await ensureCreidhneDir(libraryPath)
  await fs.writeFile(getFormulasPath(libraryPath), JSON.stringify(data, null, 2), 'utf-8')
}

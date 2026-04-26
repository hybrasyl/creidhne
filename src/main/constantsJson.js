import { promises as fs } from 'fs'
import { getCreidhneFilePath, ensureCreidhneDir } from './worldData.js'

const EMPTY = {
  vendorTabs: [],
  itemCategories: [],
  castableCategories: [],
  statusCategories: [],
  cookies: [],
  npcJobs: [],
  creatureFamilies: [],
  motions: [],
  weapons: []
}

export function getConstantsPath(libraryPath) {
  return getCreidhneFilePath(libraryPath, 'constants.json')
}

export async function loadConstants(libraryPath) {
  try {
    const data = JSON.parse(await fs.readFile(getConstantsPath(libraryPath), 'utf-8'))
    return { ...EMPTY, ...data }
  } catch {
    return { ...EMPTY }
  }
}

export async function saveConstants(libraryPath, data) {
  await ensureCreidhneDir(libraryPath)
  await fs.writeFile(getConstantsPath(libraryPath), JSON.stringify(data, null, 2), 'utf-8')
}

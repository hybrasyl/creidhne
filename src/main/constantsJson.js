import { join } from 'path'
import { promises as fs } from 'fs'

const EMPTY = {
  vendorTabs:         [],
  itemCategories:     [],
  castableCategories: [],
  statusCategories:   [],
  cookies:            [],
  npcJobs:            [],
}

export function getConstantsPath(libraryPath) {
  return join(libraryPath, 'constants.json')
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
  await fs.writeFile(getConstantsPath(libraryPath), JSON.stringify(data, null, 2), 'utf-8')
}

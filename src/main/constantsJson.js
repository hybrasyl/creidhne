import { promises as fs } from 'fs'
import { getCreidhneFilePath, ensureCreidhneDir } from './worldData.js'
import { DEFAULT_NPC_SPECIES } from '../shared/npcSpecies.js'

// What a world has before anyone edits its constants. Every key is empty except
// `npcSpecies`, which starts from the lore repo's list: an NPC's species has no
// XML element and no filename prefix to scan for, so with an empty start the
// picker would offer nothing until someone typed every name in by hand. A key
// present in the file — even as `[]` — wins over this, so a world that trims
// the list keeps its trim.
const EMPTY = {
  vendorTabs: [],
  itemCategories: [],
  castableCategories: [],
  statusCategories: [],
  cookies: [],
  npcJobs: [],
  npcSpecies: [...DEFAULT_NPC_SPECIES],
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

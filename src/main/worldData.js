import { join } from 'path'
import { promises as fs } from 'fs'

/**
 * Returns the path to the per-world Creidhne data directory.
 * libraryPath points to world/xml/; world/.creidhne/ is one level up.
 */
export function getCreidhnePath(libraryPath) {
  return join(libraryPath, '..', '.creidhne')
}

/**
 * Returns the full path to a file inside world/.creidhne/.
 */
export function getCreidhneFilePath(libraryPath, filename) {
  return join(libraryPath, '..', '.creidhne', filename)
}

/**
 * Ensures world/.creidhne/ exists. Call before any write.
 */
export async function ensureCreidhneDir(libraryPath) {
  await fs.mkdir(getCreidhnePath(libraryPath), { recursive: true })
}

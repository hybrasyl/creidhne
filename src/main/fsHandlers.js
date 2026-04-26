import { promises as fs } from 'fs'
import { join, dirname } from 'path'

export async function listDir(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.xml'))
      .map((e) => ({ name: e.name, path: join(dirPath, e.name) }))
  } catch {
    return []
  }
}

export async function readFile(filePath) {
  return fs.readFile(filePath, 'utf-8')
}

export async function readBinaryFile(filePath) {
  // Return as Buffer; renderer wraps it in Uint8Array for dalib-ts
  return fs.readFile(filePath)
}

// Files dalib-ts pickers depend on. Relative paths from the DA client root.
// Source: sprite_pickers_roadmap.md
// `category` controls which pickers are affected when a file is missing.
export const KNOWN_DAT_FILES = [
  { rel: 'legend.dat', category: 'sounds + spell/skill icons + item sprites' },
  { rel: 'roh.dat', category: 'spell effects' },
  { rel: 'setoa.dat', category: 'nation crests (nation.epf)' },
  { rel: 'npc/npcbase.dat', category: 'NPC portraits' },
  // Khan dats (item display sprites — armor): 5 male + 5 female + 1 palettes.
  { rel: 'khanmad.dat', category: 'item display sprites (male)' },
  { rel: 'khanmeh.dat', category: 'item display sprites (male)' },
  { rel: 'khanmim.dat', category: 'item display sprites (male)' },
  { rel: 'khanmns.dat', category: 'item display sprites (male)' },
  { rel: 'khanmtz.dat', category: 'item display sprites (male)' },
  { rel: 'khanwad.dat', category: 'item display sprites (female)' },
  { rel: 'khanweh.dat', category: 'item display sprites (female)' },
  { rel: 'khanwim.dat', category: 'item display sprites (female)' },
  { rel: 'khanwns.dat', category: 'item display sprites (female)' },
  { rel: 'khanwtz.dat', category: 'item display sprites (female)' },
  { rel: 'khanpal.dat', category: 'item display sprites (palettes)' }
]
// Note: item sprites (item001.epf – item054.epf) live inside legend.dat,
// so they're covered by the legend.dat check above.

export async function checkClientPath(clientPath) {
  if (!clientPath || typeof clientPath !== 'string') {
    return { status: 'gray', files: [] }
  }
  const files = await Promise.all(
    KNOWN_DAT_FILES.map(async ({ rel, category }) => {
      const fullPath = join(clientPath, rel)
      let found = false
      try {
        await fs.access(fullPath)
        found = true
      } catch {
        /* not found */
      }
      return { rel, category, found }
    })
  )
  const foundCount = files.filter((f) => f.found).length
  let status
  if (foundCount === 0) status = 'red'
  else if (foundCount === files.length) status = 'green'
  else status = 'yellow'
  return { status, files }
}

export async function writeFile(filePath, content) {
  await fs.writeFile(filePath, content, 'utf-8')
}

export async function moveFile(src, dest) {
  try {
    await fs.access(dest)
    return { conflict: true }
  } catch {
    // dest does not exist, safe to move
  }
  await fs.mkdir(dirname(dest), { recursive: true })
  await fs.rename(src, dest)
  return { success: true }
}

export async function archiveFile(src, archiveDir) {
  const baseName = src.split(/[\\/]/).pop()
  const ext = baseName.toLowerCase().endsWith('.xml') ? '.xml' : ''
  const stem = ext ? baseName.slice(0, -ext.length) : baseName
  await fs.mkdir(archiveDir, { recursive: true })
  let dest = join(archiveDir, baseName)
  let counter = 1
  while (true) {
    try {
      await fs.access(dest)
      dest = join(archiveDir, `${stem}_${counter}${ext}`)
      counter++
    } catch {
      break
    }
  }
  await fs.rename(src, dest)
  return { success: true, archivedAs: dest.split(/[\\/]/).pop() }
}

// Bulk wrappers — settle each independently so a single failure doesn't
// strand the rest of the batch. Caller renders ok/failed counts to the user.

export async function archiveFiles(srcs, archiveDir) {
  const ok = []
  const failed = []
  for (const src of srcs) {
    try {
      const r = await archiveFile(src, archiveDir)
      ok.push({ src, archivedAs: r.archivedAs })
    } catch (err) {
      failed.push({ src, reason: err?.message || 'archive failed' })
    }
  }
  return { ok, failed }
}

// Copy a file in place under a "_copy" / "_copy_2" / ... filename. Returns
// the destination basename so the renderer can snackbar it. The duplicate
// is a byte-for-byte copy — the inner <Name>/<Locale>/etc. is left
// unchanged. The user is expected to rename in the editor; the existing
// dup-name guard catches the collision on first save.
export async function duplicateFile(src) {
  const baseName = src.split(/[\\/]/).pop()
  const dir = src.slice(0, src.length - baseName.length - 1)
  const ext = baseName.toLowerCase().endsWith('.xml') ? '.xml' : ''
  const stem = ext ? baseName.slice(0, -ext.length) : baseName
  // Collision-avoid: try `${stem}_copy${ext}`, then `${stem}_copy_2${ext}`, ...
  let candidate = `${stem}_copy${ext}`
  let counter = 2
  while (true) {
    const dest = join(dir, candidate)
    try {
      await fs.access(dest)
      candidate = `${stem}_copy_${counter}${ext}`
      counter++
    } catch {
      const content = await fs.readFile(src)
      await fs.writeFile(dest, content)
      return { success: true, duplicateAs: candidate, dest }
    }
  }
}

export async function unarchiveFiles(srcs, destDir) {
  const ok = []
  const failed = []
  for (const src of srcs) {
    const baseName = src.split(/[\\/]/).pop()
    const dest = join(destDir, baseName)
    try {
      const r = await moveFile(src, dest)
      if (r?.conflict) {
        failed.push({ src, reason: 'conflict' })
      } else {
        ok.push({ src, dest })
      }
    } catch (err) {
      failed.push({ src, reason: err?.message || 'unarchive failed' })
    }
  }
  return { ok, failed }
}

import { promises as fs } from 'fs'
import { join, dirname, relative, isAbsolute } from 'path'
import { listSectionFiles } from '@eriscorp/hybindex-ts'

// Enumerate one world type (`castables`, `items`, …), recursively, split into
// active and archived. Delegates to the index package rather than walking here:
// `listSectionFiles` is the single definition of which files belong to a
// section, so going through it is what keeps this list from disagreeing with
// the index's filename keys. Entries are type-relative, forward-slashed, sorted
// — and each one IS the key into `<type>NamesByFilename`.
//
// `dir` is normalized to forward slashes. Every renderer-side path is then
// built as `${dir}/${rel}`, which matches how the pages construct save paths;
// `join`'s native backslashes did not, so `selectedFile.path === file.path`
// silently failed and the list lost its selection highlight after a rename.
export async function listSection(libraryPath, type) {
  const { dir, active, archived } = await listSectionFiles(libraryPath, type)
  return { dir: dir.replace(/\\/g, '/'), active, archived }
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
  { rel: 'hades.dat', category: 'creature/NPC sprites' },
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

// The parent directory is created rather than assumed: the editors' folder
// picker is free-text, so a save is allowed to name a subfolder that does not
// exist yet — typing one IS how you create it. Without the mkdir that save
// fails with ENOENT. `filePath` is already path-validated by the caller.
export async function writeFile(filePath, content) {
  await fs.mkdir(dirname(filePath), { recursive: true })
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

// The subdirectory `src` sits in, relative to the type root that owns
// `archiveDir` (`<type>/.ignore` → `<type>`). Returns '' for a file already at
// the type root, or one outside it — the latter has no position under the type
// to mirror, so it archives flat.
//
// A leading `.ignore` is dropped so an already-archived file is measured from
// inside the archive, not from the type root. Without that, re-archiving
// `.ignore/old.xml` (which the rename flow does, to retire the old file) targets
// `.ignore/.ignore/old.xml` and buries it in a nested archive.
function subDirWithinType(src, archiveDir) {
  const typeRoot = dirname(archiveDir)
  const rel = relative(typeRoot, dirname(src))
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return ''
  const segs = rel.split(/[\\/]/)
  if (segs[0] === '.ignore') segs.shift()
  return segs.join('/')
}

// Archive mirrors the file's subdirectory into the archive rather than
// flattening: `universal/x.xml` → `.ignore/universal/x.xml`. Flattening let two
// files in different subfolders collide on one archive name, and the suffixer
// would silently rename one to `x_1.xml`. Mirroring also lets unarchive put the
// file back where it came from. `isArchivedPath` matches `.ignore` at any depth,
// so the nested entry is still correctly classified as archived by the index.
export async function archiveFile(src, archiveDir) {
  const baseName = src.split(/[\\/]/).pop()
  const ext = baseName.toLowerCase().endsWith('.xml') ? '.xml' : ''
  const stem = ext ? baseName.slice(0, -ext.length) : baseName
  const subDir = subDirWithinType(src, archiveDir)
  const destDir = subDir ? join(archiveDir, subDir) : archiveDir
  await fs.mkdir(destDir, { recursive: true })
  let dest = join(destDir, baseName)
  let counter = 1
  while (true) {
    try {
      await fs.access(dest)
      dest = join(destDir, `${stem}_${counter}${ext}`)
      counter++
    } catch {
      break
    }
  }
  await fs.rename(src, dest)
  // Report the archive-relative path so a mirrored file says where it landed,
  // not just its basename.
  const archivedAs = subDir
    ? `${subDir.replace(/\\/g, '/')}/${dest.split(/[\\/]/).pop()}`
    : dest.split(/[\\/]/).pop()
  return { success: true, archivedAs }
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

// The archive-relative path of `src` — everything after the `.ignore` segment.
// `…/castables/.ignore/universal/x.xml` → `universal/x.xml`. Falls back to the
// basename when no `.ignore` segment is present.
function pathWithinArchive(src) {
  const parts = src.split(/[\\/]/)
  const idx = parts.lastIndexOf('.ignore')
  return idx === -1 ? parts[parts.length - 1] : parts.slice(idx + 1).join('/')
}

// Restores to the subdirectory the file was archived from, mirroring
// archiveFile: `.ignore/universal/x.xml` → `universal/x.xml`. Flattening here
// would silently relocate the file to the type root on a round-trip.
export async function unarchiveFiles(srcs, destDir) {
  const ok = []
  const failed = []
  for (const src of srcs) {
    const dest = join(destDir, pathWithinArchive(src))
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

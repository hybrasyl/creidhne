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
  const ext  = baseName.toLowerCase().endsWith('.xml') ? '.xml' : ''
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

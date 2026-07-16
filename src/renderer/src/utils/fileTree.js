/**
 * Pure helpers behind EditorFileListPanel's Active/Archived tabs and its
 * folder-vs-flat view. No JSX and no DOM: the renderer test tier is node-only
 * (no jsdom), so every decision the panel makes lives here where it can be
 * tested, and the component stays a dumb renderer.
 *
 * The input is always a flat list of type-relative paths from `fs:listSection`
 * (hybindex's `listSectionFiles`) — already recursive, split into active vs
 * archived, and sorted. The tree is derived from those paths, so **empty
 * folders are invisible**: a directory with no `.xml` under it has no rel path
 * to group on and never renders. That is real today — `spawngroups/.ignore/1.0
 * Spawngroups/` holds zero files.
 */

/** Folder header rows are single-line; file rows carry a name + subtitle. */
export const ITEM_HEIGHT = 52
export const FOLDER_HEIGHT = 32

/** Matches Mabon's nav trees, so the house trees indent alike. */
export const INDENT_STEP = 1.5

export function stripXml(filename) {
  return filename.replace(/\.xml$/i, '')
}

/**
 * Shape one `listSection` entry for the panel.
 *
 * `rel` stays exactly as the index keys it — including the `.ignore/` prefix on
 * archived entries — because it IS the `<type>NamesByFilename` key. `treePath`
 * drops that prefix so the Archived tab groups by real folders rather than
 * nesting everything under a `.ignore` node the user never thinks about.
 */
export function toSectionFile(dir, rel, archived = false) {
  const treePath = archived ? rel.replace(/^\.ignore\//, '') : rel
  const segs = rel.split('/')
  return {
    rel,
    treePath,
    name: segs[segs.length - 1],
    path: `${dir}/${rel}`,
    archived
  }
}

/**
 * The entity's inner <Name>/<Locale> from the index, falling back to the bare
 * filename. Keyed by `rel` — the index's own key — which is why no `.ignore/`
 * prefix threading is needed for the archived list.
 */
export function displayNameFor(file, namesByFilename) {
  return namesByFilename?.[file.rel] ?? stripXml(file.name)
}

export function matchesFilter(file, query, namesByFilename) {
  if (!query) return true
  const q = query.toLowerCase()
  if (stripXml(file.name).toLowerCase().includes(q)) return true
  // Match the folder path too, so "universal" finds what's filed under it.
  if (file.treePath.toLowerCase().includes(q)) return true
  const name = namesByFilename?.[file.rel]
  return !!(name && name.toLowerCase().includes(q))
}

export function filterFiles(files, query, namesByFilename) {
  if (!query) return files
  return files.filter((f) => matchesFilter(f, query, namesByFilename))
}

/** The folder portion of a rel path: 'universal/x.xml' → 'universal', 'x.xml' → ''. */
export function relDir(rel) {
  const i = rel.lastIndexOf('/')
  return i === -1 ? '' : rel.slice(0, i)
}

/**
 * Where a page should write `fileName`, given the file currently open.
 *
 * The rule this encodes is load-bearing and easy to get wrong: a renamed file
 * stays in the subfolder it was filed under. Building `<library>/<type>/<name>`
 * unconditionally — as every page did before subfolders existed — silently lifts
 * it out of e.g. `universal/` and back to the type root, archiving the original
 * on the way. That is one rule, so it lives in one place rather than being
 * restated in each editor page.
 *
 * A new file (`selectedFile` null) has no folder to inherit and lands at the
 * type root. Returns `newRel` too: it is the index key the file list looks names
 * up by, and the source of the subfolder on any later rename.
 */
export function resolveSavePath(library, subdir, selectedFile, fileName) {
  const subDir = selectedFile ? relDir(selectedFile.rel) : ''
  const newRel = subDir ? `${subDir}/${fileName}` : fileName
  // Saving under the same name writes back to the exact path we were handed,
  // rather than a rebuilt one that is equivalent but not string-identical.
  const newPath =
    selectedFile && fileName === selectedFile.name
      ? selectedFile.path
      : `${library}/${subdir}/${newRel}`
  return { newPath, newRel }
}

/**
 * Group files into a nested tree on their `treePath` segments. Each folder node
 * carries its own descendant `count`, stamped here — the build already visits
 * every node, so the flatten pass reads it instead of re-walking each subtree.
 *
 * Filtering happens BEFORE this (see filterFiles), not inside it: rebuilding
 * from surviving leaves drops empty folders and keeps the ancestors of every
 * match automatically, so there is no separate prune pass or ancestor-collection
 * step to keep in sync.
 *
 * Children come out folders-first, then files, each group alphabetical.
 */
export function buildFileTree(files) {
  const root = { children: new Map(), files: [] }
  for (const file of files) {
    const segs = file.treePath.split('/')
    let node = root
    for (let i = 0; i < segs.length - 1; i++) {
      const key = segs.slice(0, i + 1).join('/')
      if (!node.children.has(key)) {
        node.children.set(key, { name: segs[i], key, children: new Map(), files: [] })
      }
      node = node.children.get(key)
    }
    node.files.push(file)
  }

  const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  const toNodes = (node) => {
    // Folders must be sorted by name rather than left in Map insertion order:
    // that order follows the full path, where '/' (0x2F) sorts below letters, so
    // `a-b/x.xml` would otherwise precede `a/x.xml`. Files are sorted with the
    // same comparator — listSectionFiles already hands us path order, but this
    // helper is pure and shouldn't depend on its caller for ordering.
    const folders = [...node.children.values()].sort(byName).map((c) => {
      const children = toNodes(c)
      const count = children.reduce((n, ch) => n + (ch.kind === 'file' ? 1 : ch.count), 0)
      return { kind: 'folder', key: c.key, name: c.name, count, children }
    })
    const files = node.files
      .slice()
      .sort(byName)
      .map((f) => ({ kind: 'file', key: f.path, file: f }))
    return [...folders, ...files]
  }
  return toNodes(root)
}

/**
 * Flatten the tree into the linear row array react-window renders. Virtualizing
 * requires a flat `rowCount`, so collapse state is resolved here rather than by
 * unmounting subtrees.
 *
 * `expandAll` forces every folder open — used while a filter is active, where
 * the surviving tree is only matches plus their ancestors, so revealing all of
 * it is exactly the right behavior (and sidesteps having to reconcile
 * filter-forced-open against the user's manual expansion).
 */
export function flattenTree(nodes, expanded, expandAll = false) {
  const rows = []
  const walk = (ns, depth) => {
    for (const node of ns) {
      if (node.kind === 'file') {
        rows.push({ kind: 'file', key: node.key, file: node.file, depth })
        continue
      }
      const open = expandAll || expanded.has(node.key)
      rows.push({ kind: 'folder', key: node.key, name: node.name, depth, open, count: node.count })
      if (open) walk(node.children, depth + 1)
    }
  }
  walk(nodes, 0)
  return rows
}

/** Flat view: every file at depth 0, no folder rows. */
export function flattenFlat(files) {
  return files.map((file) => ({ kind: 'file', key: file.path, file, depth: 0 }))
}

/**
 * react-window row heights. Folder headers are shorter than file rows, so this
 * must be a function rather than a constant.
 */
export function rowHeightFor(rows) {
  return (index) => (rows[index]?.kind === 'folder' ? FOLDER_HEIGHT : ITEM_HEIGHT)
}

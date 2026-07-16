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

/**
 * The folder portion of a rel path: 'universal/x.xml' → 'universal', 'x.xml' → ''.
 * Pages use this to keep a renamed file in its own subfolder — writing to
 * `<type>/<name>` unconditionally would silently move it up to the type root.
 */
export function relDir(rel) {
  const i = rel.lastIndexOf('/')
  return i === -1 ? '' : rel.slice(0, i)
}

/** Every folder key on the way to `treePath`: 'a/b/c.xml' → ['a', 'a/b']. */
export function ancestorFolders(treePath) {
  const segs = treePath.split('/')
  const out = []
  for (let i = 1; i < segs.length; i++) out.push(segs.slice(0, i).join('/'))
  return out
}

/**
 * Group files into a nested tree on their `treePath` segments.
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
    const folders = [...node.children.values()]
      .sort(byName)
      .map((c) => ({ kind: 'folder', key: c.key, name: c.name, children: toNodes(c) }))
    const files = node.files
      .slice()
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .map((f) => ({ kind: 'file', key: f.path, file: f }))
    return [...folders, ...files]
  }
  return toNodes(root)
}

/** Total files beneath a node, for the folder row's count badge. */
function countFiles(nodes) {
  let n = 0
  for (const node of nodes) {
    if (node.kind === 'file') n++
    else n += countFiles(node.children)
  }
  return n
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
      rows.push({
        kind: 'folder',
        key: node.key,
        name: node.name,
        depth,
        open,
        count: countFiles(node.children)
      })
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

/** Every folder key in the tree, for expand-all. */
export function collectExpandable(nodes) {
  const out = []
  const walk = (ns) => {
    for (const node of ns) {
      if (node.kind === 'folder') {
        out.push(node.key)
        walk(node.children)
      }
    }
  }
  walk(nodes)
  return out
}

/**
 * react-window row heights. Folder headers are shorter than file rows, so this
 * must be a function rather than a constant.
 */
export function rowHeightFor(rows) {
  return (index) => (rows[index]?.kind === 'folder' ? FOLDER_HEIGHT : ITEM_HEIGHT)
}

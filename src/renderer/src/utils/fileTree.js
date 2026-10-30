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
/** A set's header row, shown when the list shows two or three sets (HTOO-628). */
export const SECTION_HEIGHT = 28

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
    dir,
    archived,
    staged: false
  }
}

/**
 * Shape one staged file (HTOO-453) for the panel. `dir` is
 * `<world>/.staging/<type>`, from `staging:list`, and `rel` is the path inside
 * it — the key of the staged index's `namesByFilename`, and the path the file
 * takes in `xml/<type>/` when it is released.
 *
 * `rel` is never looked up in the live index. A staged rel and a live rel can be
 * the same string, so every lookup goes through `staged` first.
 */
export function toStagedFile(dir, rel) {
  return { ...toSectionFile(dir, rel, false), staged: true }
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

/** Join two rel fragments, tolerating either (or both) being empty. */
export function joinRel(a, b) {
  return a && b ? `${a}/${b}` : a || b
}

/**
 * The distinct folders a file list occupies — every ancestor included, the type
 * root excluded, sorted. These are the editor folder picker's options.
 *
 * Keyed on `treePath`, not `rel`, so an archived file contributes `universal`
 * rather than `.ignore/universal`: the picker chooses a place within the type,
 * and the archive is not one of those places.
 *
 * Callers should pass the active AND archived lists — a folder whose files have
 * all been archived is still somewhere you might legitimately file something.
 */
export function folderOptions(files) {
  const paths = new Set()
  for (const file of files) {
    const folder = relDir(file.treePath)
    if (!folder) continue
    let path = ''
    for (const seg of folder.split('/')) {
      path = joinRel(path, seg)
      paths.add(path)
    }
  }
  return [...paths].sort()
}

/**
 * Clean up a typed folder path: forward-slashes, trims each segment, collapses
 * repeated separators, drops `.` and `..`.
 *
 * Main still validates every renderer path (`assertInsideAnyRoot`), but a picker
 * that hands `..` straight through fails as an error dialog *after* the save
 * rather than as an option that simply isn't available, so clean it here too.
 */
export function normalizeFolder(input) {
  return String(input ?? '')
    .replace(/\\/g, '/')
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s && s !== '.' && s !== '..')
    .join('/')
}

/**
 * Where a page should write `fileName`, given the file currently open and the
 * folder the editor's picker is showing.
 *
 * The rule this encodes is load-bearing and easy to get wrong: a renamed file
 * stays in the subfolder it was filed under. Building `<library>/<type>/<name>`
 * unconditionally — as every page did before subfolders existed — silently lifts
 * it out of e.g. `universal/` and back to the type root, archiving the original
 * on the way. That is one rule, so it lives in one place rather than being
 * restated in each editor page.
 *
 * `folder` is the picker's value, relative to the type root. An **archived**
 * file's picker shows its active-equivalent folder (from `treePath`), so the
 * `.ignore/` prefix is put back here: saving an archived file edits it in place
 * instead of silently resurrecting it into the active tree.
 *
 * Omitting `folder` falls back to the file's own folder — the pre-picker
 * behaviour, kept so any call site that doesn't offer a picker is unchanged. A
 * new file (`selectedFile` null) then lands at the type root.
 *
 * Returns `newRel` — the index key the file list looks names up by, and the
 * source of the subfolder on any later rename — and `isRename`, true when the
 * save lands anywhere other than where the open file is, whether that's a new
 * name, a new folder, or both.
 *
 * Also returns `file`, the list entry for where the save lands, so a page
 * selects the file it wrote.
 *
 * `stagedDir` chooses the root (HTOO-453, HTOO-628). It is the type's staging
 * folder when the editor's Staging box is checked, and undefined when it is
 * clear. The folder is the path inside the type on both sides, because staging
 * has the same layout as `xml/`. An archived file ignores it: it stays in the
 * archive, and Unarchive is its way out.
 *
 * `crossesRoot` is true when an open file moves between the live tree and
 * staging. The page then moves the file (one file stays, never a supersede) and
 * runs the checks that Stage or Release run.
 */
export function resolveSavePath(library, subdir, selectedFile, fileName, folder, stagedDir) {
  const archived = selectedFile?.archived === true
  const staged = !archived && !!stagedDir
  const subDir =
    folder === undefined
      ? relDir(selectedFile?.rel ?? '')
      : joinRel(archived ? '.ignore' : '', normalizeFolder(folder))
  const newRel = joinRel(subDir, fileName)
  const crossesRoot = !!selectedFile && !archived && (selectedFile.staged === true) !== staged
  const isRename = !!selectedFile && (crossesRoot || newRel !== selectedFile.rel)
  const dir = staged ? stagedDir : `${library}/${subdir}`
  // Saving to the same place writes back to the exact path we were handed,
  // rather than a rebuilt one that is equivalent but not string-identical.
  const newPath = selectedFile && !isRename ? selectedFile.path : `${dir}/${newRel}`
  const file = staged ? toStagedFile(dir, newRel) : toSectionFile(dir, newRel, archived)
  return { newPath, newRel, isRename, crossesRoot, file }
}

/** Which set a file is in: `'active'`, `'archived'` or `'staged'`. */
export function fileSet(file) {
  return file?.staged ? 'staged' : file?.archived ? 'archived' : 'active'
}

/**
 * The page toolbar's item actions for a selection (HTOO-628). Each is enabled
 * only when it applies to every selected file, and two of them change with the
 * selection: Archive is Unarchive for archived files, and Stage is Release for
 * staged files. Staging has no archive, so Archive does not apply to a staged
 * file, and an archived file cannot be staged.
 */
export function selectionActions(selected) {
  const sets = new Set((selected || []).map(fileSet))
  const only = sets.size === 1 ? [...sets][0] : null
  const count = (selected || []).length
  return {
    archive:
      only === 'archived'
        ? { kind: 'unarchive', label: 'Unarchive', enabled: true }
        : { kind: 'archive', label: 'Archive', enabled: only === 'active' },
    move:
      only === 'staged'
        ? { kind: 'release', label: 'Release', enabled: true }
        : { kind: 'stage', label: 'Stage', enabled: only === 'active' },
    copy: { enabled: count === 1 },
    delete: { enabled: count > 0 }
  }
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
 *
 * `prefix` goes in front of every folder key. The list gives each set its own
 * (`staged:`), so a folder opened under one set stays closed under another.
 */
export function buildFileTree(files, prefix = '') {
  const root = { children: new Map(), files: [] }
  for (const file of files) {
    const segs = file.treePath.split('/')
    let node = root
    for (let i = 0; i < segs.length - 1; i++) {
      const key = prefix + segs.slice(0, i + 1).join('/')
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

/**
 * Every folder key in a built tree, depth-first — what "expand all" needs, and
 * what "is everything already expanded?" is measured against.
 *
 * Derived from the tree rather than from the file list, because a folder exists
 * here only if `buildFileTree` made a node for it; collecting `relDir` values
 * instead would invent keys for folders the tree does not have and leave the
 * expand-all set permanently unequal to the expanded set.
 */
export function folderKeys(nodes) {
  const keys = []
  const walk = (list) => {
    for (const node of list ?? []) {
      if (node.kind !== 'folder') continue
      keys.push(node.key)
      walk(node.children)
    }
  }
  walk(nodes)
  return keys
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
  return (index) => {
    const kind = rows[index]?.kind
    return kind === 'section' ? SECTION_HEIGHT : kind === 'folder' ? FOLDER_HEIGHT : ITEM_HEIGHT
  }
}

/**
 * The sets a list can show, in list order (HTOO-628). The page toolbar's
 * toggles choose which ones are shown; Active is the default.
 */
export const LIST_SETS = Object.freeze([
  { key: 'active', label: 'Active' },
  { key: 'staged', label: 'Staged' },
  { key: 'archived', label: 'Archived' }
])

/**
 * The rows of a list that shows one or more sets. `sections` is the shown sets
 * in list order, each `{ key, label, files }` with its files already filtered.
 *
 * Each set starts with a `section` row that names it and counts its files, with
 * one set shown or three, so a file's set is always clear from where it sits.
 * A header collapses its set: `collapsed` holds the keys of the collapsed
 * sets, and their files have no rows. `expandAll` (a live filter) opens every
 * set as it opens every folder, so a match is never inside a closed set.
 *
 * Returns `{ rows, folderKeys }`: the folder keys of every set, for expand-all.
 */
export function buildListRows({ sections, folderMode, expanded, expandAll, collapsed }) {
  const rows = []
  const keys = []
  for (const section of sections) {
    const open = expandAll || !collapsed?.has(section.key)
    rows.push({
      kind: 'section',
      key: `section:${section.key}`,
      set: section.key,
      name: section.label,
      count: section.files.length,
      open,
      depth: 0
    })
    if (!open) continue
    if (!folderMode) {
      rows.push(...flattenFlat(section.files))
      continue
    }
    const tree = buildFileTree(section.files, `${section.key}:`)
    keys.push(...folderKeys(tree))
    rows.push(...flattenTree(tree, expanded, expandAll))
  }
  return { rows, folderKeys: keys }
}

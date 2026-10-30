import { describe, it, expect } from 'vitest'
import {
  stripXml,
  toSectionFile,
  toStagedFile,
  selectionActions,
  buildListRows,
  fileSet,
  SECTION_HEIGHT,
  displayNameFor,
  matchesFilter,
  filterFiles,
  buildFileTree,
  flattenTree,
  flattenFlat,
  rowHeightFor,
  resolveSavePath,
  relDir,
  joinRel,
  folderOptions,
  normalizeFolder,
  ITEM_HEIGHT,
  FOLDER_HEIGHT
} from '../fileTree'

const DIR = 'E:/world/xml/castables'

// Shorthand: active file from a rel path.
const f = (rel) => toSectionFile(DIR, rel, false)
// Shorthand: archived file (rel keeps its .ignore/ prefix).
const a = (rel) => toSectionFile(DIR, rel, true)

// ─── toSectionFile ───────────────────────────────────────────────────────────

describe('toSectionFile', () => {
  it('shapes a type-root file', () => {
    expect(f('blast.xml')).toEqual({
      rel: 'blast.xml',
      treePath: 'blast.xml',
      name: 'blast.xml',
      path: `${DIR}/blast.xml`,
      dir: DIR,
      archived: false,
      staged: false
    })
  })

  it('keeps the subfolder in rel, treePath and path', () => {
    const file = f('universal/all_psp_dachaidh.xml')
    expect(file.rel).toBe('universal/all_psp_dachaidh.xml')
    expect(file.treePath).toBe('universal/all_psp_dachaidh.xml')
    expect(file.name).toBe('all_psp_dachaidh.xml')
    expect(file.path).toBe(`${DIR}/universal/all_psp_dachaidh.xml`)
  })

  // rel is the namesByFilename key and MUST keep .ignore/; treePath drops it so
  // the Archived tab doesn't nest everything under a `.ignore` node.
  it('retains .ignore/ in rel but strips it from treePath', () => {
    const file = a('.ignore/Deprecated Spawngroups/old.xml')
    expect(file.rel).toBe('.ignore/Deprecated Spawngroups/old.xml')
    expect(file.treePath).toBe('Deprecated Spawngroups/old.xml')
    expect(file.name).toBe('old.xml')
    expect(file.path).toBe(`${DIR}/.ignore/Deprecated Spawngroups/old.xml`)
    expect(file.archived).toBe(true)
  })

  it('strips only a leading .ignore/ segment', () => {
    expect(a('.ignore/old.xml').treePath).toBe('old.xml')
    // A file merely *named* like the marker is not treated as a prefix.
    expect(f('sword.ignore.xml').treePath).toBe('sword.ignore.xml')
  })

  it('builds forward-slashed paths so they match page-constructed save paths', () => {
    expect(f('universal/x.xml').path).not.toContain('\\')
  })
})

// ─── displayNameFor ──────────────────────────────────────────────────────────

describe('displayNameFor', () => {
  it('prefers the indexed name, keyed by rel', () => {
    const names = { 'universal/all_psp_dachaidh.xml': 'Dachaidh' }
    expect(displayNameFor(f('universal/all_psp_dachaidh.xml'), names)).toBe('Dachaidh')
  })

  // The whole point of keying on rel: archived lookups need no '.ignore/'
  // prefix threading, because rel already carries it.
  it('resolves an archived entry without any prefix threading', () => {
    const names = { '.ignore/old.xml': 'Retired Spell' }
    expect(displayNameFor(a('.ignore/old.xml'), names)).toBe('Retired Spell')
  })

  it('falls back to the bare filename', () => {
    expect(displayNameFor(f('universal/blast.xml'), {})).toBe('blast')
    expect(displayNameFor(f('blast.xml'), undefined)).toBe('blast')
  })
})

// ─── filtering ───────────────────────────────────────────────────────────────

describe('matchesFilter', () => {
  const names = { 'universal/all_psp_dachaidh.xml': 'Dachaidh' }

  it('matches everything on an empty query', () => {
    expect(matchesFilter(f('blast.xml'), '', names)).toBe(true)
  })

  it('matches the bare filename, case-insensitively', () => {
    expect(matchesFilter(f('universal/all_psp_dachaidh.xml'), 'PSP', names)).toBe(true)
  })

  it('matches the indexed display name', () => {
    expect(matchesFilter(f('universal/all_psp_dachaidh.xml'), 'dach', names)).toBe(true)
  })

  it('matches the folder path', () => {
    expect(matchesFilter(f('universal/all_psp_dachaidh.xml'), 'universal', names)).toBe(true)
  })

  it('rejects a non-match', () => {
    expect(matchesFilter(f('blast.xml'), 'zzz', names)).toBe(false)
  })
})

describe('filterFiles', () => {
  it('returns the same array on an empty query', () => {
    const files = [f('a.xml')]
    expect(filterFiles(files, '', {})).toBe(files)
  })

  it('keeps only matches', () => {
    const files = [f('blast.xml'), f('universal/dachaidh.xml')]
    expect(filterFiles(files, 'dach', {}).map((x) => x.rel)).toEqual(['universal/dachaidh.xml'])
  })
})

// ─── buildFileTree ───────────────────────────────────────────────────────────

describe('buildFileTree', () => {
  it('returns a flat list of file nodes when nothing is nested', () => {
    const tree = buildFileTree([f('a.xml'), f('b.xml')])
    expect(tree.map((n) => n.kind)).toEqual(['file', 'file'])
    expect(tree.map((n) => n.file.name)).toEqual(['a.xml', 'b.xml'])
  })

  it('groups a subfolder into a folder node', () => {
    const tree = buildFileTree([f('root.xml'), f('universal/dachaidh.xml')])
    expect(tree.map((n) => n.kind)).toEqual(['folder', 'file'])
    expect(tree[0]).toMatchObject({ kind: 'folder', key: 'universal', name: 'universal' })
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].file.name).toBe('dachaidh.xml')
  })

  it('nests deeply', () => {
    const tree = buildFileTree([f('a/b/c.xml')])
    expect(tree[0].key).toBe('a')
    expect(tree[0].children[0].key).toBe('a/b')
    expect(tree[0].children[0].children[0].file.name).toBe('c.xml')
  })

  it('orders folders before files, each alphabetically', () => {
    const tree = buildFileTree([f('z.xml'), f('a.xml'), f('zeta/x.xml'), f('alpha/y.xml')])
    expect(tree.map((n) => n.name ?? n.file.name)).toEqual(['alpha', 'zeta', 'a.xml', 'z.xml'])
  })

  it('handles an empty input', () => {
    expect(buildFileTree([])).toEqual([])
  })

  // Filtering runs before the build, so pruning is automatic: folders with no
  // surviving descendant simply never get created.
  it('drops folders whose files all filtered out', () => {
    const files = [f('universal/dachaidh.xml'), f('fire/blast.xml')]
    const tree = buildFileTree(filterFiles(files, 'dach', {}))
    expect(tree).toHaveLength(1)
    expect(tree[0].key).toBe('universal')
  })

  it('groups the archived tree by treePath, not under a .ignore node', () => {
    const tree = buildFileTree([a('.ignore/old.xml'), a('.ignore/Deprecated/older.xml')])
    expect(tree.map((n) => n.name ?? n.file.name)).toEqual(['Deprecated', 'old.xml'])
  })
})

// ─── flattenTree ─────────────────────────────────────────────────────────────

describe('flattenTree', () => {
  const tree = () => buildFileTree([f('root.xml'), f('universal/dachaidh.xml')])

  it('omits children of a collapsed folder', () => {
    const rows = flattenTree(tree(), new Set())
    expect(rows.map((r) => r.kind)).toEqual(['folder', 'file'])
    expect(rows[0]).toMatchObject({ key: 'universal', open: false, count: 1 })
    expect(rows[1].file.name).toBe('root.xml')
  })

  it('reveals children of an expanded folder', () => {
    const rows = flattenTree(tree(), new Set(['universal']))
    expect(rows.map((r) => r.kind)).toEqual(['folder', 'file', 'file'])
    expect(rows[0].open).toBe(true)
    expect(rows[1]).toMatchObject({ depth: 1 })
    expect(rows[1].file.name).toBe('dachaidh.xml')
  })

  it('increments depth per level', () => {
    const deep = buildFileTree([f('a/b/c.xml')])
    const rows = flattenTree(deep, new Set(['a', 'a/b']))
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2])
  })

  it('expandAll overrides collapsed state', () => {
    const rows = flattenTree(tree(), new Set(), true)
    expect(rows).toHaveLength(3)
    expect(rows[0].open).toBe(true)
  })

  it('counts files across nested descendants', () => {
    const deep = buildFileTree([f('a/one.xml'), f('a/b/two.xml'), f('a/b/three.xml')])
    expect(flattenTree(deep, new Set()).find((r) => r.key === 'a').count).toBe(3)
  })

  it('assigns unique keys per row', () => {
    const rows = flattenTree(tree(), new Set(['universal']))
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length)
  })
})

// ─── flattenFlat ─────────────────────────────────────────────────────────────

describe('flattenFlat', () => {
  it('emits every file at depth 0 with no folder rows', () => {
    const rows = flattenFlat([f('root.xml'), f('universal/dachaidh.xml')])
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.kind === 'file' && r.depth === 0)).toBe(true)
  })

  it('handles an empty input', () => {
    expect(flattenFlat([])).toEqual([])
  })
})

// ─── rowHeightFor ────────────────────────────────────────────────────────────

describe('rowHeightFor', () => {
  it('gives folder rows and file rows their own heights', () => {
    const rows = flattenTree(buildFileTree([f('universal/x.xml')]), new Set(['universal']))
    const h = rowHeightFor(rows)
    expect(h(0)).toBe(FOLDER_HEIGHT)
    expect(h(1)).toBe(ITEM_HEIGHT)
  })

  it('falls back to the file height for an out-of-range index', () => {
    expect(rowHeightFor([])(0)).toBe(ITEM_HEIGHT)
  })
})

// ─── stripXml ────────────────────────────────────────────────────────────────

describe('stripXml', () => {
  it('strips the extension case-insensitively, only at the end', () => {
    expect(stripXml('a.xml')).toBe('a')
    expect(stripXml('a.XML')).toBe('a')
    expect(stripXml('a.xml.bak')).toBe('a.xml.bak')
  })
})

// ─── relDir / resolveSavePath ────────────────────────────────────────────────

describe('relDir', () => {
  it('extracts the folder, or empty at the type root', () => {
    expect(relDir('universal/x.xml')).toBe('universal')
    expect(relDir('a/b/x.xml')).toBe('a/b')
    expect(relDir('x.xml')).toBe('')
  })
})

describe('joinRel', () => {
  it('joins, tolerating either side being empty', () => {
    expect(joinRel('universal', 'x.xml')).toBe('universal/x.xml')
    expect(joinRel('', 'x.xml')).toBe('x.xml')
    expect(joinRel('universal', '')).toBe('universal')
    expect(joinRel('', '')).toBe('')
  })
})

// ─── folderOptions / normalizeFolder ─────────────────────────────────────────

describe('folderOptions', () => {
  it('lists every folder in use, ancestors included, root excluded, sorted', () => {
    expect(folderOptions([f('x.xml'), f('a/b/y.xml'), f('universal/z.xml')])).toEqual([
      'a',
      'a/b',
      'universal'
    ])
  })

  it('dedupes folders shared by several files', () => {
    expect(folderOptions([f('universal/a.xml'), f('universal/b.xml')])).toEqual(['universal'])
  })

  // The picker chooses a place within the type; the archive is not one of them.
  it('reads archived entries through treePath, without the .ignore prefix', () => {
    expect(folderOptions([a('.ignore/universal/old.xml')])).toEqual(['universal'])
  })

  it('is empty when nothing is filed in a subfolder', () => {
    expect(folderOptions([f('x.xml'), a('.ignore/y.xml')])).toEqual([])
  })
})

describe('normalizeFolder', () => {
  it('forward-slashes, trims and collapses', () => {
    expect(normalizeFolder('universal\\deep')).toBe('universal/deep')
    expect(normalizeFolder('a//b')).toBe('a/b')
    expect(normalizeFolder('  a / b ')).toBe('a/b')
    expect(normalizeFolder('/a/')).toBe('a')
  })

  // A typed `..` should read as an unavailable option, not as a path-safety
  // error dialog after the save has already been attempted.
  it('drops . and .. segments', () => {
    expect(normalizeFolder('../evil')).toBe('evil')
    expect(normalizeFolder('a/./b/../c')).toBe('a/b/c')
    expect(normalizeFolder('..')).toBe('')
  })

  it('round-trips the type root as empty', () => {
    expect(normalizeFolder('')).toBe('')
    expect(normalizeFolder(undefined)).toBe('')
  })
})

// The rule this encodes is why the branch exists: a rename must not silently
// lift a file out of the folder it was filed under.
describe('resolveSavePath', () => {
  const LIB = 'E:/world/xml'
  // The path fields alone; `file` has its own tests below.
  const paths = ({ file: _file, crossesRoot: _crosses, ...rest }) => rest

  // ── No folder argument: the pre-picker behaviour, unchanged ──

  it('puts a new file at the type root', () => {
    expect(paths(resolveSavePath(LIB, 'castables', null, 'new.xml'))).toEqual({
      newPath: `${LIB}/castables/new.xml`,
      newRel: 'new.xml',
      isRename: false
    })
  })

  it('keeps a renamed file in its subfolder', () => {
    const sel = f('universal/old.xml')
    expect(paths(resolveSavePath(LIB, 'castables', sel, 'new.xml'))).toEqual({
      newPath: `${LIB}/castables/universal/new.xml`,
      newRel: 'universal/new.xml',
      isRename: true
    })
  })

  it('renames a type-root file without inventing a folder', () => {
    const sel = f('old.xml')
    expect(paths(resolveSavePath(LIB, 'castables', sel, 'new.xml'))).toEqual({
      newPath: `${LIB}/castables/new.xml`,
      newRel: 'new.xml',
      isRename: true
    })
  })

  it('writes back to the exact path when the name is unchanged', () => {
    const sel = f('universal/same.xml')
    const r = resolveSavePath(LIB, 'castables', sel, 'same.xml')
    expect(r.newPath).toBe(sel.path)
    expect(r.newRel).toBe('universal/same.xml')
    expect(r.isRename).toBe(false)
  })

  it('handles nesting deeper than one level', () => {
    const sel = f('a/b/old.xml')
    expect(resolveSavePath(LIB, 'castables', sel, 'new.xml').newRel).toBe('a/b/new.xml')
  })

  // ── With the picker's folder ──

  it('files a new file where the picker says', () => {
    expect(paths(resolveSavePath(LIB, 'castables', null, 'new.xml', 'universal'))).toEqual({
      newPath: `${LIB}/castables/universal/new.xml`,
      newRel: 'universal/new.xml',
      isRename: false
    })
  })

  it('moves a file to another folder without renaming it', () => {
    const sel = f('universal/x.xml')
    expect(paths(resolveSavePath(LIB, 'castables', sel, 'x.xml', 'deep'))).toEqual({
      newPath: `${LIB}/castables/deep/x.xml`,
      newRel: 'deep/x.xml',
      isRename: true
    })
  })

  it('moves a file back to the type root when the picker is cleared', () => {
    const sel = f('universal/x.xml')
    const r = resolveSavePath(LIB, 'castables', sel, 'x.xml', '')
    expect(r.newRel).toBe('x.xml')
    expect(r.isRename).toBe(true)
  })

  it('treats a move plus a rename as one rename', () => {
    const sel = f('universal/old.xml')
    const r = resolveSavePath(LIB, 'castables', sel, 'new.xml', 'deep')
    expect(r.newRel).toBe('deep/new.xml')
    expect(r.isRename).toBe(true)
  })

  it('reports no rename when the picker matches where the file already is', () => {
    const sel = f('universal/x.xml')
    const r = resolveSavePath(LIB, 'castables', sel, 'x.xml', 'universal')
    expect(r.newPath).toBe(sel.path)
    expect(r.isRename).toBe(false)
  })

  it('normalizes what the picker hands over', () => {
    expect(resolveSavePath(LIB, 'castables', null, 'x.xml', '../a//b/').newRel).toBe('a/b/x.xml')
  })

  // Saving an archived file edits it in place; it does not resurrect it into
  // the active tree just because the picker shows its active-side folder.
  it('keeps an archived file under .ignore', () => {
    const sel = a('.ignore/universal/x.xml')
    const r = resolveSavePath(LIB, 'castables', sel, 'x.xml', 'universal')
    expect(r.newRel).toBe('.ignore/universal/x.xml')
    expect(r.newPath).toBe(sel.path)
    expect(r.isRename).toBe(false)
  })

  it('moves an archived file within the archive', () => {
    const sel = a('.ignore/universal/x.xml')
    const r = resolveSavePath(LIB, 'castables', sel, 'x.xml', 'deep')
    expect(r.newRel).toBe('.ignore/deep/x.xml')
    expect(r.newPath).toBe(`${LIB}/castables/.ignore/deep/x.xml`)
    expect(r.isRename).toBe(true)
  })

  // The list entry for where the save lands, so the page selects what it wrote.
  it('returns the file the save lands in', () => {
    const sel = f('universal/old.xml')
    const { file } = resolveSavePath(LIB, 'castables', sel, 'new.xml')
    expect(file).toEqual(toSectionFile(`${LIB}/castables`, 'universal/new.xml', false))
  })

  it('returns an archived file for an archived save', () => {
    const sel = a('.ignore/universal/x.xml')
    const { file } = resolveSavePath(LIB, 'castables', sel, 'y.xml', 'universal')
    expect(file.archived).toBe(true)
    expect(file.rel).toBe('.ignore/universal/y.xml')
  })

  // HTOO-453: a staged file stays in staging. Building the path under
  // <library>/<type> would release it on its first rename.
  // HTOO-453, HTOO-628: the sixth argument is the staging folder while the
  // editor's Staging box is checked. It chooses the root; the folder stays the
  // path inside the type.
  describe('the Staging box', () => {
    const STAGED = 'E:/world/.staging/castables'
    const s = (rel) => toStagedFile(STAGED, rel)

    it('writes a staged file back to its own path when nothing changes', () => {
      const sel = s('animist/x.xml')
      const r = resolveSavePath(LIB, 'castables', sel, 'x.xml', 'animist', STAGED)
      expect(r.newPath).toBe(sel.path)
      expect(r.isRename).toBe(false)
      expect(r.crossesRoot).toBe(false)
      expect(r.file).toEqual(sel)
    })

    it('renames a staged file inside staging, not into the live tree', () => {
      const sel = s('animist/x.xml')
      const r = resolveSavePath(LIB, 'castables', sel, 'y.xml', 'animist', STAGED)
      expect(r.newPath).toBe(`${STAGED}/animist/y.xml`)
      expect(r.newRel).toBe('animist/y.xml')
      expect(r.isRename).toBe(true)
      expect(r.crossesRoot).toBe(false)
      expect(r.file).toEqual(s('animist/y.xml'))
    })

    it('moves a staged file to another folder inside staging', () => {
      const r = resolveSavePath(LIB, 'castables', s('animist/x.xml'), 'x.xml', 'wizard', STAGED)
      expect(r.newPath).toBe(`${STAGED}/wizard/x.xml`)
      expect(r.file.staged).toBe(true)
    })

    it('puts a new file into staging while the box is checked', () => {
      const r = resolveSavePath(LIB, 'castables', null, 'new.xml', 'animist', STAGED)
      expect(r.newPath).toBe(`${STAGED}/animist/new.xml`)
      expect(r.isRename).toBe(false)
      expect(r.crossesRoot).toBe(false)
      expect(r.file).toEqual(s('animist/new.xml'))
    })

    it('moves a live file into staging, at the same path inside the type', () => {
      const r = resolveSavePath(LIB, 'castables', f('animist/x.xml'), 'x.xml', 'animist', STAGED)
      expect(r.newPath).toBe(`${STAGED}/animist/x.xml`)
      expect(r.isRename).toBe(true)
      expect(r.crossesRoot).toBe(true)
      expect(r.file).toEqual(s('animist/x.xml'))
    })

    it('releases a staged file into the live tree when the box is cleared', () => {
      const r = resolveSavePath(LIB, 'castables', s('animist/x.xml'), 'x.xml', 'animist')
      expect(r.newPath).toBe(`${LIB}/castables/animist/x.xml`)
      expect(r.isRename).toBe(true)
      expect(r.crossesRoot).toBe(true)
      expect(r.file.staged).toBe(false)
    })

    it('keeps an archived file in the archive, box or not', () => {
      const sel = a('.ignore/universal/x.xml')
      const r = resolveSavePath(LIB, 'castables', sel, 'x.xml', 'universal', STAGED)
      expect(r.newPath).toBe(sel.path)
      expect(r.crossesRoot).toBe(false)
      expect(r.file.archived).toBe(true)
    })
  })
})

describe('toStagedFile', () => {
  it('is a section file marked staged, under the staging dir', () => {
    expect(toStagedFile('E:/world/.staging/castables', 'animist/x.xml')).toEqual({
      rel: 'animist/x.xml',
      treePath: 'animist/x.xml',
      name: 'x.xml',
      path: 'E:/world/.staging/castables/animist/x.xml',
      dir: 'E:/world/.staging/castables',
      archived: false,
      staged: true
    })
  })
})

// HTOO-628: the page toolbar's item actions follow the selection.
describe('selectionActions', () => {
  const live = toSectionFile('E:/w/xml/items', 'a.xml', false)
  const live2 = toSectionFile('E:/w/xml/items', 'b.xml', false)
  const arch = toSectionFile('E:/w/xml/items', '.ignore/c.xml', true)
  const staged = toStagedFile('E:/w/.staging/items', 'd.xml')

  it('names each set', () => {
    expect([live, arch, staged].map(fileSet)).toEqual(['active', 'archived', 'staged'])
  })

  it('enables nothing but its defaults with no selection', () => {
    const a = selectionActions([])
    expect(a.archive).toEqual({ kind: 'archive', label: 'Archive', enabled: false })
    expect(a.move).toEqual({ kind: 'stage', label: 'Stage', enabled: false })
    expect(a.copy.enabled).toBe(false)
    expect(a.delete.enabled).toBe(false)
  })

  it('offers Archive and Stage for live files', () => {
    const a = selectionActions([live, live2])
    expect(a.archive).toEqual({ kind: 'archive', label: 'Archive', enabled: true })
    expect(a.move).toEqual({ kind: 'stage', label: 'Stage', enabled: true })
    expect(a.copy.enabled).toBe(false)
    expect(a.delete.enabled).toBe(true)
  })

  it('offers Unarchive, and no Stage, for archived files', () => {
    const a = selectionActions([arch])
    expect(a.archive).toEqual({ kind: 'unarchive', label: 'Unarchive', enabled: true })
    expect(a.move.enabled).toBe(false)
    expect(a.copy.enabled).toBe(true)
  })

  it('offers Release, and no Archive, for staged files', () => {
    const a = selectionActions([staged])
    expect(a.move).toEqual({ kind: 'release', label: 'Release', enabled: true })
    expect(a.archive.enabled).toBe(false)
  })

  it('enables only Delete for a selection across sets', () => {
    const a = selectionActions([live, staged])
    expect(a.archive.enabled).toBe(false)
    expect(a.move.enabled).toBe(false)
    expect(a.copy.enabled).toBe(false)
    expect(a.delete.enabled).toBe(true)
  })
})

describe('buildListRows', () => {
  const act = [f('a.xml'), f('animist/b.xml')]
  const stg = [toStagedFile('E:/w/.staging/castables', 'animist/c.xml')]
  const sections = (keys) =>
    [
      { key: 'active', label: 'Active', files: act },
      { key: 'staged', label: 'Staged', files: stg }
    ].filter((sec) => keys.includes(sec.key))

  it('shows one set with no header, as the tabs did', () => {
    const { rows } = buildListRows({
      sections: sections(['active']),
      folderMode: false,
      expanded: new Set(),
      expandAll: false
    })
    expect(rows.map((r) => r.kind)).toEqual(['file', 'file'])
  })

  it('puts a header with a count before each set when two or more show', () => {
    const { rows } = buildListRows({
      sections: sections(['active', 'staged']),
      folderMode: false,
      expanded: new Set(),
      expandAll: false
    })
    expect(rows.map((r) => (r.kind === 'section' ? `${r.name}:${r.count}` : r.kind))).toEqual([
      'Active:2',
      'file',
      'file',
      'Staged:1',
      'file'
    ])
  })

  it('keeps each set’s folders apart, so a folder opens in one set only', () => {
    const { rows, folderKeys } = buildListRows({
      sections: sections(['active', 'staged']),
      folderMode: true,
      expanded: new Set(['staged:animist']),
      expandAll: false
    })
    expect(folderKeys).toEqual(['active:animist', 'staged:animist'])
    const open = rows.filter((r) => r.kind === 'folder').map((r) => `${r.key}:${r.open}`)
    expect(open).toEqual(['active:animist:false', 'staged:animist:true'])
  })

  it('gives a header row its own height', () => {
    const rows = [{ kind: 'section' }, { kind: 'folder' }, { kind: 'file' }]
    const height = rowHeightFor(rows)
    expect([height(0), height(1), height(2)]).toEqual([SECTION_HEIGHT, FOLDER_HEIGHT, ITEM_HEIGHT])
  })
})

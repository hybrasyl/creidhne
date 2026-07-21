import { describe, it, expect } from 'vitest'
import {
  stripXml,
  toSectionFile,
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
      archived: false
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

  // ── No folder argument: the pre-picker behaviour, unchanged ──

  it('puts a new file at the type root', () => {
    expect(resolveSavePath(LIB, 'castables', null, 'new.xml')).toEqual({
      newPath: `${LIB}/castables/new.xml`,
      newRel: 'new.xml',
      isRename: false
    })
  })

  it('keeps a renamed file in its subfolder', () => {
    const sel = f('universal/old.xml')
    expect(resolveSavePath(LIB, 'castables', sel, 'new.xml')).toEqual({
      newPath: `${LIB}/castables/universal/new.xml`,
      newRel: 'universal/new.xml',
      isRename: true
    })
  })

  it('renames a type-root file without inventing a folder', () => {
    const sel = f('old.xml')
    expect(resolveSavePath(LIB, 'castables', sel, 'new.xml')).toEqual({
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
    expect(resolveSavePath(LIB, 'castables', null, 'new.xml', 'universal')).toEqual({
      newPath: `${LIB}/castables/universal/new.xml`,
      newRel: 'universal/new.xml',
      isRename: false
    })
  })

  it('moves a file to another folder without renaming it', () => {
    const sel = f('universal/x.xml')
    expect(resolveSavePath(LIB, 'castables', sel, 'x.xml', 'deep')).toEqual({
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
})

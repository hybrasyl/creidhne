import { execFile } from 'child_process'
import { existsSync, realpathSync, statSync } from 'fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'path'
import { buildIndex, buildSection, saveIndex, saveSection } from '@eriscorp/hybindex-ts'
import { STAGING_DIR, STAGING_FOLDER_TYPES, stagedEntry } from '../../shared/staging.js'

/**
 * The world an agent command works on (WP8): its root, the live library
 * (`<root>/xml`), the staging root (`<root>/.staging`), and the two indexes,
 * built on first use.
 *
 * The live index is the GUI's: the same incremental build and the same cache
 * under %LOCALAPPDATA%\Erisco\hybindex, saved after each build, as the index
 * worker does. The staged index is Creidhne's own and is never saved
 * (HTOO-453).
 */

/** A refusal the agent can act on. The CLI prints its message with no stack. */
export class AgentError extends Error {}

/** The git work tree that holds `dir`, or `dir` itself outside git. */
export function gitTop(dir) {
  return new Promise((done) =>
    execFile('git', ['rev-parse', '--show-toplevel'], { cwd: dir }, (err, out) =>
      done(err ? dir : resolve(out.trim()))
    )
  )
}

const isDir = (p) => {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

/** A path as the world names it: relative to the root, forward slashes. */
export function worldRel(ctx, p) {
  return relative(ctx.root, p).split(sep).join('/')
}

/** A path the agent gave: absolute, or relative to the world root. */
export function worldPath(ctx, p) {
  return isAbsolute(p) ? resolve(p) : resolve(ctx.root, p)
}

/**
 * The guard on every write: the real path must be inside the real world root,
 * so a junction or a symlink below the world cannot lead a write out of it. A
 * path that does not exist yet (a move's destination) is checked by its
 * nearest folder that does.
 */
export function guardWrite(ctx, p) {
  let probe = resolve(p)
  while (!existsSync(probe)) {
    const up = dirname(probe)
    if (up === probe) break
    probe = up
  }
  const real = realpathSync.native(probe)
  const rel = relative(ctx.realRoot, real)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new AgentError(`Refused: ${p} is outside the world`)
  }
  return p
}

/**
 * Where a file sits: `{ side, type, rel }`, where side is "live", "archived"
 * or "staged", type is the section folder, and rel is the path in it. Null for
 * a file outside `xml/<type>/` and `.staging/<type>/`.
 */
export function fileSide(ctx, abs) {
  const tryUnder = (base, side) => {
    const rel = relative(base, abs)
    if (rel.startsWith('..') || isAbsolute(rel)) return null
    const [type, ...rest] = rel.split(sep)
    if (!rest.length) return null
    const inType = rest.join('/')
    const archived = side === 'live' && rest.includes('.ignore')
    return { side: archived ? 'archived' : side, type, rel: inType }
  }
  return tryUnder(ctx.lib, 'live') ?? tryUnder(ctx.staging, 'staged')
}

/**
 * Open the world at `root`. It must hold `xml/`. The indexes are built on
 * first use: `await ctx.index()` and `await ctx.staged()`.
 */
export function openWorld(root) {
  const lib = join(root, 'xml')
  if (!isDir(lib)) {
    throw new AgentError(`${root} is not a world: it has no xml/ folder (pass --root <world>)`)
  }
  let live = null
  let staged = null
  const ctx = {
    root,
    realRoot: realpathSync.native(root),
    lib,
    staging: join(root, STAGING_DIR),
    index: () =>
      (live ??= buildIndex(lib).then(async (index) => {
        await saveIndex(lib, index)
        return index
      })),
    staged: () => (staged ??= buildStagedIndex(join(root, STAGING_DIR))),
    /** After a write: rebuild and save the live sections it touched (HTOO-372). */
    async refresh(types) {
      for (const type of new Set(types)) {
        const { fields } = await buildSection(lib, type)
        await saveSection(lib, type, fields)
      }
      live = null
      staged = null
    }
  }
  return ctx
}

async function buildStagedIndex(stagingRoot) {
  const out = {}
  for (const type of STAGING_FOLDER_TYPES) {
    if (!isDir(join(stagingRoot, type))) continue
    const { fields } = await buildSection(stagingRoot, type)
    out[type] = stagedEntry(type, fields)
  }
  return out
}

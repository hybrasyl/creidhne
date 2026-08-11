import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import { readFileSync, existsSync, statSync } from 'fs'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

/**
 * HTOO-145. Every path `electron-builder.yml` points at must be tracked by git.
 *
 * **The 1.10.0 release nearly failed on an uncommitted `build/portable-splash.bmp`.**
 * That is the whole failure class: `build/` is gitignored except for an explicit
 * allowlist, so a build input added there works perfectly on the author's machine and
 * does not exist on the runner. Nothing notices until a tag is pushed, because a tag
 * push is the only thing that packages — and by then the release is half-cut.
 *
 * This branch adds `build/icons/` to that set, which is exactly why the guard belongs
 * with it rather than after it.
 *
 * The rule is deliberately about existence-on-disk rather than a list of keys. An
 * enumerated key list (`win.icon`, `mac.entitlements`, `portable.splashImage`, …) goes
 * stale the moment someone adds a target, and going stale is silent. "Every scalar in
 * this file that names a real path" needs no maintenance and cannot miss a new key.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = join(repoRoot, 'electron-builder.yml')

/**
 * Scalars from the YAML that name a path present on disk.
 *
 * A hand-rolled scan rather than a YAML parser: `js-yaml` is only a transitive
 * dependency here, and a guard that breaks when someone else's dependency tree moves
 * is a guard that gets deleted. This reads `key: value` and `- value`, which is every
 * shape the file uses.
 *
 * Skipped on purpose:
 *   - anything holding `${…}`, which is an artifactName macro rather than a path;
 *   - anything with a glob character, since `files:`/`asarUnpack:` patterns are
 *     matched at build time and a pattern is not a path;
 *   - values that name nothing on disk, which are plain strings (`portable`, `x64`,
 *     `public.app-category.developer-tools`).
 */
function referencedPaths() {
  const found = new Set()
  for (const raw of readFileSync(CONFIG, 'utf8').split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '')
    const m = /^\s*(?:[\w-]+:\s*|-\s+)(\S.*?)\s*$/.exec(line)
    if (!m) continue
    const value = m[1].replace(/^['"]|['"]$/g, '')
    if (!value || value.includes('${') || /[*?]/.test(value)) continue
    if (!value.includes('/')) continue
    if (!existsSync(join(repoRoot, value))) continue
    found.add(value)
  }
  return [...found].sort()
}

/** Paths git knows about under `p`, whether `p` is a file or a directory. */
function trackedUnder(p) {
  const out = execFileSync('git', ['ls-files', '-z', '--', p], {
    cwd: repoRoot,
    encoding: 'utf8'
  })
  return out.split('\0').filter(Boolean)
}

describe('electron-builder.yml build inputs', () => {
  it('finds the paths it is supposed to be checking', () => {
    // Guards the guard. If the scan ever returns nothing — a syntax change, a regex
    // that stops matching — every assertion below passes vacuously and the check is
    // silently gone, which is the same silent-failure shape it exists to prevent.
    const paths = referencedPaths()
    expect(paths.length, 'the scan found no paths at all — it has stopped working').toBeGreaterThan(
      3
    )
    // The two the 1.10.0 near-miss and this branch are about.
    expect(paths).toContain('build/portable-splash.bmp')
    expect(paths).toContain('build/icons')
  })

  it('has every referenced path tracked by git', () => {
    const untracked = []
    for (const p of referencedPaths()) {
      const files = trackedUnder(p)
      if (files.length === 0) {
        untracked.push(p)
        continue
      }
      // A directory that exists but holds untracked files is the same fault one level
      // down: `linux.icon: build/icons` with three of eight sizes committed builds a
      // .deb with three icon sizes and no error.
      if (statSync(join(repoRoot, p)).isDirectory()) {
        const onDisk = trackedUnder(p).length
        const status = execFileSync('git', ['status', '--porcelain', '--', p], {
          cwd: repoRoot,
          encoding: 'utf8'
        })
        const stray = status
          .split(/\r?\n/)
          .filter((l) => l.startsWith('?? '))
          .map((l) => l.slice(3).trim())
        if (stray.length) untracked.push(...stray.map((s) => relative('.', s)))
        expect(onDisk, `${p} is tracked but empty`).toBeGreaterThan(0)
      }
    }
    expect(
      untracked,
      'electron-builder.yml references these, and a release runner will not have them'
    ).toEqual([])
  })
})

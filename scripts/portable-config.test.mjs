import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

// The `portable:` block in electron-builder.yml, pinned because both of its
// decisions look wrong to a reader who has not read the comment above them, and
// nothing else in the repository exercises either.
//
// - No `splashImage` (HTOO-466). The image puts the NSIS stub in GUI mode, which
//   flashes a blank "Setup" window after every close. Creidhne removed the image
//   with this test, so this test is what stops one being added again.
// - `unpackDirName: true` (HTOO-351, fault 2). The electron-builder docs say
//   `false`, and `false` silently restores the build-time unpack directory that
//   shows the "Creidhne cannot be closed" box on a second launch.
//
// Both land on the PACKAGED exe only, so this checks the REQUEST and not the
// artifact.

const REPO_ROOT = join(import.meta.dirname, '..')
const YML = readFileSync(join(REPO_ROOT, 'electron-builder.yml'), 'utf8').replace(/\r\n/g, '\n')

/**
 * The keys of the top-level `portable:` block, comments excluded. The block ends
 * at the next column-0 key, so a key in another block cannot satisfy it.
 *
 * It takes the text so the same reader can be run over a block that HAS the key.
 * A test for an absence passes for the wrong reason as easily as the right one.
 */
function portableKeys(text = YML) {
  const lines = text.split('\n')
  const start = lines.indexOf('portable:')
  expect(start, 'the text has no top-level portable: block').toBeGreaterThan(-1)
  const keys = {}
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break
    const found = /^ {2}([A-Za-z]+):\s*(.*?)\s*$/.exec(line)
    if (found) keys[found[1]] = found[2]
  }
  return keys
}

describe('the portable target', () => {
  it('has no splash image, so the NSIS stub stays silent (HTOO-466)', () => {
    expect(portableKeys()).not.toHaveProperty('splashImage')
  })

  it('extracts to a directory unique to each launch (HTOO-351)', () => {
    // `true`, not the documented `false`: app-builder-lib gives `false` a
    // build-time KSUID, which is the collision this avoids.
    expect(portableKeys().unpackDirName).toBe('true')
  })

  it('reads the block it means to read', () => {
    // A reader that found nothing would pass the case above vacuously.
    expect(portableKeys()).toHaveProperty('artifactName')
  })

  it('sees a splash image when there is one, so the rule above can fail', () => {
    const withImage = [
      'win:',
      '  target: portable',
      'portable:',
      '  artifactName: x',
      '  splashImage: build/portable-splash.bmp',
      'mac:',
      '  category: public.app-category.developer-tools'
    ].join('\n')
    expect(portableKeys(withImage)).toHaveProperty('splashImage')
  })

  it('stops at the next block, so another block cannot satisfy it', () => {
    const elsewhere = ['portable:', '  artifactName: x', 'nsis:', '  splashImage: no'].join('\n')
    expect(portableKeys(elsewhere)).not.toHaveProperty('splashImage')
  })

  it('says why the image is absent, for the next person to want one', () => {
    expect(YML).toMatch(/NO `splashImage`, on purpose \(HTOO-466\)/)
  })
})

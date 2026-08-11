// Read the Electron fuse wire back out of a PACKAGED binary and fail if the
// fuses electron-builder.yml configures are not what it asked for.
//
// Why this exists rather than a manual procedure (HTOO-374): fuses are burned
// into the packaged binary and nothing else in the repository can see them.
// `npm run lint:check && npm test && npm run build` all pass on a build that has
// silently stopped applying them, and so does the whole e2e suite, because
// Playwright drives `out/` and not a packaged artifact. The failure is silent by
// construction, which is the argument for automating it rather than against.
//
// `runAsNode: false` is the one that matters most: without it,
// `ELECTRON_RUN_AS_NODE=1 creidhne.exe -e "<script>"` turns the shipped, signed
// binary into a general-purpose Node interpreter — a real capability handed to
// anything that can set an environment variable.
//
// Ported from Taliesin's implementation (HTOO-167), which is the reference the
// card asks for. Copied rather than re-derived because of the first trap below.
//
// THREE THINGS THIS DELIBERATELY DOES NOT DO:
//
//  * It does not use `getCurrentFuseWire` from `@electron/fuses`, and the reason
//    is a real defect rather than a preference. That function reads the FIRST
//    sentinel only. A mac universal binary has two — `flipFuses` writes both,
//    and its own comment says so — so the public reader would check one slice
//    and report a pass while the other went unread. A verifier that cannot see
//    half the artifact it is verifying is worse than none, because it reads as
//    coverage. This scans EVERY sentinel and asserts each one. That is a live
//    need here, not insurance: `electron-builder.yml` builds the dmg for
//    `arch: universal`, so Creidhne's mac artifact carries two wires and the
//    public reader would check one of them.
//
//  * It does not assert `resetAdHocDarwinSignature`. The card asks for it to be
//    skipped off macOS, but the premise is wrong in a more basic way: it is not
//    a fuse. It does not appear in `FuseV1Options` and is never written to the
//    wire — it tells electron-builder to re-sign after flipping, which is a
//    build behaviour with no trace in the artifact. `verify-fuses.test.mjs`
//    asserts the config still asks for it, which is the only place it is visible.
//
//  * It does not launch anything. The behavioural half — that
//    `ELECTRON_RUN_AS_NODE=1 creidhne.exe -e "…"` cannot execute a marker — stays
//    a manual procedure. Automating it means launching a GUI application on a
//    runner and deciding it "has not printed anything yet", which is a timing
//    assumption about someone else's binary on a displayless box that nobody
//    here has measured.
//
// Usage: node scripts/verify-fuses.mjs <path to packaged binary>
//   win32   dist/win-unpacked/creidhne.exe
//   linux   dist/linux-unpacked/creidhne
//   darwin  dist/mac-universal/Creidhne.app

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

// Copied from @electron/fuses' `dist/constants.js`, which is an INTERNAL path
// the package does not export. verify-fuses.test.mjs pins both against that
// file, so an upgrade that moves either fails the suite rather than making this
// script find zero sentinels in a healthy binary.
export const SENTINEL = 'dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'
export const FUSE_STATE = { DISABLE: 0x30, ENABLE: 0x31, REMOVED: 0x72, INHERIT: 0x90 }

// Position on the V1 wire → name. The full list is longer; these are the four
// electron-builder.yml sets that reach the wire, and the only four asserted.
// Position matters more than the name does — the wire is an array of bytes and
// nothing in it is labelled.
export const EXPECTED = [
  { index: 0, name: 'RunAsNode', state: FUSE_STATE.DISABLE },
  { index: 2, name: 'EnableNodeOptionsEnvironmentVariable', state: FUSE_STATE.DISABLE },
  { index: 3, name: 'EnableNodeCliInspectArguments', state: FUSE_STATE.DISABLE },
  { index: 5, name: 'OnlyLoadAppFromAsar', state: FUSE_STATE.ENABLE }
]

const STATE_NAME = Object.fromEntries(Object.entries(FUSE_STATE).map(([k, v]) => [v, k]))

// A .app is a directory; the wire lives in the framework binary inside it. Same
// resolution @electron/fuses does, because electron-builder hands it the .app
// path and this has to read what that wrote.
export function fuseFilePath(target) {
  if (target.endsWith('.app')) {
    return resolve(
      target,
      'Contents',
      'Frameworks',
      'Electron Framework.framework',
      'Electron Framework'
    )
  }
  return target
}

// Every sentinel in the buffer, decoded. Exported so the test can drive it with
// synthetic buffers — a real artifact is ~200 MB and does not exist on a machine
// that has not packaged one.
export function decodeFuseWires(buffer) {
  const wires = []
  const needle = Buffer.from(SENTINEL, 'utf8')
  let at = buffer.indexOf(needle)
  while (at !== -1) {
    const pos = at + needle.length
    const version = buffer[pos]
    const length = buffer[pos + 1]
    wires.push({
      offset: at,
      version,
      states: Array.from(buffer.subarray(pos + 2, pos + 2 + length))
    })
    at = buffer.indexOf(needle, at + needle.length)
  }
  return wires
}

// Pure: wires in, list of human sentences out. Empty means the artifact passed.
//
// **Zero wires is a FAILURE, not an empty pass.** That is the property that
// makes this check self-checking: a stale SENTINEL, a truncated read or a path
// pointing at the wrong file all land here rather than reporting success over
// nothing.
export function checkWires(wires) {
  if (wires.length === 0) {
    return ['no fuse wire found — not an Electron binary, or the sentinel has moved']
  }
  const problems = []
  for (const wire of wires) {
    const where = wires.length > 1 ? ` (slice at offset ${wire.offset})` : ''
    if (wire.version !== 1) {
      problems.push(`fuse wire version ${wire.version}, expected 1${where}`)
      continue
    }
    for (const fuse of EXPECTED) {
      const actual = wire.states[fuse.index]
      if (actual === fuse.state) continue
      const found =
        actual === undefined
          ? 'off the end of the wire'
          : (STATE_NAME[actual] ?? `0x${actual.toString(16)}`)
      problems.push(`${fuse.name} is ${found}, expected ${STATE_NAME[fuse.state]}${where}`)
    }
  }
  return problems
}

function main(argv) {
  const target = argv[2]
  if (!target) {
    console.error('usage: node scripts/verify-fuses.mjs <path to packaged binary>')
    return 2
  }

  let buffer
  try {
    buffer = readFileSync(fuseFilePath(target))
  } catch (err) {
    console.error(`cannot read ${fuseFilePath(target)}: ${err.message}`)
    return 2
  }

  const wires = decodeFuseWires(buffer)
  const problems = checkWires(wires)

  // Print what was read either way. A green check that prints nothing teaches
  // nobody what it looked at, and this is the only place the wire is visible.
  for (const wire of wires) {
    const read = EXPECTED.map((f) => `${f.name}=${STATE_NAME[wire.states[f.index]] ?? '?'}`).join(
      ' '
    )
    console.log(`${target} @${wire.offset}: v${wire.version} ${read}`)
  }

  if (problems.length > 0) {
    console.error(`\nElectron fuses are wrong on ${target}:`)
    for (const p of problems) console.error(`  - ${p}`)
    return 1
  }
  console.log(
    `\nElectron fuses OK on ${target} (${wires.length} wire${wires.length === 1 ? '' : 's'}).`
  )
  return 0
}

// CLI — skipped when imported (e.g. by the test).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv))
}

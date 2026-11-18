import { readFileSync } from 'fs'
import { join } from 'path'
import { expect, it } from 'vitest'

// The macOS entitlements of the signed app and every helper
// (electron-builder.yml mac.entitlements and entitlementsInherit), pinned because
// a key added here changes nothing that any test or any local build can see:
// only a signed, notarized build applies them (HTOO-650).
//
// The three keys are electron-builder's own default
// (app-builder-lib/templates/entitlements.mac.plist). allow-dyld-environment-variables
// is not one of them. With disable-library-validation it let
// DYLD_INSERT_LIBRARIES load unsigned code into the shipped binary: the "set an
// environment variable, get code execution" route that the runAsNode fuse exists
// to close. Without the DYLD key, the hardened runtime ignores DYLD_* variables.

const plist = readFileSync(
  join(import.meta.dirname, '..', 'build', 'entitlements.mac.plist'),
  'utf8'
)
const keys = [...plist.matchAll(/<key>([^<]+)<\/key>\s*<true\/>/g)].map((m) => m[1])

it('grants only the three keys of electron-builder’s default', () => {
  expect(keys.sort()).toEqual([
    'com.apple.security.cs.allow-jit',
    'com.apple.security.cs.allow-unsigned-executable-memory',
    'com.apple.security.cs.disable-library-validation'
  ])
})

it('does not grant DYLD environment variables (HTOO-650)', () => {
  expect(plist).not.toContain('allow-dyld-environment-variables')
})

#!/usr/bin/env node
// house module: update-check v1 — change it in the template, then port
//
// Publish this app's new version to the house version manifest
// (hybrasyl/cernunnos: versions.json). Run by the developer who releases, AFTER
// the release job has published the GitHub Release:
//
//   npm run publish:version -- vX.Y.Z            (add --dry-run to see the change only)
//
// It is an ordinary commit and push from a sibling checkout (../cernunnos), with
// the developer's own git access. No token and no CI step (Sabrael, 2026-09-28).
// If it ever fails for a reason other than the checks below, the design is wrong
// and needs rethinking; do not add retries around it.
//
// Design: Comhaigne docs/architecture/update-check-module.md, §4.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const STRICT = /^(\d+)\.(\d+)\.(\d+)$/

/** `vX.Y.Z` → `X.Y.Z`, or null for anything else (pre-releases included). */
export function parseTag(tag) {
  const m = /^v(\d+\.\d+\.\d+)$/.exec(tag ?? '')
  return m ? m[1] : null
}

/** True only when `b` is strictly newer than `a`. Same rule as
 *  src/shared/updateVersion.ts; the test pins the two together. */
export function isNewer(a, b) {
  const x = STRICT.exec(a)
  const y = STRICT.exec(b)
  if (!x || !y) return false
  for (let i = 1; i <= 3; i++) {
    if (Number(y[i]) !== Number(x[i])) return Number(y[i]) > Number(x[i])
  }
  return false
}

/** The `updateKey` from src/shared/appIdentity.(ts|js). */
export function readUpdateKey(source) {
  const m = /updateKey:\s*['"]([a-z0-9-]+)['"]/.exec(source)
  if (!m) throw new Error('appIdentity has no updateKey')
  return m[1]
}

/**
 * The manifest text with this app's entry set. Every other key is kept exactly
 * as read, keys are sorted, 2-space indent, final newline: one app's change is
 * one small diff. Throws when the file already has this version or a newer one.
 */
export function updateManifest(text, key, entry) {
  const data = JSON.parse(text)
  if (data.schema !== 1 || !data.apps || typeof data.apps !== 'object') {
    throw new Error('versions.json is not schema 1')
  }
  const current = data.apps[key]?.version
  if (current && !isNewer(current, entry.version)) {
    throw new Error(`versions.json already has ${key} ${current}; ${entry.version} is not newer`)
  }
  const apps = { ...data.apps, [key]: entry }
  const sorted = Object.fromEntries(
    Object.keys(apps)
      .sort()
      .map((k) => [k, apps[k]])
  )
  return JSON.stringify({ ...data, apps: sorted }, null, 2) + '\n'
}

/** `git <args>` in `cwd`: the only thing in `publish()` that starts a process. */
export function realGit(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

/** The published GitHub Release for `tag`, through the developer's `gh`. */
function releaseFromGh(tag, repoRoot) {
  const out = execFileSync(
    'gh',
    ['release', 'view', tag, '--json', 'tagName,url,publishedAt,isDraft,isPrerelease'],
    { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  )
  return JSON.parse(out)
}

/**
 * The whole step. `release` and `git` are injected, so the test drives it with
 * a fake release and a fake git: no `gh`, no network and no git process.
 */
export function publish({
  tag,
  repoRoot,
  cernunnos,
  dryRun = false,
  release = releaseFromGh,
  git = realGit,
  log = console.log
}) {
  const version = parseTag(tag)
  if (!version) throw new Error(`${tag} is not a stable release tag (vX.Y.Z)`)

  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
  if (pkg.version !== version) {
    throw new Error(`${tag} does not match package.json version ${pkg.version}`)
  }
  const identity = ['src/shared/appIdentity.ts', 'src/shared/appIdentity.js']
    .map((f) => join(repoRoot, f))
    .find((f) => existsSync(f))
  if (!identity) throw new Error('no src/shared/appIdentity.(ts|js)')
  const key = readUpdateKey(readFileSync(identity, 'utf8'))

  // 1. The GitHub Release must exist and be published. Then the manifest cannot
  //    name a version whose release job failed.
  const rel = release(tag, repoRoot)
  if (rel.isDraft || rel.isPrerelease || rel.tagName !== tag) {
    throw new Error(`the GitHub Release ${tag} is not published as a stable release`)
  }

  // 2. The cernunnos checkout must be ready.
  if (!existsSync(join(cernunnos, '.git'))) throw new Error(`no git checkout at ${cernunnos}`)
  const branch = git(cernunnos, 'rev-parse', '--abbrev-ref', 'HEAD')
  if (branch !== 'main') throw new Error(`${cernunnos} is on ${branch}, not main`)
  if (git(cernunnos, 'status', '--porcelain') !== '') {
    throw new Error(`${cernunnos} has uncommitted changes; they are someone else's, so stop`)
  }
  git(cernunnos, 'pull', '--ff-only', '--quiet')

  // 3 + 4. Never go backwards; change this app's key only.
  const file = join(cernunnos, 'versions.json')
  const entry = { version, released: rel.publishedAt, url: rel.url }
  const next = updateManifest(readFileSync(file, 'utf8'), key, entry)

  if (dryRun) {
    log(next)
    log(`dry run: would commit "versions: ${key} ${version}" in ${cernunnos}`)
    return { key, version, pushed: false }
  }

  // 5. Commit only that file, and push.
  writeFileSync(file, next)
  git(cernunnos, 'commit', '--quiet', '-m', `versions: ${key} ${version}`, '--', 'versions.json')
  try {
    git(cernunnos, 'push', '--quiet')
  } catch {
    // 6. Someone pushed first. Each app changes only its own lines, so a rebase
    //    does not conflict. Once; a second failure means the design is wrong.
    git(cernunnos, 'pull', '--rebase', '--quiet')
    git(cernunnos, 'push', '--quiet')
  }
  log(`published ${key} ${version} to versions.json`)
  return { key, version, pushed: true }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const tag = args.find((a) => !a.startsWith('--'))
  const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..')
  try {
    publish({
      tag,
      repoRoot,
      cernunnos: resolve(repoRoot, '..', 'cernunnos'),
      dryRun: args.includes('--dry-run')
    })
  } catch (e) {
    console.error(`publish-version: ${e.message}`)
    process.exit(1)
  }
}

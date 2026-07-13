#!/usr/bin/env node
// Extract one version's section from CHANGELOG.md for the release workflow.
//
// Usage: node scripts/changelog-extract.mjs <version|tag>
//   node scripts/changelog-extract.mjs v1.2.0   -> body of `## [1.2.0] - …`
//   node scripts/changelog-extract.mjs 1.2.0    -> same (leading `v` optional)
//   node scripts/changelog-extract.mjs Unreleased
//
// Prints the section body (heading excluded) to stdout. If the section is
// missing it prints nothing and exits 0 — the release workflow still runs
// generate_release_notes, so a missing entry degrades to the auto PR list
// rather than failing the release.

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Pull the body under `## [<version>] …` up to the next `## ` heading (or EOF).
// Exported for the unit test; the CLI wrapper below calls it.
export function extractSection(changelog, version) {
  const wanted = String(version).replace(/^v/, '').trim()
  const lines = changelog.split(/\r?\n/)
  const isVersionHeading = (line) => /^##\s+\[([^\]]+)\]/.exec(line)

  let start = -1
  for (let i = 0; i < lines.length; i++) {
    const m = isVersionHeading(lines[i])
    if (m && m[1].trim().toLowerCase() === wanted.toLowerCase()) {
      start = i + 1
      break
    }
  }
  if (start === -1) return ''

  const body = []
  for (let i = start; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break // next section heading
    body.push(lines[i])
  }
  return body.join('\n').trim()
}

// CLI — skipped when imported (e.g. by the test).
const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const version = process.argv[2]
  if (!version) {
    console.error('usage: changelog-extract.mjs <version|tag>')
    process.exit(2)
  }
  const changelogPath = join(dirname(dirname(fileURLToPath(import.meta.url))), 'CHANGELOG.md')
  const section = extractSection(readFileSync(changelogPath, 'utf-8'), version)
  if (!section) {
    console.error(`changelog-extract: no section for "${version}" — release will use auto notes`)
  }
  process.stdout.write(section ? section + '\n' : '')
}

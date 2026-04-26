// Validate one or more XML files against the bundled Hybrasyl XSD collection.
// Useful when investigating whether a schema error is real upstream drift,
// a serializer regression, or fixture quality. See docs/xsd-validation.md.
//
// Usage:
//   node scripts/validate-xml.mjs <path-to-xml> [<path-to-xml> ...]
//   node scripts/validate-xml.mjs                # validates every fixture
//
// Exits non-zero if any file fails validation.

import { readFile, readdir } from 'fs/promises'
import { basename, join } from 'path'
import { validateHybrasylXml } from '../src/main/__tests__/xsdValidator.js'

const FIXTURE_DIR = join(process.cwd(), 'src', 'main', '__tests__', 'fixtures', 'xml')

async function collectFixtures() {
  const types = await readdir(FIXTURE_DIR, { withFileTypes: true })
  const out = []
  for (const t of types.filter((d) => d.isDirectory())) {
    const dir = join(FIXTURE_DIR, t.name)
    const files = await readdir(dir)
    for (const f of files.filter((n) => n.endsWith('.xml'))) {
      out.push(join(dir, f))
    }
  }
  return out
}

async function validate(path) {
  const xml = await readFile(path, 'utf-8')
  const result = await validateHybrasylXml(xml, basename(path))
  return { path, valid: result.valid, errors: result.rawOutput?.trim() || '' }
}

const argv = process.argv.slice(2)
const paths = argv.length ? argv : await collectFixtures()

let failed = 0
for (const p of paths) {
  const { valid, errors } = await validate(p)
  if (valid) {
    console.log(`OK   ${p}`)
  } else {
    failed++
    console.log(`\nFAIL ${p}`)
    console.log(
      errors
        .split('\n')
        .map((l) => `     ${l}`)
        .join('\n')
    )
  }
}

if (failed) {
  console.log(`\n${failed} of ${paths.length} file(s) failed validation.`)
  process.exit(1)
}
console.log(`\nAll ${paths.length} file(s) validated.`)

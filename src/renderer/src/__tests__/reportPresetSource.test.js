import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { CASTABLE_EXPORT_PRESETS } from '../../../shared/castableExportPresets.js'

/**
 * WP2. The Reports page reads each built-in report's label and description from
 * the preset data. Before the `@shared` alias existed it could not, so the page
 * held a second copy of all six strings — and a second copy drifts.
 *
 * This asserts the source rather than the rendering, because the failure is
 * silent: a page with a stale label renders perfectly, and the only way to notice
 * is to compare two files nobody has a reason to open together. It is the same
 * fault the folder-picker and first-save audits both found (HTOO-159, HTOO-130).
 */

const rendererDir = join(dirname(fileURLToPath(import.meta.url)), '..')

function rendererSources() {
  return readdirSync(rendererDir, { recursive: true })
    .map((n) => String(n).replace(/\\/g, '/'))
    .filter((n) => n.endsWith('.jsx'))
    .map((rel) => ({ rel, src: readFileSync(join(rendererDir, rel), 'utf8') }))
}

describe('built-in report text has one source (WP2)', () => {
  it('finds the sources it is meant to be checking', () => {
    // Guards the guard, twice over: an empty walk, or a preset list that lost its
    // descriptions, would make the assertions below pass against nothing.
    const sources = rendererSources()
    expect(sources.length, 'the renderer walk found no .jsx files').toBeGreaterThan(50)
    expect(sources.map((s) => s.rel)).toContain('pages/ReportsPage.jsx')
    expect(CASTABLE_EXPORT_PRESETS).toHaveLength(3)
    for (const preset of CASTABLE_EXPORT_PRESETS) {
      expect(preset.label, preset.id).toBeTruthy()
      expect(preset.description?.length, preset.id).toBeGreaterThan(20)
    }
  })

  it('does not restate a preset description in the renderer', () => {
    // The label is a short word pair and could legitimately appear as UI text.
    // The description is a sentence, and a sentence in two files is a copy.
    const offenders = []
    for (const { rel, src } of rendererSources()) {
      for (const preset of CASTABLE_EXPORT_PRESETS) {
        if (src.includes(preset.description)) offenders.push(`${rel} restates ${preset.id}`)
      }
    }
    expect(offenders, 'the renderer should read these from the preset data').toEqual([])
  })

  it('reads the presets from the shared module', () => {
    const page = rendererSources().find((s) => s.rel === 'pages/ReportsPage.jsx')
    expect(page.src).toMatch(/import \{ CASTABLE_EXPORT_PRESETS \} from '@shared\//)
  })
})

import { describe, it, expect } from 'vitest'
import { themesByName } from '../index'
import { contrast } from '@renderer/lib/contrast'

// From the registry, so a new theme is covered unasked.
const THEME_NAMES = Object.keys(themesByName)

/**
 * `tertiary` is the nav bar under the title bar (HTOO-629): the template's
 * tertiary.test.ts, in JS. The two bars were one colour,
 * `secondary.main`, and read as one band. Every theme picks its own value
 * against two rules, with no exemption list:
 *
 *  - the bar's text and icons, `tertiary.contrastText`, are readable on it
 *    (4.5:1, the rule for normal text);
 *  - it differs from the title bar enough that the two read as two bars
 *    (1.4:1). Darkening the bar colour gives about 1.6:1 on the DA themes; the
 *    dark purple and the navy have no room below them, so those go lighter.
 *
 * The icons keep the title bar's text colour, so `contrastText` is
 * `secondary.contrastText`, and `navButtonSx` needs no change.
 */
describe('the tertiary colour (the nav bar)', () => {
  it('is defined for every theme (guard the guard)', () => {
    expect(THEME_NAMES.length).toBeGreaterThanOrEqual(6)
    for (const name of THEME_NAMES) {
      expect(themesByName[name].palette.tertiary?.main, name).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it.each(THEME_NAMES)('%s: its text is readable on it', (name) => {
    const { tertiary } = themesByName[name].palette
    expect(contrast(tertiary.contrastText, tertiary.main)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(THEME_NAMES)('%s: it reads as a second bar under the title bar', (name) => {
    const { tertiary, secondary } = themesByName[name].palette
    expect(contrast(tertiary.main, secondary.main)).toBeGreaterThanOrEqual(1.4)
  })

  it.each(THEME_NAMES)('%s: its icons are the title bar’s colour', (name) => {
    const { tertiary, secondary } = themesByName[name].palette
    expect(tertiary.contrastText).toBe(secondary.contrastText)
  })
})

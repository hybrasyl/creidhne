import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * The splash is a flex column, and a flex column absorbs overflow by squashing
 * whichever of its children CAN squash.
 *
 * Three of the four cannot: the logo is a replaced element and the two text
 * nodes have content, so each has an automatic minimum size. `.spinner` is an
 * empty div, so its automatic minimum is 0 and it therefore absorbed 100% of the
 * overflow by itself — a 32px circle rendering as a 32x27 oval that still spins,
 * which reads as a rendering fault rather than a layout one.
 *
 * It could not fail loudly. Every declaration in that stylesheet is correct read
 * on its own; the fault is a size the browser computed, so nothing in the source
 * is wrong to look at and no gate could go red. It is also platform-dependent,
 * which is worse: the content box is not the size the window asks for (a 420x300
 * frameless window measures 392x288 on a 1.5x Windows display) and the fallback
 * font used where 'Segoe UI' is absent has taller line boxes again. Measured at
 * 300px tall: 32x26.7 here, and 32x17.6 with a taller fallback font. So it was
 * first read as a Linux problem, then as a fault in the new CSP header — the
 * header makes no difference at all, which was confirmed by measuring the
 * document with it applied and with it absent.
 *
 * The guard therefore asserts the source, since the artifact is a computed
 * layout no unit test can see: nothing in the column may shrink.
 */

const ROOT = join(import.meta.dirname, '../../..')
const splashHtml = readFileSync(join(ROOT, 'resources/splash.html'), 'utf8')
const plateScript = readFileSync(join(ROOT, 'scripts/make-portable-splash.mjs'), 'utf8')

/** The body of a `.foo { … }` rule, or undefined when there is no such rule. */
function ruleBody(css, selector) {
  const m = css.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`))
  return m?.[1]
}

/** A numeric declaration inside a rule, e.g. `width` → 148. */
function declaration(css, selector, property) {
  const body = ruleBody(css, selector)
  if (body === undefined) return undefined
  const m = body.match(new RegExp(`(?:^|[;\\s])${property}\\s*:\\s*(-?[\\d.]+)px`))
  return m ? Number(m[1]) : undefined
}

/** Every class named on a direct child of `<body>`. Derived, never listed. */
function bodyChildClasses(html) {
  const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? ''
  return [...body.matchAll(/<\w+[^>]*\bclass="([^"]+)"/g)].flatMap((m) => m[1].trim().split(/\s+/))
}

describe('splash layout', () => {
  it('lays the body out as a flex column, or none of this applies', () => {
    // Guard the guard. Every assertion below is about flex behaviour; if the
    // splash stops being a flex column they are all vacuous, and a vacuous pass
    // is the same silence this test exists to break.
    const body = ruleBody(splashHtml, '')
    expect(splashHtml).toMatch(/body\s*\{[^}]*display:\s*flex/)
    expect(splashHtml).toMatch(/body\s*\{[^}]*flex-direction:\s*column/)
    expect(body).toBeUndefined() // sanity: `.` + '' must not match a real rule
  })

  it('finds the children it is about to check', () => {
    const classes = bodyChildClasses(splashHtml)
    expect(classes.length, 'no classed children found — the parse is wrong').toBeGreaterThan(2)
    expect(classes).toContain('spinner')
  })

  it('forbids every child of the column from shrinking', () => {
    // Derived from the markup rather than restated: a child added later without
    // `flex-shrink: 0` fails here instead of quietly becoming the next item that
    // absorbs the overflow.
    for (const cls of bodyChildClasses(splashHtml)) {
      const body = ruleBody(splashHtml, cls)
      expect(body, `.${cls} has no rule`).toBeDefined()
      expect(body, `.${cls} may shrink, and the column will squash it`).toMatch(/flex-shrink:\s*0/)
    }
  })

  it('declares the spinner square', () => {
    // The oval was a computed height against a declared one. Both are declared
    // equal, so any future oval is a shrink again and the test above catches it.
    expect(declaration(splashHtml, 'spinner', 'width')).toBe(
      declaration(splashHtml, 'spinner', 'height')
    )
    expect(declaration(splashHtml, 'spinner', 'width')).toBeGreaterThan(0)
  })

  it('keeps the portable extraction plate agreeing with the logo it copies', () => {
    // build/portable-splash.bmp is a frozen frame of this document, shown while
    // the portable exe extracts. The two are meant to read as one boot, so a
    // logo resized in the stylesheet and not in the generator produces a visible
    // jump — and the plate is a committed binary, so nothing else would notice.
    const plateLogo = Number(plateScript.match(/^const LOGO = (\d+)/m)?.[1])
    const plateMargin = Number(plateScript.match(/^const LOGO_MB = (\d+)/m)?.[1])
    expect(plateLogo, 'LOGO not found in make-portable-splash.mjs').toBeGreaterThan(0)
    expect(plateLogo).toBe(declaration(splashHtml, 'logo', 'width'))
    expect(plateMargin).toBe(declaration(splashHtml, 'logo', 'margin-bottom'))
  })
})

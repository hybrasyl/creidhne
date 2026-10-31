import { describe, it, expect } from 'vitest'
import { themesByName } from '../index'
import { filledControls } from '../filledControls'
import { blend, contrast, luminance } from '@renderer/lib/contrast'

// Derived from the registry rather than a hand-kept list, so a theme added to
// `themesByName` is covered without anyone remembering to add it here.
const THEME_NAMES = Object.keys(themesByName)

/**
 * Palette invariants. The template holds the canonical eight palettes and these
 * tests (HTOO-572); each app takes both, and keeps its own component overrides
 * only where its own tests say why.
 *
 * The Hybrasyl theme shipped with `primary.main` set to the same value as
 * `background.default` (`#0d182f`). Every control that signals its active state
 * through `color="primary"` therefore painted itself the colour of the page
 * behind it, and the affordance INVERTED: a filled Chip takes `primary.main` as
 * its background while an unselected one keeps MUI's default grey, so the
 * selected chip was the one that disappeared (HTOO-341). Five more themes then
 * failed the same contrast rules more quietly (HTOO-355). Every rule below runs
 * for EVERY theme, with no exemption list: a theme that fails needs a new value,
 * never a lower threshold.
 */

/** Each style object under `node` that sets `backgroundColor` to `main` and a
 *  `color` (#rrggbb), with its path in the overrides. */
function accentFills(node, main, path = []) {
  if (!node || typeof node !== 'object') return []
  const o = node
  const out = []
  if (
    typeof o.backgroundColor === 'string' &&
    o.backgroundColor.toLowerCase() === main.toLowerCase() &&
    typeof o.color === 'string' &&
    /^#[0-9a-f]{6}$/i.test(o.color)
  )
    out.push({ path: path.join(' > '), backgroundColor: o.backgroundColor, color: o.color })
  for (const [k, v] of Object.entries(o)) out.push(...accentFills(v, main, [...path, k]))
  return out
}

/**
 * The style of the theme's plain-chip variant: `{ color: 'default' }`, or with
 * `clickable` the hover variant. The tint is a variant, not a root rule, so a
 * chip's own sx colour beats it (HTOO-572).
 */
function plainChip(theme, clickable) {
  const variants = theme.components?.MuiChip?.variants ?? []
  return variants.find(
    (v) =>
      v.props.color === 'default' &&
      Boolean(v.props.clickable) === clickable &&
      Object.keys(v.props).length === (clickable ? 2 : 1)
  )?.style
}

/**
 * The surfaces that apps draw text on, each opaque: the page, paper over the
 * page, and paperDark over the page. paperDark is the panel and tooltip
 * surface (dagda's sidebar, midir's tooltips and log panel). danaan's text on
 * it fell below 4.5:1 while the page and paper passed (HTOO-572).
 */
function surfaces(p) {
  return [
    ['page', p.background.default],
    ['paper', blend(p.background.paper, p.background.default)],
    ['paperDark', blend(p.background.paperDark, p.background.default)]
  ]
}

/**
 * A contained primary button as the theme draws it, at rest and on hover, or
 * null when the theme draws contained buttons as a tint rather than an accent
 * fill (hybrasyl, chadul, grinneal, shattered: their accent fill is the selected
 * chip).
 * Read from the overrides, because jsdom cannot apply `:hover`.
 */
function containedPrimary(theme) {
  const p = theme.palette
  const o = theme.components?.MuiButton?.styleOverrides ?? {}
  const contained = o.contained ?? {}
  const own = o.containedPrimary ?? {}
  // MUI v9 has no containedPrimary override key, so a theme scopes its primary
  // fill under `contained` with the colour class, alone or with colorInherit.
  const scopedRest =
    contained['&.MuiButton-colorPrimary'] ??
    contained['&.MuiButton-colorPrimary, &.MuiButton-colorInherit'] ??
    {}
  const rest =
    own.backgroundColor ?? scopedRest.backgroundColor ?? contained.backgroundColor ?? p.primary.main
  if (rest.toLowerCase() !== p.primary.main.toLowerCase()) return null
  const scoped = contained['&.MuiButton-colorPrimary:hover']
  const hover =
    own['&:hover']?.backgroundColor ??
    scopedRest['&:hover']?.backgroundColor ??
    scoped?.backgroundColor ??
    contained['&:hover']?.backgroundColor ??
    p.primary.dark
  const label = own.color ?? scopedRest.color ?? contained.color ?? p.primary.contrastText
  return { hover, label }
}

describe('theme palettes', () => {
  it('registers all eight themes', () => {
    expect(THEME_NAMES).toHaveLength(8)
    for (const name of THEME_NAMES) expect(themesByName[name]).toBeDefined()
  })

  it.each(THEME_NAMES)('%s: primary.main is not the page background', (name) => {
    const p = themesByName[name].palette
    expect(p.primary.main.toLowerCase()).not.toBe(p.background.default.toLowerCase())
  })

  it('draws at least one contained button as an accent fill, so the hover rule runs', () => {
    expect(THEME_NAMES.filter((n) => containedPrimary(themesByName[n]) !== null).length).toBe(4)
  })

  describe.each(THEME_NAMES)('%s', (name) => {
    const theme = themesByName[name]
    const p = theme.palette

    it('carries the shared filledControls rules, and does not replace them', () => {
      // A theme key of its own would replace the spread one, and only the
      // rendered filledControls.test.tsx would see the loss.
      const components = theme.components ?? {}
      for (const key of Object.keys(filledControls))
        expect(components[key], key).toEqual(filledControls[key])
    })

    it('picks status labels at 4.5:1, not MUI’s default 3:1', () => {
      expect(p.contrastThreshold).toBe(4.5)
    })

    it('primary.main reads as text on every surface', () => {
      // The accent is a control (3:1, WCAG 1.4.11), but the apps draw it as TEXT
      // too: text buttons (the commonest button in every app), links and outlined
      // chips. So it is held to 4.5:1 (1.4.3), Sabrael, 2026-10-23.
      for (const [name, surface] of surfaces(p))
        expect(contrast(p.primary.main, surface), name).toBeGreaterThanOrEqual(4.5)
    })

    it.each(['error', 'warning', 'info', 'success'])(
      '%s.main reads as text on every surface',
      (status) => {
        // The apps draw status colours as text as well as fills: outlined chips,
        // text error buttons, `color: 'error.main'` (HTOO-572). danaan's DA yellow
        // was 1.05:1 on its parchment.
        for (const [name, surface] of surfaces(p))
          expect(contrast(p[status].main, surface), name).toBeGreaterThanOrEqual(4.5)
      }
    )

    it.each(['error', 'warning', 'info', 'success'])(
      'a %s.dark fill has a label that reads on it',
      (status) => {
        // The house rule: a status fill is `main` with `contrastText`. An app
        // that fills with `.dark` picks its label against that fill, with
        // getContrastText, as a dark-mode filled alert does. With
        // contrastThreshold 4.5, `contrastText` is dark wherever white fails on
        // `main`, so it cannot be the label on a dark `.dark`: elatha's error
        // strip drew it at 2.8:1. This holds getContrastText(.dark) to 4.5:1.
        const fill = p[status].dark
        const label = p.getContrastText(fill)
        expect(contrast(label, fill, fill), `${label} on ${fill}`).toBeGreaterThanOrEqual(4.5)
      }
    )

    it('contrastText is legible on primary.main', () => {
      // 4.5:1 (1.4.3): chip and button labels are normal-sized text, not large
      // text. This rule ruled out hybrasyl's cream (#f0e6cc on #4d84d1: 3.05:1).
      expect(contrast(p.primary.contrastText, p.primary.main)).toBeGreaterThanOrEqual(4.5)
    })

    it('primary.light and primary.dark follow main, and differ from it visibly', () => {
      // HTOO-572 fault 4: the ramp did not move with main. A hover that does not
      // change cannot be seen (dubhaimid's dark was 1.21:1 from its main).
      expect(luminance(p.primary.light)).toBeGreaterThan(luminance(p.primary.main))
      expect(luminance(p.primary.dark)).toBeLessThan(luminance(p.primary.main))
      expect(contrast(p.primary.light, p.primary.main)).toBeGreaterThanOrEqual(1.3)
      expect(contrast(p.primary.dark, p.primary.main)).toBeGreaterThanOrEqual(1.3)
    })

    it('a filled contained button keeps its label on hover', () => {
      // MUI hovers a filled button to primary.dark. Under a DARK label that
      // drops the label's contrast, so such a theme hovers to the lighter end
      // instead (Sabrael, 2026-10-11). A light label hovers darker, as MUI does.
      const button = containedPrimary(theme)
      if (!button) return
      const darkLabel = luminance(button.label) < luminance(p.primary.main)
      if (darkLabel) expect(luminance(button.hover)).toBeGreaterThan(luminance(p.primary.main))
      else expect(luminance(button.hover)).toBeLessThan(luminance(p.primary.main))
      expect(contrast(button.label, button.hover)).toBeGreaterThanOrEqual(4.5)
    })

    it.each(['button', 'headline', 'link', 'linkHover', 'visited'])(
      'text.%s reads on every surface',
      (key) => {
        // text.button: headings on the page and on cards. A palette without it
        // makes every `color: 'text.button'` an invalid colour, which the browser
        // drops (see themes/augmentation.ts). The bars use secondary.contrastText.
        // text.headline: the website's commonest token (73 uses), midir's tooltip
        // names. text.link: links in every app. Neither had a check before.
        // text.linkHover and text.visited are the same links, hovered and
        // visited: mundanes' visited link was 3.92:1 (the website, HTOO-572).
        const c = p.text[key]
        expect(c, `text.${key} is set`).toMatch(/^#[0-9a-f]{6}$/i)
        for (const [name, surface] of surfaces(p))
          expect(contrast(c, surface), name).toBeGreaterThanOrEqual(4.5)
      }
    )

    it('a plain <a> link reads at rest, hovered and visited, on every surface', () => {
      // Markdown and rendered HTML draw plain `<a>` links, which MUI's Link
      // override does not reach. hybrasyl's visited `a` was 2.35:1 and chadul's
      // 3.62:1; mundanes and dubhaimid had no rule, so links were browser blue
      // (1.8:1 on dubhaimid). A browser does not report :visited colours to
      // script, so the gallery cannot measure them; this reads the rule.
      const baseline = theme.components?.MuiCssBaseline?.styleOverrides
      const a = baseline?.a
      expect(a, 'the plain link rule').toBeDefined()
      const states = {
        rest: a.color,
        hover: a['&:hover']?.color,
        visited: a['&:visited']?.color
      }
      for (const [state, c] of Object.entries(states)) {
        expect(c, `${state} is set`).toMatch(/^#[0-9a-f]{6}$/i)
        for (const [name, surface] of surfaces(p))
          expect(contrast(c, surface), `${state} on ${name}`).toBeGreaterThanOrEqual(4.5)
      }
    })

    it('a page button reads at rest, hovered and selected', () => {
      // The pagination fills are opaque, and the label is normal-sized text.
      // hybrasyl's selected page was 2.61:1 and grinneal's plain page 2.45:1,
      // each with a #000 keyline that the house does not count (the website,
      // HTOO-572). mundanes and dubhaimid draw MUI's own pagination.
      const root = theme.components?.MuiPaginationItem?.styleOverrides?.root
      if (!root) return
      const hover = root['&:hover']
      const selected = root['&.Mui-selected']
      const label = root.color
      const fills = [
        ['rest', label, root.backgroundColor],
        ['hovered', hover.color ?? label, hover.backgroundColor],
        ['selected', selected.color, selected.backgroundColor],
        // MUI hovers a selected page to a grey wash, so the theme keeps the fill.
        ['selected, hovered', selected.color, selected['&:hover']?.backgroundColor]
      ]
      for (const [state, c, fill] of fills) {
        expect(fill, `${state} fill is set`).toMatch(/^#[0-9a-f]{6}$/i)
        expect(contrast(c, fill), `${state}: ${c} on ${fill}`).toBeGreaterThanOrEqual(4.5)
      }
    })

    it('secondary.contrastText reads on secondary.main, the bars', () => {
      // The title bar paints secondary.main, and its icons and wordmark take
      // secondary.contrastText.
      expect(contrast(p.secondary.contrastText, p.secondary.main)).toBeGreaterThanOrEqual(4.5)
    })

    it('text.dark is set, and is dark', () => {
      // The chrome hover over info.main takes info.contrastText now, because a
      // light theme's info colour is dark (chromeContrast.test.tsx checks it).
      expect(p.text.dark, 'text.dark is set').toMatch(/^#[0-9a-f]{6}$/i)
      expect(luminance(p.text.dark)).toBeLessThan(0.05)
    })

    it('a plain chip label reads on its tint, on every surface', () => {
      // The plain chip is the commonest chip, and its tint is translucent, so
      // the label is measured on the tint over the page and over paper. danaan's
      // `#7a5e18` was 4.02:1 on the page (corvath, HTOO-572).
      const plain = plainChip(theme, false)
      expect(plain, 'the plain chip variant').toBeDefined()
      const { backgroundColor: tint, color: label } = plain
      for (const [name, surface] of surfaces(p))
        expect(contrast(label, blend(tint, surface)), name).toBeGreaterThanOrEqual(4.5)
      // A clickable plain chip keeps its tint on hover, so the label still reads.
      // MUI's own hover is a grey wash, and the label is not held to it.
      const hover = plainChip(theme, true)?.['&:hover'] ?? {}
      expect(hover.backgroundColor, 'the hover keeps the tint').toBe(tint)
      expect(hover.borderColor, 'the hover shows in the border').toBeDefined()
    })

    it('an unchecked checkbox reads as a control on every surface', () => {
      // 3:1 (1.4.11). Each decorated theme drew it in the accent at 50%, 2.0:1
      // to 2.8:1. Every MUI icon took the theme's icon accent then, so the
      // box drew the accent at full strength and nobody saw it.
      const root = theme.components?.MuiCheckbox?.styleOverrides?.root
      if (!root) return
      // Mundanes and Dubhaimid use a translucent grey, so the colour is
      // measured as it draws over each surface.
      const c = root.color
      expect(c, 'the unchecked colour is set').toBeDefined()
      for (const [name, surface] of surfaces(p))
        expect(contrast(blend(c, surface), surface), name).toBeGreaterThanOrEqual(3)
    })

    it('a selected list item reads on its tint, on every surface', () => {
      // Navigation lists (dagda's sidebar, on paperDark) mark the selected item
      // with a tint and a label colour. danaan's `#7a5e18` was 3.77:1 on paperDark.
      const root = theme.components?.MuiListItemButton?.styleOverrides?.root ?? {}
      const selected = root['&.Mui-selected']
      if (!selected) return
      const { backgroundColor: tint, color: label } = selected
      for (const [name, surface] of surfaces(p))
        expect(contrast(label, blend(tint, surface)), name).toBeGreaterThanOrEqual(4.5)
    })

    it('an override that fills with primary.main gives its text 4.5:1', () => {
      // The component overrides paint the accent themselves, with their own label
      // colour. danaan's contained button put cream on its gold (2.76:1) while
      // the palette said otherwise.
      const fills = accentFills(theme.components ?? {}, p.primary.main)
      // At least the selected chip fills with the accent in every theme, so an
      // empty list means the walk broke, not that there is nothing to check.
      expect(fills.length).toBeGreaterThan(0)
      for (const f of fills) {
        expect(contrast(f.color, f.backgroundColor), f.path).toBeGreaterThanOrEqual(4.5)
      }
    })
  })
})

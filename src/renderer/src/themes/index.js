// Side-effect imports inject the @font-face rules so MUI's typography
// can actually resolve "Cinzel" / "Cinzel Decorative" / "Crimson Pro".
// Without these the browser falls back to the sans-serif stack in
// assets/base.css and the dashboard fonts look wrong.
import '@fontsource/cinzel'
import '@fontsource/cinzel-decorative'
import '@fontsource/crimson-pro'

import hybrasylTheme from './hybrasyl'
import chadulTheme from './chadul'
import danaanTheme from './danaan'
import grinnealTheme from './grinneal'
import mundanesTheme from './mundanes'
import dubhaimidTheme from './dubhaimid'

export { hybrasylTheme, chadulTheme, danaanTheme, grinnealTheme, mundanesTheme, dubhaimidTheme }

// name → MUI theme, so the ThemePicker can paint each preview card in that
// theme's own palette (mirrors the map App.jsx feeds to ThemeProvider).
export const themesByName = {
  hybrasyl: hybrasylTheme,
  chadul: chadulTheme,
  danaan: danaanTheme,
  grinneal: grinnealTheme,
  mundanes: mundanesTheme,
  dubhaimid: dubhaimidTheme
}

// Side-effect imports inject the @font-face rules so MUI's typography
// can actually resolve "Cinzel" / "Cinzel Decorative" / "Crimson Pro".
// Without these the browser falls back to the sans-serif stack in
// assets/base.css and the dashboard fonts look wrong.
import '@fontsource/cinzel'
import '@fontsource/cinzel-decorative'
import '@fontsource/crimson-pro'

export { default as hybrasylTheme } from './hybrasyl'
export { default as chadulTheme } from './chadul'
export { default as danaanTheme } from './danaan'
export { default as grinnealTheme } from './grinneal'

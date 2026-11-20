// WP8. `npm run -s world -- <command> …`: bundle the world agent
// (src/main/worldAgent) from the source and run it, so it never runs a stale
// build. The bundle takes well under a second. See src/main/worldAgent/cli.js.
import { build } from 'esbuild'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const outfile = join(repo, 'out', 'world', 'cli.cjs')

await build({
  entryPoints: [join(repo, 'src', 'main', 'worldAgent', 'bin.js')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  // Packages load from this checkout's node_modules; Electron is never loaded.
  packages: 'external',
  outfile,
  logLevel: 'warning'
})

// The checkout, so the XSD validator finds xsd/ wherever the agent runs it.
process.env.CREIDHNE_REPO ??= repo
createRequire(import.meta.url)(outfile)

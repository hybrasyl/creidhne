// WP8. The entry scripts/world.mjs bundles and runs: `mcp` serves the MCP front
// on stdio (mcp.js); any other command runs the CLI (cli.js).
import { resolve } from 'path'
import { main, parseArgs } from './cli.js'
import { serve } from './mcp.js'

const argv = process.argv.slice(2)
if (argv[0] === 'mcp') {
  const { flags } = parseArgs(argv.slice(1))
  const base = process.env.INIT_CWD ?? process.cwd()
  const root = typeof flags.root === 'string' ? resolve(base, flags.root) : undefined
  void serve(process.stdin, process.stdout, { root })
} else void main()

// WP8. `npm run -s world -- <command> …`: Creidhne's agent interface for world
// data. Each command prints one JSON object on stdout: `{ ok: true, command,
// world, result }`, or `{ ok: false, error }` with exit code 1 (2 for a usage
// error).
//
// The world is `--root`, else the git work tree of the folder npm was run from
// (`INIT_CWD`). A write command is a dry run without `--write`. With it, it
// writes and prints the paths it changed; it never commits (decision 1).
import { resolve } from 'path'
import { AgentError, gitTop, openWorld } from './context.js'
import * as cmd from './commands.js'

export const USAGE = `Usage: npm run -s world -- <command> [arguments] [--root <world>] [--pretty] [--all]

Read:
  find <name> [--type <type>]             entities whose name holds the text: live, archived, staged
  refs <type> <name> [--scripts]          the files that name an entity (--scripts: Lua hits, report only)
  names-in <file>                         the entities a file names, and whether each resolves
  collide <type> <name>                   whether a name is taken (active, archived, staged)
  duplicates [--type <type>]              keys that more than one active file holds
  check [--type <type>]                   staged-only references, missing references, duplicates, staged twins
  staging [--type <type>]                 the staged files and their live twins
  report <castables|items> [--preset <id>] [--columns a,b|all] [--rules <json>] [--match all|any]
  validate [<file> ...]                   XSD validation (no files: each changed world file in git)
  element-table <file>                    the element table's problems
  trait <file>                            the server's checks for a trait
  species <file>                          the server's checks for a species

Write (a dry run; --write writes and lists the changed paths; nothing is committed):
  rename <type> <old> <new> [--refs-only] [--scripts]
  stage <type> <file> ...
  release <type> <file> ... [--with-deps]

A file is relative to the world root (xml/castables/Foo.xml) or absolute.
Lists are cut at ${cmd.LIST_LIMIT} items; --all gives them whole.`

const BOOLEAN = new Set(['write', 'pretty', 'help', 'all', 'scripts', 'refs-only', 'with-deps'])

/** `--name value` and `--name=value` flags, booleans from `BOOLEAN`, the rest positional. */
export function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      positional.push(a)
      continue
    }
    const eq = a.indexOf('=')
    const name = eq > 0 ? a.slice(2, eq) : a.slice(2)
    if (eq > 0) flags[name] = a.slice(eq + 1)
    else if (BOOLEAN.has(name)) flags[name] = true
    else {
      const v = argv[i + 1]
      if (v === undefined || v.startsWith('--')) throw new UsageError(`--${name} needs a value`)
      flags[name] = v
      i++
    }
  }
  return { positional, flags }
}

class UsageError extends Error {}

const str = (flags, name) => (typeof flags[name] === 'string' ? flags[name] : undefined)

function need(args, n, what) {
  if (args.length < n) throw new UsageError(what)
}

/** Run one command line. Returns the object to print and the exit code. */
export async function run(argv, env = process.env) {
  let p
  try {
    p = parseArgs(argv)
  } catch (e) {
    return { out: { ok: false, error: e.message, usage: USAGE }, code: 2 }
  }
  const [command, ...args] = p.positional
  if (!command || p.flags.help) return { out: { ok: true, usage: USAGE }, code: command ? 0 : 2 }
  try {
    // npm runs the script in the Creidhne checkout; INIT_CWD is where it was run from.
    const base = env.INIT_CWD ?? process.cwd()
    const rootFlag = str(p.flags, 'root')
    const root = rootFlag ? resolve(base, rootFlag) : await gitTop(base)
    const ctx = openWorld(root)
    const f = p.flags
    const all = f.all === true
    const write = f.write === true
    let result
    switch (command) {
      case 'find':
        need(args, 1, 'find needs a name')
        result = await cmd.find(ctx, args.join(' '), { type: str(f, 'type'), all })
        break
      case 'refs':
        need(args, 2, 'refs needs a type and a name')
        result = await cmd.refs(ctx, args[0], args.slice(1).join(' '), {
          scripts: f.scripts === true,
          all
        })
        break
      case 'names-in':
        need(args, 1, 'names-in needs a file')
        result = await cmd.namesIn(ctx, args[0])
        break
      case 'collide':
        need(args, 2, 'collide needs a type and a name')
        result = await cmd.collide(ctx, args[0], args.slice(1).join(' '))
        break
      case 'duplicates':
        result = await cmd.duplicates(ctx, { type: str(f, 'type') })
        break
      case 'check':
        result = await cmd.check(ctx, { type: str(f, 'type'), all })
        break
      case 'staging':
        result = await cmd.staging(ctx, { type: str(f, 'type') })
        break
      case 'report':
        need(args, 1, 'report needs an entity (castables or items)')
        result = await cmd.report(ctx, args[0], {
          preset: str(f, 'preset'),
          rules: str(f, 'rules'),
          columns: str(f, 'columns'),
          match: str(f, 'match'),
          all
        })
        break
      case 'validate':
        result = await cmd.validate(ctx, args)
        break
      case 'element-table':
        need(args, 1, 'element-table needs a file')
        result = await cmd.elementTable(ctx, args[0])
        break
      case 'trait':
        need(args, 1, 'trait needs a file')
        result = await cmd.trait(ctx, args[0])
        break
      case 'species':
        need(args, 1, 'species needs a file')
        result = await cmd.species(ctx, args[0])
        break
      case 'rename':
        // Names may hold spaces: quote each one.
        need(
          args,
          3,
          'rename needs a type, the old name and the new name (quote a name with spaces)'
        )
        if (args.length > 3)
          throw new UsageError('rename takes three arguments; quote a name with spaces')
        result = await cmd.rename(ctx, args[0], args[1], args[2], {
          refsOnly: f['refs-only'] === true,
          scripts: f.scripts === true,
          write,
          all
        })
        break
      case 'stage':
        need(args, 2, 'stage needs a type and at least one file')
        result = await cmd.stage(ctx, args[0], args.slice(1), { write })
        break
      case 'release':
        need(args, 2, 'release needs a type and at least one file')
        result = await cmd.release(ctx, args[0], args.slice(1), {
          write,
          withDeps: f['with-deps'] === true
        })
        break
      default:
        throw new UsageError(`No command "${command}"`)
    }
    return { out: { ok: true, command, world: root, result }, code: 0 }
  } catch (e) {
    if (e instanceof UsageError)
      return { out: { ok: false, error: e.message, usage: USAGE }, code: 2 }
    const known = e instanceof AgentError
    return { out: { ok: false, error: e.message, ...(known ? {} : { kind: e.name }) }, code: 1 }
  }
}

/** The entry: parse, run, print. Not run on import, so the tests call `run`. */
export async function main() {
  const argv = process.argv.slice(2)
  const { out, code } = await run(argv)
  const pretty = argv.includes('--pretty')
  process.stdout.write(JSON.stringify(out, null, pretty ? 2 : undefined) + '\n')
  process.exitCode = code
}

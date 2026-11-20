import { describe, it, expect, beforeEach, afterEach, afterAll, beforeAll } from 'vitest'
import { execFileSync } from 'child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'fs'
import { PassThrough } from 'stream'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { run, parseArgs } from '../cli.js'
import { handle, serve, TOOLS } from '../mcp.js'

// WP8. The world agent on a small world in a temporary git repo. The index
// cache goes to a temp folder (HYBINDEX_CACHE_DIR), never %LOCALAPPDATA%.

const NS = 'xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02"'

const WORLD = {
  'xml/castables/bash.xml': `<Castable ${NS}>\n  <Name>Bash</Name>\n</Castable>\n`,
  'xml/castables/old-strike.xml': `<Castable ${NS}>\n  <Name>Old Strike</Name>\n</Castable>\n`,
  'xml/npcs/trainer.xml': `<Npc ${NS}>
  <Name>Trainer</Name>
  <Roles>
    <Train>
      <Castable Name="Test Strike" Class="Rogue"/>
      <Castable Name="Bash" Class="Warrior"/>
      <Castable Name="Ghost Step" Class="Rogue"/>
    </Train>
    <Vend><Items><Item Name="Lorica" Quantity="1"/></Items></Vend>
  </Roles>
</Npc>
`,
  'xml/items/lorica.xml': `<Item ${NS}>\n  <Name>Lorica</Name>\n</Item>\n`,
  // Holds the text "Lorica", but not as a reference: a rename must not touch it.
  'xml/items/mail.xml': `<Item ${NS}>\n  <Name>Mail</Name>\n  <Comment>Lorica</Comment>\n</Item>\n`,
  'xml/lootsets/crypt.xml': `<LootSet ${NS} Name="Crypt">\n  <Table><Items><Item>Lorica</Item></Items></Table>\n</LootSet>\n`,
  'xml/statuses/poison.xml': `<Status ${NS} Name="Poison"/>\n`,
  'xml/statuses/poison2.xml': `<Status ${NS} Name="poison"/>\n`,
  'xml/statuses/.ignore/old.xml': `<Status ${NS} Name="Rot"/>\n`,
  '.staging/castables/new/strike.xml': `<Castable ${NS}>\n  <Name>Test Strike</Name>\n  <Effects><Statuses><Add>Bleed</Add></Statuses></Effects>\n</Castable>\n`,
  '.staging/castables/bash-twin.xml': `<Castable ${NS}>\n  <Name>Bash</Name>\n</Castable>\n`,
  '.staging/statuses/bleed.xml': `<Status ${NS} Name="Bleed"/>\n`,
  'scripts/sample.lua': 'local skill = "Test Strike"\nlocal other = "test striking"\n'
}

let root
let cacheDir
const prevCache = process.env.HYBINDEX_CACHE_DIR

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })

beforeAll(() => {
  cacheDir = mkdtempSync(join(tmpdir(), 'creidhne-world-cache-'))
  process.env.HYBINDEX_CACHE_DIR = cacheDir
})

afterAll(() => {
  rmSync(cacheDir, { recursive: true, force: true })
  if (prevCache === undefined) delete process.env.HYBINDEX_CACHE_DIR
  else process.env.HYBINDEX_CACHE_DIR = prevCache
})

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'creidhne-world-'))
  for (const [rel, text] of Object.entries(WORLD)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
  git('init', '-q')
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '.')
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'world')
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

const call = async (...argv) => {
  const { out, code } = await run([...argv, '--root', root], {})
  return { ...out, code }
}
const read = (rel) => readFileSync(join(root, rel), 'utf8')
const status = () => git('status', '--porcelain')

describe('the CLI', () => {
  it('parses flags, booleans and positionals', () => {
    expect(
      parseArgs(['refs', 'castables', 'Bash', '--scripts', '--type=npcs', '--root', '/w'])
    ).toEqual({
      positional: ['refs', 'castables', 'Bash'],
      flags: { scripts: true, type: 'npcs', root: '/w' }
    })
    expect(() => parseArgs(['find', '--type'])).toThrow('--type needs a value')
  })

  it('prints usage with no command, and refuses an unknown one with exit 2', async () => {
    expect((await run([], {})).code).toBe(2)
    const bad = await call('fly')
    expect(bad.code).toBe(2)
    expect(bad.error).toBe('No command "fly"')
  })

  it('refuses a folder with no xml/', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'creidhne-empty-'))
    const { out, code } = await run(['check', '--root', empty], {})
    rmSync(empty, { recursive: true, force: true })
    expect(code).toBe(1)
    expect(out.error).toMatch(/is not a world: it has no xml\/ folder/)
  })

  it('takes the git work tree of INIT_CWD as the world', async () => {
    const { out } = await run(['find', 'Bash'], { INIT_CWD: join(root, 'xml', 'npcs') })
    expect(out.ok).toBe(true)
    expect(out.result.total).toBeGreaterThan(0)
  })
})

describe('read commands', () => {
  it('find: live, archived and staged entities, exact first', async () => {
    const { result } = await call('find', 'bash')
    expect(result.items.map((h) => [h.side, h.file, h.exact])).toEqual([
      ['live', 'xml/castables/bash.xml', true],
      ['staged', '.staging/castables/bash-twin.xml', true]
    ])
    expect((await call('find', 'rot')).result.items[0]).toMatchObject({
      side: 'archived',
      name: 'Rot'
    })
    expect((await call('find', 'test s', '--type', 'castables')).result.items[0]).toMatchObject({
      side: 'staged',
      exact: false
    })
  })

  it('refs: the files that name an entity, live and staged, anchored on the element', async () => {
    const { result } = await call('refs', 'items', 'Lorica')
    expect(result.total).toBe(2)
    expect(result.files.items.map((f) => f.file).sort()).toEqual([
      'xml/lootsets/crypt.xml',
      'xml/npcs/trainer.xml'
    ])
    // mail.xml holds the text, but not on a reference site
    expect(JSON.stringify(result)).not.toContain('mail.xml')
  })

  it('refs --scripts: Lua hits are reported, case folded, and marked unanchored', async () => {
    const { result } = await call('refs', 'castables', 'test strike', '--scripts')
    expect(result.scripts).toEqual({
      searched: true,
      anchored: false,
      hits: [{ file: 'scripts/sample.lua', line: 1, text: 'local skill = "Test Strike"' }]
    })
  })

  it('refs refuses a type with no reference table', async () => {
    const r = await call('refs', 'dragons', 'X')
    expect(r.code).toBe(1)
    expect(r.error).toMatch(/^refs takes a type of /)
  })

  it('names-in: each name live, staged-only or missing', async () => {
    const { result } = await call('names-in', 'xml/npcs/trainer.xml')
    expect(result.summary).toEqual({ live: 2, stagedOnly: 1, missing: 1 })
    expect(result.names).toContainEqual({
      type: 'castables',
      name: 'Test Strike',
      status: 'staged-only'
    })
    expect(result.names).toContainEqual({
      type: 'castables',
      name: 'Ghost Step',
      status: 'missing'
    })
  })

  it('collide: active, archived and staged', async () => {
    expect((await call('collide', 'statuses', 'POISON')).result).toMatchObject({
      collides: true,
      live: 'active'
    })
    expect((await call('collide', 'statuses', 'Rot')).result).toMatchObject({
      collides: false,
      live: 'archived'
    })
    expect((await call('collide', 'statuses', 'Bleed')).result).toMatchObject({
      collides: true,
      staged: true
    })
    expect((await call('collide', 'statuses', 'Frost')).result).toMatchObject({
      collides: false,
      live: null
    })
  })

  it('duplicates: keys more than one active file holds', async () => {
    const { result } = await call('duplicates')
    expect(result.groups).toEqual([
      {
        type: 'statuses',
        key: 'poison',
        files: ['xml/statuses/poison.xml', 'xml/statuses/poison2.xml'],
        caseOnly: true
      }
    ])
  })

  // The acceptance case (WP8 fault 1): a live NPC names a castable that exists only in staging.
  it('check: reports the live file that names a staged-only entity', async () => {
    const { result } = await call('check')
    expect(result.stagedOnly.items).toEqual([
      { file: 'xml/npcs/trainer.xml', type: 'castables', name: 'Test Strike' }
    ])
    expect(result.missing.items).toContainEqual({
      file: 'xml/npcs/trainer.xml',
      side: 'live',
      type: 'castables',
      name: 'Ghost Step'
    })
    expect(result.missing.byEdge).toEqual({ 'npcs -> castables': 1 })
    expect(result.duplicates.items).toHaveLength(1)
    expect(result.stagedTwins.items).toEqual([
      { file: '.staging/castables/bash-twin.xml', name: 'Bash', live: ['xml/castables/bash.xml'] }
    ])
  })

  it('check cuts a long list at 25 unless --all', async () => {
    const train = Array.from({ length: 30 }, (_, i) => `<Castable Name="Gone ${i}"/>`).join('')
    writeFileSync(
      join(root, 'xml/npcs/many.xml'),
      `<Npc ${NS}><Name>Many</Name><Train>${train}</Train></Npc>`
    )
    const cut = (await call('check')).result.missing
    expect(cut.items).toHaveLength(25)
    expect(cut.more).toBe(31 - 25)
    expect((await call('check', '--all')).result.missing.items).toHaveLength(31)
  })

  it('staging: staged files and their live twins', async () => {
    const { result } = await call('staging', '--type', 'castables')
    expect(result.types[0].files).toEqual([
      {
        file: '.staging/castables/bash-twin.xml',
        name: 'Bash',
        liveTwin: ['xml/castables/bash.xml'],
        stagedTwin: []
      },
      {
        file: '.staging/castables/new/strike.xml',
        name: 'Test Strike',
        liveTwin: [],
        stagedTwin: []
      }
    ])
  })

  it('report: rows through rules, and refusals that name the vocabulary', async () => {
    const { result } = await call('report', 'castables')
    expect(result.rows.items.map((r) => r.name).sort()).toEqual(['Bash', 'Old Strike'])
    expect((await call('report', 'dragons')).error).toMatch(
      /^report takes an entity of castables, items/
    )
    expect((await call('report', 'castables', '--preset', 'nope')).error).toMatch(
      /^No castables preset "nope"/
    )
    expect(
      (await call('report', 'castables', '--rules', '[{"field":"nope","op":"is","value":1}]')).error
    ).toMatch(/^The report is not valid: rule 1: Unknown report field: nope/)
    expect((await call('report', 'castables', '--rules', 'not json')).error).toMatch(
      /^--rules is not JSON/
    )
  })

  it('element-table, trait and species run the server checks on a file', async () => {
    const fixtures = join(__dirname, '..', '..', '__tests__', 'fixtures', 'xml')
    for (const type of ['elementtables', 'traits', 'species']) {
      const file = readdirSync(join(fixtures, type)).find((f) => f.endsWith('.xml'))
      mkdirSync(join(root, 'xml', type), { recursive: true })
      writeFileSync(join(root, 'xml', type, file), readFileSync(join(fixtures, type, file)))
    }
    const et = await call('element-table', 'xml/elementtables/element_table.xml')
    expect(et.result).toMatchObject({ oldFormat: false, problems: [] })
    const tr = await call('trait', 'xml/traits/trait_dockworker.xml')
    expect(Array.isArray(tr.result.problems)).toBe(true)
    const sp = await call('species', 'xml/species/species_dwarf.xml')
    expect(sp.result.key).toBeTruthy()
    expect((await call('trait', 'notes.txt')).error).toMatch(
      /is not under xml\/<type>\/ or \.staging\/<type>\//
    )
  })
})

describe('rename', () => {
  it('is a dry run without --write: it plans the entity line and the referrers, and writes nothing', async () => {
    const { result } = await call('rename', 'items', 'Lorica', 'Hauberk')
    expect(result.written).toBe(false)
    expect(result.entity).toEqual({
      file: 'xml/items/lorica.xml',
      side: 'live',
      lines: [{ line: 2, before: '<Name>Lorica</Name>', after: '<Name>Hauberk</Name>' }]
    })
    expect(result.references.total).toBe(2)
    expect(status()).toBe('')
  })

  it('with --write: changes the name and every reference, lists the paths, and commits nothing', async () => {
    const commits = git('rev-list', '--count', 'HEAD')
    const { result } = await call('rename', 'items', 'Lorica', 'Hauberk', '--write')
    expect(result.changed.sort()).toEqual([
      'xml/items/lorica.xml',
      'xml/lootsets/crypt.xml',
      'xml/npcs/trainer.xml'
    ])
    expect(read('xml/items/lorica.xml')).toContain('<Name>Hauberk</Name>')
    expect(read('xml/npcs/trainer.xml')).toContain('<Item Name="Hauberk" Quantity="1"/>')
    expect(read('xml/lootsets/crypt.xml')).toContain('<Item>Hauberk</Item>')
    // The anchoring case: mail.xml holds the text "Lorica" off a reference site.
    expect(read('xml/items/mail.xml')).toBe(WORLD['xml/items/mail.xml'])
    expect(git('rev-list', '--count', 'HEAD')).toBe(commits)
    // The index is current after the write.
    expect((await call('find', 'hauberk')).result.items[0].file).toBe('xml/items/lorica.xml')
  })

  it('repoints staged referrers too', async () => {
    await call('rename', 'statuses', 'Bleed', 'Hemorrhage', '--write')
    expect(read('.staging/castables/new/strike.xml')).toContain('<Add>Hemorrhage</Add>')
    expect(read('.staging/statuses/bleed.xml')).toContain('Name="Hemorrhage"')
  })

  it('refuses a new name that is taken, and an old name that two files claim', async () => {
    expect((await call('rename', 'castables', 'Old Strike', 'bash')).error).toBe(
      '"bash" is already an active castables name'
    )
    expect((await call('rename', 'statuses', 'Bleed', 'Poison')).error).toBe(
      '"Poison" is already an active statuses name'
    )
    expect((await call('rename', 'statuses', 'Poison', 'Venom')).error).toMatch(
      /^"Poison" is claimed by more than one file/
    )
    expect((await call('rename', 'castables', 'Nothing', 'X')).error).toBe(
      'No castables file is named "Nothing"'
    )
    expect(status()).toBe('')
  })

  it('--refs-only repoints the references of an entity a person renamed', async () => {
    writeFileSync(
      join(root, 'xml/items/lorica.xml'),
      WORLD['xml/items/lorica.xml'].replace('Lorica', 'Hauberk')
    )
    const { result } = await call('rename', 'items', 'Lorica', 'Hauberk', '--refs-only', '--write')
    expect(result.entity).toBeNull()
    expect(result.changed.sort()).toEqual(['xml/lootsets/crypt.xml', 'xml/npcs/trainer.xml'])
    // Refused while an entity still has the old name: its references resolve.
    const again = await call('rename', 'castables', 'Bash', 'Smash', '--refs-only')
    expect(again.error).toMatch(/^"Bash" is still the name of xml\/castables\/bash\.xml/)
  })
})

describe('stage and release', () => {
  it('stage names the live referrers, and moves the file with --write', async () => {
    const dry = await call('stage', 'items', 'xml/items/lorica.xml')
    expect(dry.result.moves[0]).toMatchObject({
      from: 'xml/items/lorica.xml',
      to: '.staging/items/lorica.xml',
      name: 'Lorica',
      liveReferrers: ['xml/lootsets/crypt.xml', 'xml/npcs/trainer.xml']
    })
    expect(status()).toBe('')
    const done = await call('stage', 'items', 'xml/items/lorica.xml', '--write')
    expect(done.result.changed).toEqual(['xml/items/lorica.xml', '.staging/items/lorica.xml'])
    expect(existsSync(join(root, '.staging/items/lorica.xml'))).toBe(true)
    expect((await call('names-in', 'xml/npcs/trainer.xml')).result.summary.stagedOnly).toBe(2)
  })

  it('release lists the staged-only names a file holds, and --with-deps brings them', async () => {
    const dry = await call('release', 'castables', '.staging/castables/new/strike.xml')
    expect(dry.result.needs).toEqual([
      {
        file: '.staging/statuses/bleed.xml',
        type: 'statuses',
        name: 'Bleed',
        neededBy: '.staging/castables/new/strike.xml'
      }
    ])
    const done = await call(
      'release',
      'castables',
      '.staging/castables/new/strike.xml',
      '--with-deps',
      '--write'
    )
    expect(done.result.changed.sort()).toEqual(
      [
        '.staging/castables/new/strike.xml',
        'xml/castables/new/strike.xml',
        '.staging/statuses/bleed.xml',
        'xml/statuses/bleed.xml'
      ].sort()
    )
    expect((await call('check')).result.stagedOnly.items).toEqual([])
  })

  it('release refuses a name that is already live', async () => {
    const dry = await call('release', 'castables', '.staging/castables/bash-twin.xml')
    expect(dry.result.clashes).toEqual([
      { file: '.staging/castables/bash-twin.xml', name: 'Bash', reason: 'live' }
    ])
    const done = await call('release', 'castables', '.staging/castables/bash-twin.xml', '--write')
    expect(done.error).toMatch(
      /^Release refused: \.staging\/castables\/bash-twin\.xml \("Bash", already live\)/
    )
    expect(status()).toBe('')
  })

  it('refuses a file on the wrong side or of the wrong type', async () => {
    expect((await call('stage', 'items', '.staging/statuses/bleed.xml')).error).toBe(
      '.staging/statuses/bleed.xml is not in xml/items/ (not archived)'
    )
    expect((await call('release', 'castables', 'xml/castables/bash.xml')).error).toBe(
      'xml/castables/bash.xml is not in .staging/castables/'
    )
  })
})

describe('the bundle', () => {
  // scripts/world.mjs bundles bin.js with esbuild and runs it under plain Node.
  // An `electron` import anywhere below it would load a stub (or nothing) and
  // fail only at run time, so the guard reads the bundle itself.
  it('requires no electron, and does require the packages it uses', async () => {
    const { build } = await import('esbuild')
    const out = await build({
      entryPoints: [join(__dirname, '..', 'bin.js')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      packages: 'external',
      write: false,
      logLevel: 'silent'
    })
    const requires = [...out.outputFiles[0].text.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1])
    expect(requires).toContain('@eriscorp/hybindex-ts') // guard the guard: the scan sees requires
    expect(requires.filter((r) => r === 'electron' || r.startsWith('electron/'))).toEqual([])
  })
})

describe('the MCP front', () => {
  const rpc = (method, params, id = 1) =>
    handle({ jsonrpc: '2.0', ...(id === null ? {} : { id }), method, params }, { root })
  const callTool = async (name, args) => {
    const res = await rpc('tools/call', { name, arguments: args })
    return { isError: res.result.isError, out: JSON.parse(res.result.content[0].text) }
  }

  it('answers initialize as creidhne-world, and lists one tool for each command', async () => {
    expect((await rpc('initialize', {})).result.serverInfo.name).toBe('creidhne-world')
    const { result } = await rpc('tools/list')
    expect(result.tools.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name))
    // Guard the guard: one tool for each CLI command.
    const usage = (await run(['--help'], {})).out.usage
    const commands = [...usage.matchAll(/^ {2}([a-z-]+) /gm)].map((m) => m[1])
    expect(commands).toHaveLength(15)
    expect(TOOLS.map((t) => t.name.replace(/^world_/, '').replace(/_/g, '-')).sort()).toEqual(
      commands.sort()
    )
  })

  it('a tool gives the same result as the command', async () => {
    const viaTool = await callTool('world_names_in', { file: 'xml/npcs/trainer.xml' })
    expect(viaTool.isError).toBe(false)
    expect(viaTool.out).toEqual(
      (await run(['names-in', 'xml/npcs/trainer.xml', '--root', root], {})).out
    )
  })

  it('renames with write: true, and refuses write: "false", writing nothing', async () => {
    const bad = await callTool('world_rename', {
      type: 'items',
      old_name: 'Lorica',
      new_name: 'Hauberk',
      write: 'false'
    })
    expect(bad.isError).toBe(true)
    expect(bad.out.error).toBe('world_rename: "write" must be a boolean')
    expect(status()).toBe('')
    const good = await callTool('world_rename', {
      type: 'items',
      old_name: 'Lorica',
      new_name: 'Hauberk',
      write: true
    })
    expect(good.out.result.changed).toHaveLength(3)
  })

  it('refuses a name that starts with "--"', async () => {
    const res = await callTool('world_refs', { type: 'items', name: '--write' })
    expect(res.out.error).toBe('world_refs: "name" must not start with "--"')
  })

  it('serves on streams', async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    let text = ''
    output.on('data', (d) => (text += d))
    const done = serve(input, output, { root })
    input.end(
      '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"world_find","arguments":{"name":"lorica"}}}\n'
    )
    await done
    const reply = JSON.parse(text.trim())
    expect(reply.id).toBe(7)
    expect(JSON.parse(reply.result.content[0].text).result.items[0].file).toBe(
      'xml/items/lorica.xml'
    )
  })
})

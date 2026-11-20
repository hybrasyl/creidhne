// WP8. The world agent as an MCP server, on the agent-mcp v1 house module
// (src/main/agentMcp). Each tool builds the CLI's argv and calls `run`, so the
// two fronts give the same result. The module checks each call's arguments
// against the tool's schema first (HTOO-702).
//
// Start it with `node <creidhne>/scripts/world.mjs mcp [--root <world>]`.
import {
  argText,
  booleanProp,
  flagArgs,
  handleMcp,
  serveMcp,
  stringProp,
  stringsProp
} from '../agentMcp/agentMcp.js'
import { run } from './cli.js'

const WRITE = booleanProp(
  'Write the change and list the changed paths (nothing is committed). Without it, the call is a dry run'
)
const ALL = booleanProp('Give every list whole (lists are cut at 25 items)')
const TYPE = stringProp('The index type: the section folder, such as "castables" or "npcs"')
const FILE = stringProp(
  'A world file, relative to the world root (xml/castables/Foo.xml), or absolute'
)

export const TOOLS = [
  {
    name: 'world_find',
    description:
      "The entities whose name holds the text, by the server's name key: type, name, file, and side (live, archived, staged). Exact matches first.",
    properties: { name: stringProp('The name, or part of it'), type: TYPE, all: ALL },
    required: ['name'],
    argv: (a) => ['find', argText(a.name), ...flagArgs(a, ['type', 'all'])]
  },
  {
    name: 'world_refs',
    description:
      'The files that name an entity, live and staged, with a count for each, through the declared reference table (the anchored scan a rename uses). scripts: also report Lua files that hold the name as a quoted string; those hits are unanchored and are never repointed.',
    properties: {
      type: TYPE,
      name: stringProp('The entity name'),
      scripts: booleanProp('Also search scripts/ as plain text'),
      all: ALL
    },
    required: ['type', 'name'],
    argv: (a) => ['refs', argText(a.type), argText(a.name), ...flagArgs(a, ['scripts', 'all'])]
  },
  {
    name: 'world_names_in',
    description:
      'The entities one file names, and for each one: live, staged-only (the server cannot resolve it from a live file), or missing.',
    properties: { file: FILE },
    required: ['file'],
    argv: (a) => ['names-in', argText(a.file)]
  },
  {
    name: 'world_collide',
    description:
      'Whether a name is taken in the type: an active, an archived or a staged file, with the files.',
    properties: { type: TYPE, name: stringProp('The name') },
    required: ['type', 'name'],
    argv: (a) => ['collide', argText(a.type), argText(a.name)]
  },
  {
    name: 'world_duplicates',
    description:
      'The keys that more than one active file holds. The server loads one of them and reports nothing.',
    properties: { type: TYPE },
    argv: (a) => ['duplicates', ...flagArgs(a, ['type'])]
  },
  {
    name: 'world_check',
    description:
      "The world's problems: live files that name a staged-only entity, references to entities that exist nowhere (counted by edge), duplicate keys, and staged files whose name is already live. Run it after an edit.",
    properties: { type: stringProp('Only check files of this source type'), all: ALL },
    argv: (a) => ['check', ...flagArgs(a, ['type', 'all'])]
  },
  {
    name: 'world_staging',
    description:
      'The staged files of each type (in .staging/), with any live or staged file of the same name.',
    properties: { type: TYPE },
    argv: (a) => ['staging', ...flagArgs(a, ['type'])]
  },
  {
    name: 'world_report',
    description:
      'Report rows for castables or items, through a preset or a rule list in the report vocabulary. columns is a comma list of field keys, or "all"; the default is "name". rules is a JSON array of {field, op, value}.',
    properties: {
      entity: stringProp('"castables" or "items"'),
      preset: stringProp('A preset id, such as "balancingCsv"'),
      columns: stringProp('Field keys, comma-separated, or "all"'),
      rules: stringProp('A JSON array of rules: [{"field": "...", "op": "is", "value": ...}]'),
      match: stringProp('"all" (default) or "any"'),
      all: ALL
    },
    required: ['entity'],
    argv: (a) => [
      'report',
      argText(a.entity),
      ...flagArgs(a, ['preset', 'columns', 'rules', 'match', 'all'])
    ]
  },
  {
    name: 'world_validate',
    description:
      'XSD validation of world files. With no files, each changed world file in the git work tree. A failure for a type with known schema drift is marked "drift".',
    properties: { files: stringsProp('World files; leave out for the changed files') },
    argv: (a) => ['validate', ...(a.files ?? [])]
  },
  {
    name: 'world_element_table',
    description: "An element table's problems, and whether it uses the old format.",
    properties: { file: FILE },
    required: ['file'],
    argv: (a) => ['element-table', argText(a.file)]
  },
  {
    name: 'world_trait',
    description: 'The checks the server runs on a trait at load.',
    properties: { file: FILE },
    required: ['file'],
    argv: (a) => ['trait', argText(a.file)]
  },
  {
    name: 'world_species',
    description: 'The checks the server runs on a species at load.',
    properties: { file: FILE },
    required: ['file'],
    argv: (a) => ['species', argText(a.file)]
  },
  {
    name: 'world_rename',
    description:
      'Rename an entity: a one-line edit of its own name, then every reference to it in live and staged files. refs_only: the references only, for an entity a person already renamed. Refused when the new name is taken or the old name has two claimants. The filename does not change.',
    properties: {
      type: TYPE,
      old_name: stringProp('The current name'),
      new_name: stringProp('The new name'),
      refs_only: booleanProp('Repoint the references only'),
      scripts: booleanProp('Also report Lua files that hold the old name'),
      write: WRITE,
      all: ALL
    },
    required: ['type', 'old_name', 'new_name'],
    argv: (a) => [
      'rename',
      argText(a.type),
      argText(a.old_name),
      argText(a.new_name),
      ...(a.refs_only === true ? ['--refs-only'] : []),
      ...flagArgs(a, ['scripts', 'write', 'all'])
    ]
  },
  {
    name: 'world_stage',
    description:
      'Move live files to .staging/<type>/, and name the live files that refer to each one (after the move they name a staged-only entity).',
    properties: { type: TYPE, files: stringsProp('Live files of the type'), write: WRITE },
    required: ['type', 'files'],
    argv: (a) => ['stage', argText(a.type), ...(a.files ?? []), ...flagArgs(a, ['write'])]
  },
  {
    name: 'world_release',
    description:
      'Move staged files to xml/<type>/. Refused when a name is already live. Lists the staged-only entities the files name; with_deps releases those files too.',
    properties: {
      type: TYPE,
      files: stringsProp('Staged files of the type'),
      with_deps: booleanProp('Also release the staged-only entities the files name'),
      write: WRITE
    },
    required: ['type', 'files'],
    argv: (a) => [
      'release',
      argText(a.type),
      ...(a.files ?? []),
      ...(a.with_deps === true ? ['--with-deps'] : []),
      ...flagArgs(a, ['write'])
    ]
  }
]

export const SPEC = {
  name: 'creidhne-world',
  version: '1',
  tools: TOOLS,
  common: { root: stringProp("The world folder (it holds xml/). Default: the server's --root") },
  run
}

export const handle = (msg, defaults) => handleMcp(SPEC, msg, defaults)
export const serve = (input, output, defaults) => serveMcp(SPEC, input, output, defaults)

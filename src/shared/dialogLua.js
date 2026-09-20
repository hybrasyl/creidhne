import { hasText } from './dialogDocument.js'

// Lua emission for a dialog document (HTOO-458).
//
// Two targets over one document:
//
//   inline  — what every NPC script looks like today: a string table above
//             OnSpawn, and inside it the sequences constructed, then registered,
//             then the pursuits. The writer pastes the two pieces.
//   module  — scripts/modules/dialogs/<name>.lua in the shape of
//             scripts/modules/specialization.lua: `local M = {}`, `M.install(opts)`
//             that merges `opts.text` over the defaults and registers the
//             sequences on `origin`, `return M`. Plus the require + install call
//             the host pastes into its own OnSpawn.
//
// Output is deterministic — no dates, no random names — so a re-export of an
// unchanged document is a no-op diff, and a test can pin the text.
//
// Variable naming follows the corpus: `<slug>_dialog` for a sequence,
// `<slug>_lecture` for a pursuit, `<slug>_options` for an options table. Text
// is keyed by sequence (see catalogueText), which the corpus mostly is not —
// that is deliberate; see the note there.

const INDENT = '  '

/** A Lua double-quoted string literal. */
export function luaString(value) {
  const s = String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
  return `"${s}"`
}

/** A Lua identifier fragment from a sequence name or title. */
export function slug(name) {
  let s = String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!s) s = 'seq'
  if (/^\d/.test(s)) s = `s_${s}`
  return s
}

/** Hands out variable names, suffixing a repeat with _2, _3, … */
function namer() {
  const used = new Set()
  return (base) => {
    let name = base
    let n = 2
    while (used.has(name)) name = `${base}_${n++}`
    used.add(name)
    return name
  }
}

/**
 * The common `foo_bar_` prefix of the sequences that carry text, so keys can
 * drop it: `on_honey_menu` reads as `menu` inside the `on_honey` table. Cut at
 * an underscore, never mid-word.
 */
function commonPrefix(slugs) {
  if (slugs.length < 2) return ''
  let prefix = slugs[0]
  for (const s of slugs.slice(1)) {
    let i = 0
    while (i < prefix.length && i < s.length && prefix[i] === s[i]) i++
    prefix = prefix.slice(0, i)
  }
  const cut = prefix.lastIndexOf('_')
  return cut > 0 ? prefix.slice(0, cut + 1) : ''
}

/**
 * Keys the document's text BY SEQUENCE, the way the specialization trainers
 * are written by hand (`styles.intro[1]`, `styles.menu`): a sequence with one
 * line is a string, with several an array. Positional `oaths[7]` is the
 * corpus norm and nobody can follow it.
 *
 * Returns the table entries to emit and a lookup from dialog id to the Lua
 * expression that reads it. A sequence's key is its slug minus the prefix the
 * text-bearing sequences share; a collision takes a numeric suffix.
 */
function catalogueText(doc, tableExpr) {
  const withText = doc.sequences.filter((s) => s.dialogs.some((d) => hasText(d.kind)))
  const prefix = commonPrefix(withText.map((s) => slug(s.name)))
  const nextKey = namer()
  const entries = [] // { key, lines: [{ text, required }] }
  const refs = new Map() // dialog id → Lua expression
  for (const seq of withText) {
    let base = slug(seq.name)
    if (prefix && base.startsWith(prefix)) base = base.slice(prefix.length)
    // The document's own name is a prefix too: `two.two_a` reads as `two.a`.
    if (base.startsWith(`${doc.name}_`)) base = base.slice(doc.name.length + 1)
    if (base === doc.name) base = ''
    if (!base) base = seq.scope === 'pursuit' ? 'lecture' : 'main'
    const key = nextKey(base)
    const lines = seq.dialogs.filter((d) => hasText(d.kind))
    lines.forEach((d, i) => {
      refs.set(d.id, lines.length === 1 ? `${tableExpr}.${key}` : `${tableExpr}.${key}[${i + 1}]`)
    })
    entries.push({ key, lines: lines.map((d) => ({ text: d.text ?? '', required: !!d.required })) })
  }
  return { entries, refs }
}

function renderTableBody(entries, indent) {
  const lines = []
  for (const e of entries) {
    if (e.lines.length === 1) {
      lines.push(`${indent}${e.key} = ${luaString(e.lines[0].text)},`)
    } else {
      lines.push(`${indent}${e.key} = {`)
      for (const l of e.lines) lines.push(`${indent}${INDENT}${luaString(l.text)},`)
      lines.push(`${indent}},`)
    }
  }
  return lines
}

/**
 * The construction, registration and pursuit lines for every sequence, at the
 * given indent. `declare` is the prefix for a new variable ('' at script scope,
 * 'local ' inside install). Returns an array of lines.
 */
function renderSequences(doc, refs, indent, declare) {
  const nextName = namer()
  const vars = new Map() // sequence id → variable
  for (const seq of doc.sequences) {
    const base = slug(seq.name)
    vars.set(seq.id, nextName(seq.scope === 'pursuit' ? `${base}_lecture` : `${base}_dialog`))
  }

  const lines = []
  const inner = indent + INDENT

  for (const seq of doc.sequences) {
    const seqVar = vars.get(seq.id)
    const args = []
    for (const d of seq.dialogs) {
      switch (d.kind) {
        case 'text':
          args.push(
            d.callback
              ? `world.NewDialog(${refs.get(d.id)}, ${luaString(d.callback)})`
              : `world.NewDialog(${refs.get(d.id)})`
          )
          break
        case 'options': {
          const optVar = nextName(`${slug(seq.name)}_options`)
          lines.push(`${indent}${declare}${optVar} = world.NewDialogOptions()`)
          for (const o of d.options) {
            const target =
              o.target.type === 'callback'
                ? luaString(o.target.expr)
                : `world.NewJumpDialog(${luaString(o.target.sequence)})`
            const check = o.check ? `, ${luaString(o.check)}` : ''
            lines.push(`${indent}${optVar}.AddOption(${luaString(o.label)}, ${target}${check})`)
          }
          const tail =
            d.callback || d.handler
              ? `, ${luaString(d.callback ?? '')}, ${luaString(d.handler ?? '')}`
              : ''
          args.push(`world.NewOptionsDialog(${refs.get(d.id)}, ${optVar}${tail})`)
          break
        }
        case 'jump':
          args.push(
            d.callback
              ? `world.NewJumpDialog(${luaString(d.sequence)}, ${luaString(d.callback)})`
              : `world.NewJumpDialog(${luaString(d.sequence)})`
          )
          break
        case 'function':
          args.push(`world.NewFunctionDialog(${luaString(d.expr)})`)
          break
        case 'input':
          args.push(
            `world.NewTextDialog(${refs.get(d.id)}, ${luaString(d.topCaption)}, ${luaString(
              d.bottomCaption
            )}, ${Number(d.maxLength)}, ${luaString(d.callback ?? '')}, ${luaString(d.handler ?? '')})`
          )
          break
        default:
          break
      }
    }
    lines.push(`${indent}${declare}${seqVar} = world.NewDialogSequence(${luaString(seq.name)},`)
    args.forEach((a, i) => lines.push(`${inner}${a}${i === args.length - 1 ? ')' : ','}`))
    lines.push('')
  }

  // Registration: locals on the NPC, globals on the world. A pursuit is added
  // rather than registered.
  const locals = doc.sequences.filter((s) => s.scope === 'local')
  const globals = doc.sequences.filter((s) => s.scope === 'global')
  const pursuits = doc.sequences.filter((s) => s.scope === 'pursuit')

  for (const seq of locals) lines.push(`${indent}origin.RegisterSequence(${vars.get(seq.id)})`)
  for (const seq of globals) {
    const v = vars.get(seq.id)
    if (seq.displayName) lines.push(`${indent}${v}.SetDisplayName(${luaString(seq.displayName)})`)
    if (seq.sprite !== '') lines.push(`${indent}${v}.SetNpcDisplaySprite(${Number(seq.sprite)})`)
    if (seq.associateWithScript) lines.push(`${indent}${v}.AssociateWithScript(this_script)`)
    lines.push(`${indent}world.RegisterGlobalSequence(${v})`)
  }
  if ((locals.length || globals.length) && pursuits.length) lines.push('')
  for (const seq of pursuits) {
    const v = vars.get(seq.id)
    if (seq.menuCheck)
      lines.push(`${indent}${v}.AddMenuCheckExpression(${luaString(seq.menuCheck)})`)
    lines.push(`${indent}origin.AddPursuit(${v})`)
  }
  return lines
}

/**
 * Inline export: `{ table, onSpawn }`, two pieces the writer pastes — the
 * string table above OnSpawn, the block inside it.
 */
export function emitInline(doc) {
  const { entries, refs } = catalogueText(doc, doc.name)
  const heading = doc.title || doc.name
  const table = [
    `-- ${heading}: text table, generated by Creidhne from .creidhne/dialogs/${doc.name}.json`,
    `${doc.name} = {`,
    ...renderTableBody(entries, INDENT),
    '}'
  ].join('\n')
  const onSpawn = [
    `${INDENT}-- ${heading} -- generated by Creidhne from .creidhne/dialogs/${doc.name}.json`,
    ...renderSequences(doc, refs, INDENT, '')
  ].join('\n')
  return { table, onSpawn }
}

/**
 * Module export: `{ module, host }`. `module` is the whole file for
 * scripts/modules/dialogs/<name>.lua; `host` is what an NPC pastes into its
 * OnSpawn to use it, with every text key and its default listed so giving the
 * NPC its own voice is editing in place; required keys are marked.
 */
export function emitModule(doc) {
  const { entries, refs } = catalogueText(doc, 'text')
  const heading = doc.title || doc.name
  const module = [
    `-- dialogs/${doc.name}: ${heading}`,
    `-- Generated by Creidhne from .creidhne/dialogs/${doc.name}.json.`,
    `-- Save as scripts/modules/dialogs/${doc.name}.lua. Everything above the`,
    `-- callbacks line is regenerated; keep hand-written functions below it.`,
    'local M = {}',
    '',
    '-- Default text, keyed by sequence. A host overrides any key, whole, through',
    '-- install({ text = { key = … } }). A required key has no usable default.',
    'local defaults = {',
    ...renderTableBody(entries, INDENT),
    '}',
    '',
    '--- Build and register this dialog on the calling NPC. Call from OnSpawn.',
    'function M.install(opts)',
    `${INDENT}M.opts = opts or {}`,
    `${INDENT}local text = {}`,
    `${INDENT}for k, v in pairs(defaults) do text[k] = v end`,
    `${INDENT}for k, v in pairs(M.opts.text or {}) do text[k] = v end`,
    '',
    ...renderSequences(doc, refs, INDENT, 'local '),
    'end',
    '',
    '-- <creidhne:callbacks> Functions this dialog names go below, as M.<name>,',
    `-- and are called from the dialog as "${doc.name}.<name>()".`,
    '',
    'return M',
    ''
  ].join('\n')

  const hostLines = [`${INDENT}${doc.name} = require("dialogs/${doc.name}")`]
  if (entries.length === 0) {
    hostLines.push(`${INDENT}${doc.name}.install()`)
  } else {
    hostLines.push(`${INDENT}${doc.name}.install({`)
    hostLines.push(`${INDENT}${INDENT}text = {`)
    for (const e of entries) {
      const required = e.lines.some((l) => l.required)
      const note = required ? ' -- required' : ''
      if (e.lines.length === 1) {
        hostLines.push(
          `${INDENT}${INDENT}${INDENT}${e.key} = ${luaString(e.lines[0].text)},${note}`
        )
      } else {
        hostLines.push(`${INDENT}${INDENT}${INDENT}${e.key} = {${note}`)
        for (const l of e.lines)
          hostLines.push(`${INDENT}${INDENT}${INDENT}${INDENT}${luaString(l.text)},`)
        hostLines.push(`${INDENT}${INDENT}${INDENT}},`)
      }
    }
    hostLines.push(`${INDENT}${INDENT}}`)
    hostLines.push(`${INDENT}})`)
  }
  return { module, host: hostLines.join('\n') }
}

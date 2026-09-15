import { hasText } from './dialogDocument.js'

// Lua emission for a dialog document (HTOO-458).
//
// Two targets over one document:
//
//   inline  — what every NPC script looks like today: a string table above
//             OnSpawn, and inside it the sequences constructed, then registered,
//             then the pursuits. The writer pastes the two pieces. Slots emit
//             their default text.
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
// `<slug>_lecture` for a pursuit, `<slug>_options` for an options table.

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
 * Walks the document's text in emission order and assigns each dialog a table
 * reference. A slot is keyed by its name (first occurrence sets the default);
 * every other text takes the next positional index. Returns the entries to
 * emit and a lookup from dialog id to the Lua expression that reads it.
 */
function catalogueText(doc, tableExpr) {
  const entries = [] // { comment?, key?: string, index?: number, text }
  const refs = new Map() // dialog id → Lua expression
  const slotSeen = new Set()
  let index = 0
  for (const seq of doc.sequences) {
    let first = true
    for (const d of seq.dialogs) {
      if (!hasText(d.kind)) continue
      if (d.slot) {
        refs.set(d.id, `${tableExpr}.${d.slot}`)
        if (slotSeen.has(d.slot)) continue
        slotSeen.add(d.slot)
        entries.push({ comment: first ? seq.name : undefined, key: d.slot, text: d.text ?? '' })
      } else {
        index += 1
        refs.set(d.id, `${tableExpr}[${index}]`)
        entries.push({ comment: first ? seq.name : undefined, index, text: d.text ?? '' })
      }
      first = false
    }
  }
  return { entries, refs }
}

function renderTableBody(entries, indent) {
  const lines = []
  let lastComment
  for (const e of entries) {
    if (e.comment && e.comment !== lastComment) {
      lines.push(`${indent}-- ${e.comment}`)
      lastComment = e.comment
    }
    lines.push(
      e.key ? `${indent}${e.key} = ${luaString(e.text)},` : `${indent}${luaString(e.text)},`
    )
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
 * OnSpawn to use it, with every slot listed so the writer sees what is theirs
 * to fill.
 */
export function emitModule(doc) {
  const { entries, refs } = catalogueText(doc, 'text')
  const heading = doc.title || doc.name
  const slots = entries.filter((e) => e.key)
  const module = [
    `-- dialogs/${doc.name}: ${heading}`,
    `-- Generated by Creidhne from .creidhne/dialogs/${doc.name}.json.`,
    `-- Save as scripts/modules/dialogs/${doc.name}.lua. Everything above the`,
    `-- callbacks line is regenerated; keep hand-written functions below it.`,
    'local M = {}',
    '',
    '-- Default text. A host overrides a slot through install({ text = { … } }).',
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
  if (slots.length === 0) {
    hostLines.push(`${INDENT}${doc.name}.install()`)
  } else {
    hostLines.push(`${INDENT}${doc.name}.install({`)
    hostLines.push(`${INDENT}${INDENT}text = {`)
    for (const s of slots) {
      const note = s.text ? '-- optional; remove to keep the default' : '-- required'
      hostLines.push(`${INDENT}${INDENT}${INDENT}${s.key} = ${luaString(s.text)}, ${note}`)
    }
    hostLines.push(`${INDENT}${INDENT}}`)
    hostLines.push(`${INDENT}})`)
  }
  return { module, host: hostLines.join('\n') }
}

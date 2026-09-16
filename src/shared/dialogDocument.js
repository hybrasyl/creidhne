// The dialog document (HTOO-458): what the dialog builder edits, saves under
// world/.creidhne/dialogs/<name>.json, and renders to Lua.
//
// The shape mirrors today's Lua dialog API one to one — sequences of dialogs,
// options that jump or call back, pursuits, global sequences — because Phase 1
// is legacy-only (HTOO-141). It is held constant on purpose: the compiler and
// the module system that card describes consume THIS document, so those phases
// promote files rather than convert them.
//
// Text is keyed BY SEQUENCE when emitted (`on_honey.menu`, `on_honey.intro[2]`),
// so in a module export every sequence's text is a key a host may override. A
// text may be marked REQUIRED: the host must supply it, and the `text` here is
// only a placeholder. A document with nothing required is still a valid module.
//
// Every id here is for the UI (React keys, selection). The server never sees
// one: it keys sequences on `name`.

export const DIALOG_SCHEMA_VERSION = 1

export const DIALOG_KINDS = ['text', 'options', 'jump', 'function', 'input']

export const DIALOG_KIND_LABELS = {
  text: 'Text',
  options: 'Options',
  jump: 'Jump',
  function: 'Function',
  input: 'Text input'
}

export const SEQUENCE_SCOPES = ['local', 'pursuit', 'global']

export const SEQUENCE_SCOPE_LABELS = {
  local: 'Local',
  pursuit: 'Pursuit',
  global: 'Global'
}

/** The Lua expression that ends a dialog; the idiom every script uses. */
export const END_DIALOG_EXPR = 'source.EndDialog()'

/** Valid document names: a Lua identifier in lower snake case, so it can be
 *  the string table's name, the module's name and the file's basename. */
export const DOCUMENT_NAME_PATTERN = /^[a-z][a-z0-9_]*$/

/** Max input length the server accepts for a text dialog. */
export const INPUT_MAX_LENGTH = 254

export function newId() {
  return Math.random().toString(36).slice(2, 10)
}

export function newDocument(name = '') {
  return {
    schemaVersion: DIALOG_SCHEMA_VERSION,
    name,
    title: '',
    description: '',
    sequences: []
  }
}

export function newSequence(name = '') {
  return {
    id: newId(),
    name,
    scope: 'local',
    menuCheck: '',
    displayName: '',
    sprite: '',
    associateWithScript: false,
    dialogs: []
  }
}

export function newOption() {
  return { id: newId(), label: '', target: { type: 'jump', sequence: '' }, check: '' }
}

export function newDialog(kind) {
  const base = { id: newId(), kind }
  switch (kind) {
    case 'text':
      return { ...base, text: '', required: false, callback: '' }
    case 'options':
      return {
        ...base,
        text: '',
        required: false,
        options: [newOption()],
        callback: '',
        handler: ''
      }
    case 'jump':
      return { ...base, sequence: '', callback: '' }
    case 'function':
      return { ...base, expr: '' }
    case 'input':
      return {
        ...base,
        text: '',
        required: false,
        topCaption: '',
        bottomCaption: '',
        maxLength: INPUT_MAX_LENGTH,
        callback: '',
        handler: ''
      }
    default:
      throw new Error(`Unknown dialog kind: ${kind}`)
  }
}

/** The "End dialog" convenience: a function dialog that ends the conversation. */
export function newEndDialog() {
  return { ...newDialog('function'), expr: END_DIALOG_EXPR }
}

/** True when a dialog kind carries display text. */
export function hasText(kind) {
  return kind === 'text' || kind === 'options' || kind === 'input'
}

/** True when any text in the document is marked required (host must supply). */
export function hasRequiredText(doc) {
  return (doc.sequences ?? []).some((s) =>
    (s.dialogs ?? []).some((d) => hasText(d.kind) && d.required)
  )
}

/**
 * Fills in anything a saved or hand-edited document lacks, so the editor and the
 * emitter can rely on every field being present. Does not validate — that is
 * `validateDialogDocument`'s job, and it reports rather than repairs.
 */
export function normalizeDocument(raw) {
  const doc = newDocument()
  doc.schemaVersion = raw?.schemaVersion ?? DIALOG_SCHEMA_VERSION
  doc.name = String(raw?.name ?? '')
  doc.title = String(raw?.title ?? '')
  doc.description = String(raw?.description ?? '')
  doc.sequences = (Array.isArray(raw?.sequences) ? raw.sequences : []).map((s) => {
    const seq = newSequence(String(s?.name ?? ''))
    if (s?.id) seq.id = String(s.id)
    seq.scope = SEQUENCE_SCOPES.includes(s?.scope) ? s.scope : 'local'
    seq.menuCheck = String(s?.menuCheck ?? '')
    seq.displayName = String(s?.displayName ?? '')
    seq.sprite = s?.sprite === undefined || s?.sprite === null ? '' : String(s.sprite)
    seq.associateWithScript = !!s?.associateWithScript
    seq.dialogs = (Array.isArray(s?.dialogs) ? s.dialogs : [])
      .filter((d) => DIALOG_KINDS.includes(d?.kind))
      .map((d) => {
        const dialog = newDialog(d.kind)
        if (d.id) dialog.id = String(d.id)
        for (const key of Object.keys(dialog)) {
          if (key === 'id' || key === 'kind' || key === 'options') continue
          if (d[key] !== undefined && d[key] !== null) {
            dialog[key] =
              key === 'maxLength' ? Number(d[key]) : key === 'required' ? !!d[key] : String(d[key])
          }
        }
        if (d.kind === 'options') {
          dialog.options = (Array.isArray(d.options) ? d.options : []).map((o) => {
            const opt = newOption()
            if (o?.id) opt.id = String(o.id)
            opt.label = String(o?.label ?? '')
            opt.check = String(o?.check ?? '')
            if (o?.target?.type === 'callback') {
              opt.target = { type: 'callback', expr: String(o.target.expr ?? '') }
            } else {
              opt.target = { type: 'jump', sequence: String(o?.target?.sequence ?? '') }
            }
            return opt
          })
        }
        return dialog
      })
    return seq
  })
  return doc
}

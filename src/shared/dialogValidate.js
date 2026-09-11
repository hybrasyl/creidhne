import {
  DOCUMENT_NAME_PATTERN,
  INPUT_MAX_LENGTH,
  SEQUENCE_SCOPES,
  DIALOG_KINDS,
  hasText
} from './dialogDocument.js'

// Validation for a dialog document (HTOO-458).
//
// Every ERROR here is a fault that today is found by a player hitting it in
// game: a jump to a sequence nobody registered, a sequence registered twice,
// an option with nowhere to go, an options dialog with no options (the server
// throws at OnSpawn and the NPC has no dialog at all). Export is refused while
// any error stands. A WARNING is something the writer probably did not mean —
// a sequence nothing reaches — and does not block.
//
// Each problem carries the ids of the sequence / dialog / option it is about, so
// the editor can mark the field rather than print a list the writer has to map
// back by hand.

/**
 * @param {object} doc      a normalized document
 * @param {object} [opts]
 * @param {'inline'|'module'} [opts.mode='inline']  inline export emits a slot's
 *        default, so an empty default is an error there; a module leaves it for
 *        the host to supply.
 * @returns {{ errors: Problem[], warnings: Problem[] }}
 */
export function validateDialogDocument(doc, { mode = 'inline' } = {}) {
  const errors = []
  const warnings = []
  const error = (message, where = {}) => errors.push({ level: 'error', message, ...where })
  const warn = (message, where = {}) => warnings.push({ level: 'warning', message, ...where })

  if (!DOCUMENT_NAME_PATTERN.test(doc.name ?? '')) {
    error('Name must be lower snake case starting with a letter (it becomes the Lua table name).', {
      field: 'name'
    })
  }

  const sequences = doc.sequences ?? []
  if (sequences.length === 0) {
    error('A dialog needs at least one sequence.', { field: 'sequences' })
  }

  // Sequence names are the server's keys: exact-match dictionary entries.
  const byName = new Map()
  const byLowerName = new Map()
  for (const seq of sequences) {
    const where = { sequenceId: seq.id }
    const name = (seq.name ?? '').trim()
    if (!name) {
      error('Sequence has no name.', { ...where, field: 'name' })
      continue
    }
    if (byName.has(name)) {
      error(`Sequence name "${name}" is used twice.`, { ...where, field: 'name' })
    } else {
      byName.set(name, seq)
      const lower = name.toLowerCase()
      if (byLowerName.has(lower)) {
        warn(
          `Sequence "${name}" differs only by case from "${byLowerName.get(lower)}"; the server keeps both.`,
          { ...where, field: 'name' }
        )
      } else {
        byLowerName.set(lower, name)
      }
    }
    if (!SEQUENCE_SCOPES.includes(seq.scope)) {
      error(`Unknown scope "${seq.scope}".`, { ...where, field: 'scope' })
    }
    if (seq.scope === 'global' && seq.sprite !== '' && !/^\d+$/.test(String(seq.sprite))) {
      error('Sprite must be a whole number.', { ...where, field: 'sprite' })
    }
    if (seq.scope !== 'pursuit' && seq.menuCheck) {
      warn('Menu check only applies to a pursuit; it will not be emitted.', {
        ...where,
        field: 'menuCheck'
      })
    }
    if (seq.menuCheck && !plausibleExpression(seq.menuCheck)) {
      error('Menu check is not a plausible Lua expression (unbalanced quotes or brackets).', {
        ...where,
        field: 'menuCheck'
      })
    }
  }

  // Jump targets, collected as we go, for the reachability pass below.
  const jumpTargets = new Set()
  const noteJump = (target, where, field) => {
    const name = (target ?? '').trim()
    if (!name) {
      error('Jump has no target sequence.', { ...where, field })
      return
    }
    if (!byName.has(name)) {
      error(`Jump target "${name}" is not a sequence in this dialog.`, { ...where, field })
      return
    }
    jumpTargets.add(name)
  }
  const checkExpr = (value, label, where, field) => {
    if (value && !plausibleExpression(value)) {
      error(`${label} is not a plausible Lua expression (unbalanced quotes or brackets).`, {
        ...where,
        field
      })
    }
  }

  for (const seq of sequences) {
    const dialogs = seq.dialogs ?? []
    if (dialogs.length === 0) {
      error('Sequence has no dialogs.', { sequenceId: seq.id, field: 'dialogs' })
    }
    for (const d of dialogs) {
      const where = { sequenceId: seq.id, dialogId: d.id }
      if (!DIALOG_KINDS.includes(d.kind)) {
        error(`Unknown dialog kind "${d.kind}".`, where)
        continue
      }
      if (hasText(d.kind)) {
        const text = (d.text ?? '').trim()
        if (!text) {
          if (d.slot && mode === 'module') {
            // A slot with no default: the host must supply it. Fine for a module.
          } else if (d.slot) {
            error(`Slot "${d.slot}" has no default text, and inline export emits the default.`, {
              ...where,
              field: 'text'
            })
          } else {
            error('Dialog has no text.', { ...where, field: 'text' })
          }
        }
        if (d.slot && !/^[a-z][a-z0-9_]*$/.test(d.slot)) {
          error('Slot name must be lower snake case starting with a letter.', {
            ...where,
            field: 'slot'
          })
        }
        checkExpr(d.callback, 'Callback', where, 'callback')
      }
      switch (d.kind) {
        case 'options': {
          const options = d.options ?? []
          if (options.length === 0) {
            error('Options dialog has no options; the server refuses it at load.', {
              ...where,
              field: 'options'
            })
          }
          const labels = new Set()
          for (const o of options) {
            const ow = { ...where, optionId: o.id }
            const label = (o.label ?? '').trim()
            if (!label) error('Option has no label.', { ...ow, field: 'label' })
            else if (labels.has(label)) {
              // The server keys options in an ordered dictionary by label.
              error(`Option label "${label}" is used twice in this dialog.`, {
                ...ow,
                field: 'label'
              })
            } else labels.add(label)
            if (o.target?.type === 'callback') {
              if (!(o.target.expr ?? '').trim()) {
                error('Option calls back but names no expression.', { ...ow, field: 'target' })
              } else checkExpr(o.target.expr, 'Option expression', ow, 'target')
            } else {
              noteJump(o.target?.sequence, ow, 'target')
            }
            checkExpr(o.check, 'Option check', ow, 'check')
          }
          checkExpr(d.handler, 'Handler', where, 'handler')
          break
        }
        case 'jump':
          noteJump(d.sequence, where, 'sequence')
          checkExpr(d.callback, 'Callback', where, 'callback')
          break
        case 'function':
          if (!(d.expr ?? '').trim())
            error('Function dialog has no expression.', { ...where, field: 'expr' })
          else checkExpr(d.expr, 'Expression', where, 'expr')
          break
        case 'input': {
          const n = Number(d.maxLength)
          if (!Number.isInteger(n) || n < 1 || n > INPUT_MAX_LENGTH) {
            error(`Max length must be a whole number from 1 to ${INPUT_MAX_LENGTH}.`, {
              ...where,
              field: 'maxLength'
            })
          }
          checkExpr(d.handler, 'Handler', where, 'handler')
          break
        }
        default:
          break
      }
    }
    // A sequence whose tail shows text and then stops leaves the player on a
    // dialog with nowhere to go. Usually a missed "End dialog"; not always.
    const last = dialogs[dialogs.length - 1]
    if (last && (last.kind === 'text' || last.kind === 'input')) {
      warn('Sequence ends on a text dialog with no jump, options or end.', {
        sequenceId: seq.id,
        dialogId: last.id
      })
    }
  }

  // Reachability. Pursuits and globals are roots (the NPC menu and
  // StartSequence reach them); everything else must be jumped to.
  for (const seq of sequences) {
    const name = (seq.name ?? '').trim()
    if (!name || seq.scope !== 'local') continue
    if (!jumpTargets.has(name)) {
      warn(`Sequence "${name}" is never jumped to; nothing reaches it.`, {
        sequenceId: seq.id,
        field: 'name'
      })
    }
  }

  return { errors, warnings }
}

/**
 * A cheap plausibility check for a Lua expression that will be embedded in a
 * string: no newline, and balanced quotes and brackets. Not a parser — a wrong
 * expression still fails in game — but it catches the truncated paste.
 */
export function plausibleExpression(expr) {
  const s = String(expr)
  if (/[\r\n]/.test(s)) return false
  let depth = 0
  let quote = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") quote = c
    else if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      depth--
      if (depth < 0) return false
    }
  }
  return depth === 0 && quote === null
}

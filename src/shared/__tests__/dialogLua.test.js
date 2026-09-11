import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import luaparse from 'luaparse'
import { dialogCallTree } from './luaCallTree.js'
import { emitInline, emitModule, luaString, slug } from '../dialogLua.js'
import { validateDialogDocument, plausibleExpression } from '../dialogValidate.js'
import {
  newDocument,
  newSequence,
  newDialog,
  newEndDialog,
  newOption,
  normalizeDocument,
  collectSlots
} from '../dialogDocument.js'

const here = join(fileURLToPath(import.meta.url), '..')
const NARVE = readFileSync(join(here, 'fixtures', 'narve-oaths.lua'), 'utf-8')

/**
 * A document from a call tree — the test's own mini reader, so the Narve case
 * is a true round trip: hand-written Lua → tree → document → emitted Lua →
 * tree. The two trees must be equal.
 */
function documentFromCallTree(name, tree) {
  const doc = newDocument(name)
  for (const [seqName, s] of Object.entries(tree)) {
    const seq = newSequence(seqName)
    seq.scope = s.scope === 'unregistered' ? 'local' : s.scope
    seq.menuCheck = s.menuCheck ?? ''
    if (s.displayName) seq.displayName = s.displayName
    if (s.sprite !== undefined) seq.sprite = String(s.sprite)
    if (s.associateWithScript) seq.associateWithScript = true
    seq.dialogs = s.dialogs.map((d) => {
      const dialog = newDialog(d.kind)
      switch (d.kind) {
        case 'text':
          Object.assign(dialog, { text: d.text, callback: d.callback })
          break
        case 'jump':
          Object.assign(dialog, { sequence: d.sequence, callback: d.callback })
          break
        case 'function':
          dialog.expr = d.expr
          break
        case 'options':
          Object.assign(dialog, { text: d.text, callback: d.callback, handler: d.handler })
          dialog.options = d.options.map((o) => {
            const opt = newOption()
            opt.label = o.label
            opt.check = o.check
            opt.target = o.target
            return opt
          })
          break
        case 'input':
          Object.assign(dialog, {
            text: d.text,
            topCaption: d.topCaption,
            bottomCaption: d.bottomCaption,
            maxLength: d.maxLength,
            callback: d.callback,
            handler: d.handler
          })
          break
        default:
          break
      }
      return dialog
    })
    doc.sequences.push(seq)
  }
  return doc
}

/** Wraps the inline pieces the way a writer pastes them. */
function inlineScript({ table, onSpawn }) {
  return `${table}\n\nfunction OnSpawn()\n${onSpawn}\nend\n`
}

describe('the Narve Oaths acceptance case', () => {
  const original = dialogCallTree(NARVE)
  const doc = documentFromCallTree('oaths', original)

  it('the fixture carries the shapes the emitter must reproduce', () => {
    // Guard the guard: if the fixture stopped parsing into sequences, every
    // comparison below would pass on two empty trees.
    expect(Object.keys(original).length).toBe(11)
    expect(original['Oaths'].scope).toBe('pursuit')
    expect(original['Oaths'].menuCheck).toBe('return priest_oaths_available() == true')
    expect(original['priest_oaths_menu'].dialogs[0].kind).toBe('options')
    expect(original['priest_oaths_menu'].dialogs[0].options).toHaveLength(4)
    expect(original['priest_oaths_quick'].dialogs[0].options[1].target).toEqual({
      type: 'callback',
      expr: 'priest_oaths_duskmaker()'
    })
  })

  it('validates with no errors', () => {
    const { errors } = validateDialogDocument(doc)
    expect(errors).toEqual([])
  })

  it('inline export is the same call tree as the hand-written original', () => {
    const emitted = inlineScript(emitInline(doc))
    expect(() => luaparse.parse(emitted)).not.toThrow()
    expect(dialogCallTree(emitted)).toEqual(original)
  })

  it('inline export reads like the corpus', () => {
    const { table, onSpawn } = emitInline(doc)
    // The test document is name-sorted, so the first sequence with text is
    // priest_oaths_already_taken; a pursuit with only a function dialog adds
    // no text and no comment.
    expect(table).toMatch(/^-- .*\noaths = \{\n {2}-- priest_oaths_already_taken\n {2}"Oh, you've/)
    expect(onSpawn).toContain('  priest_oaths_menu_options = world.NewDialogOptions()')
    expect(onSpawn).toContain(
      '  priest_oaths_menu_options.AddOption("Let me think on this", world.NewJumpDialog("priest_oaths_think_it_over"))'
    )
    expect(onSpawn).toContain('  oaths_lecture = world.NewDialogSequence("Oaths",')
    expect(onSpawn).toContain('  origin.RegisterSequence(priest_oaths_intro_dialog)')
    expect(onSpawn).toContain(
      '  oaths_lecture.AddMenuCheckExpression("return priest_oaths_available() == true")'
    )
    expect(onSpawn.trimEnd().endsWith('origin.AddPursuit(oaths_lecture)')).toBe(true)
    // The text table is referenced, not inlined.
    expect(onSpawn).toContain('world.NewDialog(oaths[1])')
    expect(onSpawn).not.toContain('Ah, an Aisling!')
  })

  it('module export is the same call tree, built inside install()', () => {
    const { module, host } = emitModule(doc)
    expect(() => luaparse.parse(module)).not.toThrow()
    expect(dialogCallTree(module, { tableAlias: { text: 'defaults' } })).toEqual(original)
    expect(module.trimEnd().endsWith('return M')).toBe(true)
    expect(module).toContain('function M.install(opts)')
    expect(module).toContain('  local priest_oaths_menu_options = world.NewDialogOptions()')
    expect(host).toBe('  oaths = require("dialogs/oaths")\n  oaths.install()')
  })

  it('a re-export of the same document is byte-identical', () => {
    expect(emitInline(doc)).toEqual(emitInline(doc))
    expect(emitModule(doc)).toEqual(emitModule(doc))
  })

  it('survives a normalize round trip through JSON', () => {
    const again = normalizeDocument(JSON.parse(JSON.stringify(doc)))
    expect(dialogCallTree(inlineScript(emitInline(again)))).toEqual(original)
  })
})

describe('emitter details the corpus exercises', () => {
  it('luaString escapes what a double-quoted Lua literal needs', () => {
    expect(luaString('a "b" \\ c\nd\te')).toBe('"a \\"b\\" \\\\ c\\nd\\te"')
    expect(luaString('')).toBe('""')
    expect(luaString(undefined)).toBe('""')
  })

  it('slug makes an identifier from a title', () => {
    expect(slug('Herbal Remedies')).toBe('herbal_remedies')
    expect(slug('On Politics!')).toBe('on_politics')
    expect(slug('7th Day')).toBe('s_7th_day')
    expect(slug('')).toBe('seq')
  })

  it('emits the full NewTextDialog argument list, an option check, and global registration', () => {
    const doc = newDocument('asynctest')
    const send = newSequence('asynctest_send')
    send.scope = 'global'
    send.displayName = 'Async Send Test'
    send.sprite = '3'
    send.associateWithScript = true
    const input = newDialog('input')
    Object.assign(input, {
      text: 'Enter a name.',
      topCaption: 'The name',
      bottomCaption: 'To receive',
      maxLength: 16,
      handler: 'async_handler()'
    })
    send.dialogs = [input]
    const menu = newSequence('asynctest_menu')
    const opts = newDialog('options')
    opts.text = 'Pick one.'
    opts.handler = 'on_pick()'
    opts.options = [newOption(), newOption()]
    opts.options[0].label = 'Stuff'
    opts.options[0].target = { type: 'callback', expr: 'async_target_response()' }
    opts.options[0].check = 'return source.Level > 5'
    opts.options[1].label = 'Send'
    opts.options[1].target = { type: 'jump', sequence: 'asynctest_send' }
    menu.dialogs = [opts, newEndDialog()]
    const lecture = newSequence('Async')
    lecture.scope = 'pursuit'
    lecture.dialogs = [{ ...newDialog('jump'), sequence: 'asynctest_menu' }]
    doc.sequences = [send, menu, lecture]

    expect(validateDialogDocument(doc).errors).toEqual([])
    const { onSpawn } = emitInline(doc)
    expect(onSpawn).toContain(
      'world.NewTextDialog(asynctest[1], "The name", "To receive", 16, "", "async_handler()")'
    )
    expect(onSpawn).toContain(
      'asynctest_menu_options.AddOption("Stuff", "async_target_response()", "return source.Level > 5")'
    )
    expect(onSpawn).toContain(
      'world.NewOptionsDialog(asynctest[2], asynctest_menu_options, "", "on_pick()")'
    )
    expect(onSpawn).toContain('world.NewFunctionDialog("source.EndDialog()")')
    expect(onSpawn).toContain('asynctest_send_dialog.SetDisplayName("Async Send Test")')
    expect(onSpawn).toContain('asynctest_send_dialog.SetNpcDisplaySprite(3)')
    expect(onSpawn).toContain('asynctest_send_dialog.AssociateWithScript(this_script)')
    expect(onSpawn).toContain('world.RegisterGlobalSequence(asynctest_send_dialog)')
    expect(onSpawn).toContain('origin.RegisterSequence(asynctest_menu_dialog)')
    expect(onSpawn).not.toContain('RegisterSequence(async_lecture)')
    expect(onSpawn).toContain('origin.AddPursuit(async_lecture)')

    const tree = dialogCallTree(inlineScript(emitInline(doc)))
    expect(tree.asynctest_send.scope).toBe('global')
    expect(tree.asynctest_send.associateWithScript).toBe(true)
    expect(tree.asynctest_menu.dialogs[0].options[0].check).toBe('return source.Level > 5')
  })

  it('two options dialogs in one sequence get distinct option tables', () => {
    const doc = newDocument('two')
    const seq = newSequence('two_menus')
    const a = newDialog('options')
    a.text = 'A'
    a.options[0].label = 'x'
    a.options[0].target = { type: 'callback', expr: 'f()' }
    const b = newDialog('options')
    b.text = 'B'
    b.options[0].label = 'y'
    b.options[0].target = { type: 'callback', expr: 'g()' }
    seq.dialogs = [a, b]
    seq.scope = 'pursuit'
    doc.sequences = [seq]
    const { onSpawn } = emitInline(doc)
    expect(onSpawn).toContain('two_menus_options = world.NewDialogOptions()')
    expect(onSpawn).toContain('two_menus_options_2 = world.NewDialogOptions()')
    expect(
      dialogCallTree(inlineScript(emitInline(doc))).two_menus.dialogs[1].options[0].label
    ).toBe('y')
  })

  it('slots: inline emits the default, module keys the text and lists the slot for the host', () => {
    const doc = newDocument('greet')
    const seq = newSequence('greet_intro')
    seq.scope = 'pursuit'
    const hello = newDialog('text')
    Object.assign(hello, { text: 'Well met.', slot: 'hello' })
    const voice = newDialog('text')
    Object.assign(voice, { text: '', slot: 'voice' })
    const plain = newDialog('text')
    plain.text = 'Farewell.'
    seq.dialogs = [hello, voice, plain, newEndDialog()]
    doc.sequences = [seq]

    expect(collectSlots(doc)).toEqual([
      { name: 'hello', default: 'Well met.' },
      { name: 'voice', default: '' }
    ])
    // Inline cannot emit an empty default.
    expect(validateDialogDocument(doc, { mode: 'inline' }).errors.map((e) => e.field)).toEqual([
      'text'
    ])
    expect(validateDialogDocument(doc, { mode: 'module' }).errors).toEqual([])

    const { module, host } = emitModule(doc)
    expect(module).toContain('  hello = "Well met.",')
    expect(module).toContain('  voice = "",')
    expect(module).toContain('  "Farewell.",')
    expect(module).toContain('world.NewDialog(text.hello)')
    expect(module).toContain('world.NewDialog(text.voice)')
    expect(module).toContain('world.NewDialog(text[1])')
    expect(host).toContain('hello = "Well met.", -- optional; remove to keep the default')
    expect(host).toContain('voice = "", -- required')
    expect(() => luaparse.parse(module)).not.toThrow()
  })
})

describe('validation refuses what a player would otherwise find', () => {
  const base = () => {
    const doc = newDocument('t')
    const menu = newSequence('t_menu')
    const opts = newDialog('options')
    opts.text = 'Pick.'
    opts.options[0].label = 'Go'
    opts.options[0].target = { type: 'jump', sequence: 't_go' }
    menu.dialogs = [opts]
    const go = newSequence('t_go')
    go.dialogs = [{ ...newDialog('text'), text: 'Gone.' }, newEndDialog()]
    const lecture = newSequence('Talk')
    lecture.scope = 'pursuit'
    lecture.dialogs = [{ ...newDialog('jump'), sequence: 't_menu' }]
    doc.sequences = [menu, go, lecture]
    return doc
  }

  it('a well-formed document has no errors and no warnings', () => {
    expect(validateDialogDocument(base())).toEqual({ errors: [], warnings: [] })
  })

  it('a dangling jump names the jump and the missing sequence', () => {
    const doc = base()
    doc.sequences[0].dialogs[0].options[0].target.sequence = 't_nowhere'
    const { errors } = validateDialogDocument(doc)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      sequenceId: doc.sequences[0].id,
      dialogId: doc.sequences[0].dialogs[0].id,
      optionId: doc.sequences[0].dialogs[0].options[0].id,
      field: 'target'
    })
    expect(errors[0].message).toContain('"t_nowhere"')
    // And the sequence nothing reaches any more is warned about, not refused.
    expect(validateDialogDocument(doc).warnings.map((w) => w.message)).toEqual([
      'Sequence "t_go" is never jumped to; nothing reaches it.'
    ])
  })

  it('a duplicate sequence name is refused; a case-only difference is warned', () => {
    const doc = base()
    doc.sequences[1].name = 't_menu'
    expect(validateDialogDocument(doc).errors.map((e) => e.message)).toContain(
      'Sequence name "t_menu" is used twice.'
    )
    doc.sequences[1].name = 'T_Menu'
    const r = validateDialogDocument(doc)
    expect(r.errors.map((e) => e.message)).not.toContain('Sequence name "t_menu" is used twice.')
    expect(r.warnings.some((w) => w.message.includes('differs only by case'))).toBe(true)
  })

  it('an options dialog with no options, a bare option, and a duplicate label', () => {
    const doc = base()
    const opts = doc.sequences[0].dialogs[0]
    opts.options = []
    expect(validateDialogDocument(doc).errors.map((e) => e.field)).toContain('options')
    opts.options = [newOption(), newOption()]
    opts.options[0].label = 'Same'
    opts.options[1].label = 'Same'
    opts.options[1].target = { type: 'callback', expr: '' }
    const fields = validateDialogDocument(doc).errors.map((e) => `${e.field}:${e.message}`)
    expect(fields.some((f) => f.startsWith('target:Jump has no target'))).toBe(true)
    expect(fields.some((f) => f.startsWith('label:Option label "Same" is used twice'))).toBe(true)
    expect(fields.some((f) => f.startsWith('target:Option calls back but names no'))).toBe(true)
  })

  it('empty text, an empty function, a bad max length, a bad name', () => {
    const doc = base()
    doc.name = 'Bad Name'
    doc.sequences[1].dialogs[0].text = '  '
    doc.sequences[1].dialogs[1].expr = ''
    const input = newDialog('input')
    Object.assign(input, { text: 'x', maxLength: 300 })
    doc.sequences[1].dialogs.push(input)
    const fields = validateDialogDocument(doc).errors.map((e) => e.field)
    expect(fields).toEqual(expect.arrayContaining(['name', 'text', 'expr', 'maxLength']))
  })

  it('a truncated expression is caught; a normal one is not', () => {
    expect(plausibleExpression('return priest_oaths_available() == true')).toBe(true)
    expect(plausibleExpression("source.CompletionAward('lecture_x', 250)")).toBe(true)
    expect(plausibleExpression('source.SystemMessage("He says \\"hi\\"")')).toBe(true)
    expect(plausibleExpression("source.CompletionAward('lecture_x")).toBe(false)
    expect(plausibleExpression('f(')).toBe(false)
    expect(plausibleExpression('f())')).toBe(false)
    expect(plausibleExpression('a\nb')).toBe(false)
    const doc = base()
    doc.sequences[2].menuCheck = 'return x("'
    expect(validateDialogDocument(doc).errors.map((e) => e.field)).toContain('menuCheck')
  })

  it('a sequence ending on text is a warning, and a menu check off a pursuit is a warning', () => {
    const doc = base()
    doc.sequences[1].dialogs.pop()
    doc.sequences[0].menuCheck = 'return true'
    const { errors, warnings } = validateDialogDocument(doc)
    expect(errors).toEqual([])
    expect(warnings.map((w) => w.field ?? w.dialogId)).toEqual(
      expect.arrayContaining(['menuCheck', doc.sequences[1].dialogs[0].id])
    )
  })
})

describe('normalizeDocument', () => {
  it('fills a bare hand-written document and drops what it does not know', () => {
    const doc = normalizeDocument({
      name: 'x',
      sequences: [
        { name: 'a', scope: 'pursuit', dialogs: [{ kind: 'text', text: 'hi' }, { kind: 'bogus' }] },
        {
          name: 'b',
          dialogs: [{ kind: 'options', options: [{ label: 'l', target: { type: 'jump' } }] }]
        }
      ]
    })
    expect(doc.schemaVersion).toBe(1)
    expect(doc.sequences[0].dialogs).toHaveLength(1)
    expect(doc.sequences[0].dialogs[0]).toMatchObject({
      kind: 'text',
      text: 'hi',
      slot: '',
      callback: ''
    })
    expect(doc.sequences[0].id).toBeTruthy()
    expect(doc.sequences[1].scope).toBe('local')
    expect(doc.sequences[1].dialogs[0].options[0]).toMatchObject({
      label: 'l',
      target: { type: 'jump', sequence: '' },
      check: ''
    })
  })
})

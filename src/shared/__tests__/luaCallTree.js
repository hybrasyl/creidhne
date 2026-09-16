import luaparse from 'luaparse'

// Test helper: the dialog CALL TREE of a Lua script, independent of variable
// names, comments, blank lines and the order of registration. This is what
// "the emitter reproduces Narve" means — byte-identical output was never the
// target (banners and variable names differ), the constructed tree is.
//
// Understands exactly the vocabulary the corpus uses: string tables,
// NewDialogOptions/AddOption, NewDialogSequence with the five dialog
// constructors, RegisterSequence / RegisterGlobalSequence / AddPursuit /
// AddMenuCheckExpression / SetDisplayName / SetNpcDisplaySprite /
// AssociateWithScript. Anything else is ignored.

export function dialogCallTree(source, { tableAlias = {} } = {}) {
  // 5.2: the corpus uses `\z` in long strings (MoonSharp accepts it), which
  // luaparse's 5.1 default refuses as an unfinished string.
  const ast = luaparse.parse(source, { comments: false, luaVersion: '5.2' })
  const rawTables = new Map() // name → { positional: [], keyed: {} }
  // `tableAlias` lets a module's `text[…]` (the merged copy, built at runtime)
  // read through to its `defaults` table.
  const tables = {
    get: (n) => rawTables.get(tableAlias[n] ?? n),
    set: (n, t) => rawTables.set(n, t)
  }
  const optionSets = new Map() // var → [ { label, target, check? } ]
  const seqVars = new Map() // var → sequence name
  const sequences = new Map() // name → { dialogs, scope, menuCheck, ... }

  const literal = (node) => {
    if (!node) return undefined
    if (node.type === 'StringLiteral') return unquote(node.raw)
    if (node.type === 'NumericLiteral') return node.value
    if (node.type === 'NilLiteral') return null
    if (node.type === 'IndexExpression' && node.base.type === 'Identifier') {
      const t = tables.get(node.base.name)
      const i = literal(node.index)
      return t ? t.positional[i - 1] : `<${node.base.name}[${i}]>`
    }
    // `tbl.key[2]`: a keyed entry that is itself an array (text keyed by sequence).
    if (
      node.type === 'IndexExpression' &&
      node.base.type === 'MemberExpression' &&
      node.base.base.type === 'Identifier'
    ) {
      const t = tables.get(node.base.base.name)
      const arr = t?.keyed[node.base.identifier.name]
      const i = literal(node.index)
      return Array.isArray(arr)
        ? arr[i - 1]
        : `<${node.base.base.name}.${node.base.identifier.name}[${i}]>`
    }
    if (node.type === 'MemberExpression' && node.base.type === 'Identifier') {
      const t = tables.get(node.base.name)
      return t ? t.keyed[node.identifier.name] : `<${node.base.name}.${node.identifier.name}>`
    }
    if (node.type === 'Identifier') return `<${node.name}>`
    return `<${node.type}>`
  }

  const callee = (call) => {
    const b = call.base
    if (b.type === 'MemberExpression' && b.base.type === 'Identifier') {
      return { obj: b.base.name, method: b.identifier.name }
    }
    return null
  }

  const dialogOf = (node) => {
    if (node.type !== 'CallExpression') return { kind: `<${node.type}>` }
    const c = callee(node)
    const a = node.arguments
    if (!c || c.obj !== 'world') return { kind: `<${c?.method}>` }
    switch (c.method) {
      case 'NewDialog':
        return { kind: 'text', text: literal(a[0]), callback: literal(a[1]) || '' }
      case 'NewJumpDialog':
        return { kind: 'jump', sequence: literal(a[0]), callback: literal(a[1]) || '' }
      case 'NewFunctionDialog':
        return { kind: 'function', expr: literal(a[0]) }
      case 'NewOptionsDialog':
        return {
          kind: 'options',
          text: literal(a[0]),
          options:
            a[1]?.type === 'Identifier' ? (optionSets.get(a[1].name) ?? '<unknown>') : '<inline>',
          callback: literal(a[2]) || '',
          handler: literal(a[3]) || ''
        }
      case 'NewTextDialog':
        return {
          kind: 'input',
          text: literal(a[0]),
          topCaption: literal(a[1]) ?? '',
          bottomCaption: literal(a[2]) ?? '',
          maxLength: literal(a[3]) ?? 254,
          callback: literal(a[4]) || '',
          handler: literal(a[5]) || ''
        }
      default:
        return { kind: `<${c.method}>` }
    }
  }

  const visit = (statements) => {
    for (const st of statements) {
      if (st.type === 'FunctionDeclaration') {
        visit(st.body)
        continue
      }
      if (st.type === 'AssignmentStatement' || st.type === 'LocalStatement') {
        const target = st.variables[0]
        const init = st.init[0]
        if (!init || target.type !== 'Identifier') continue
        const name = target.name
        if (init.type === 'TableConstructorExpression') {
          const t = { positional: [], keyed: {} }
          for (const f of init.fields) {
            if (f.type === 'TableValue') t.positional.push(literal(f.value))
            else if (f.type === 'TableKeyString') {
              t.keyed[f.key.name] =
                f.value.type === 'TableConstructorExpression'
                  ? f.value.fields.map((g) => literal(g.value))
                  : literal(f.value)
            }
          }
          tables.set(name, t)
          continue
        }
        if (init.type !== 'CallExpression') continue
        const c = callee(init)
        if (!c || c.obj !== 'world') continue
        if (c.method === 'NewDialogOptions') optionSets.set(name, [])
        if (c.method === 'NewDialogSequence') {
          const seqName = literal(init.arguments[0])
          seqVars.set(name, seqName)
          sequences.set(seqName, {
            dialogs: init.arguments.slice(1).map(dialogOf),
            scope: 'unregistered',
            menuCheck: ''
          })
        }
        continue
      }
      if (st.type === 'CallStatement') {
        const call = st.expression
        const c = callee(call)
        if (!c) continue
        const a = call.arguments
        if (c.method === 'AddOption' && optionSets.has(c.obj)) {
          const t = a[1]
          const target =
            t?.type === 'StringLiteral'
              ? { type: 'callback', expr: unquote(t.raw) }
              : t?.type === 'CallExpression' && callee(t)?.method === 'NewJumpDialog'
                ? { type: 'jump', sequence: literal(t.arguments[0]) }
                : { type: `<${t?.type}>` }
          optionSets.get(c.obj).push({ label: literal(a[0]), target, check: literal(a[2]) || '' })
          continue
        }
        const seqOf = (node) =>
          node?.type === 'Identifier' ? sequences.get(seqVars.get(node.name)) : null
        if (c.obj === 'origin' && c.method === 'RegisterSequence') {
          const s = seqOf(a[0])
          if (s) s.scope = 'local'
        } else if (c.obj === 'world' && c.method === 'RegisterGlobalSequence') {
          const s = seqOf(a[0])
          if (s) s.scope = 'global'
        } else if (c.obj === 'origin' && c.method === 'AddPursuit') {
          const s = seqOf(a[0])
          if (s) s.scope = 'pursuit'
        } else if (seqVars.has(c.obj)) {
          const s = sequences.get(seqVars.get(c.obj))
          if (c.method === 'AddMenuCheckExpression') s.menuCheck = literal(a[0])
          if (c.method === 'SetDisplayName') s.displayName = literal(a[0])
          if (c.method === 'SetNpcDisplaySprite') s.sprite = literal(a[0])
          if (c.method === 'AssociateWithScript') s.associateWithScript = true
        }
      }
    }
  }
  visit(ast.body)

  // A plain object, sorted by sequence name, so two trees compare with toEqual.
  const out = {}
  for (const name of [...sequences.keys()].sort()) out[name] = sequences.get(name)
  return out
}

function unquote(raw) {
  // luaparse keeps the raw literal; evaluate the escapes a double-quoted Lua
  // string can carry in this corpus. `\z` skips following whitespace.
  const q = raw[0]
  const body = raw.slice(1, -1)
  return body
    .replace(/\\(z\s*|n|r|t|\\|"|')/g, (_, e) => {
      if (e.startsWith('z')) return ''
      return { n: '\n', r: '\r', t: '\t', '\\': '\\', '"': '"', "'": "'" }[e]
    })
    .replace(q === "'" ? /\\'/g : /\\"/g, q)
}

/**
 * Hand-rolled NCalc-subset evaluator for the damage calculator preview.
 *
 * **Not authoritative** — the server uses NCalc. This covers the arithmetic
 * + function surface that actually shows up in Hybrasyl formulas. Anything
 * weirder (boolean operators, date funcs, string coercion) isn't supported
 * and will throw a clear error so the UI can tell the user "can't preview
 * this formula locally".
 *
 * Where it does accept a formula, it follows the server: NCalcSync 6.3.1 with
 * `OverflowProtection | RoundAwayFromZero` (HTOO-578). Each rule below was
 * measured against that package, not read from its docs. The preview used to
 * be looser than the server, and in exactly the direction that hides a fault:
 * it read `^` as a power and accepted `round(x)`, which the server evaluates
 * as XOR and as an error.
 *
 * Supported:
 *   numbers: 1, 2.5, .5, 1e3
 *   variables: SOURCESTR, RAND_100, ANY_IDENT (uppercase + digits + _)
 *   binary:   + - * / %       (standard precedence)
 *   power:    **              (right-assoc, tighter than unary minus:
 *                              -2 ** 2 is -4, 2 ** -1 is 0.5)
 *   relational: < > <= >= == !=   (lower precedence, yields 1 or 0)
 *   unary:    -x
 *   parens:   (...)
 *   functions, each with NCalc's exact argument count:
 *              Abs(x), Ceiling(x), Floor(x), Sign(x), Sqrt(x), Truncate(x),
 *              Max(a, b), Min(a, b), Pow(x, y), Round(x, digits),
 *              if(cond, a, b)
 *
 * Rejected, because the server would not compute what the author means:
 *   `^`  is bitwise XOR in NCalc (5 ^ 2 is 7). Use `**` for a power.
 *   Round(x) needs its digits: NCalc throws on one argument.
 *   Ceil, variadic Max/Min: not NCalc. The server throws.
 *   A division by zero, or a result that is not a finite number: the server
 *   catches it and the formula evaluates to 0.
 *
 * Function names match in any case, as on a server with
 * `IgnoreCaseAtBuiltInFunctions` (eriscorp/hybrasyl-server a0387f57). A
 * server without that flag dispatches math functions in PascalCase and `if`
 * in lowercase only, so Creidhne's own templates write `Max(`.
 *
 * Evaluation tolerates missing variables: they throw a named error so the
 * caller can surface "variable X unset in this context" to the user.
 */

// ── Tokenizer ────────────────────────────────────────────────────────────────

const TOKEN_RE =
  /\s*(?:(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(\*\*|<=|>=|==|!=|[()+\-*/%^<>,]))/y

export function tokenize(input) {
  const tokens = []
  TOKEN_RE.lastIndex = 0
  let lastIndex = 0
  while (TOKEN_RE.lastIndex < input.length) {
    const m = TOKEN_RE.exec(input)
    if (!m) {
      // Skip pure whitespace at end, otherwise fail
      if (/^\s*$/.test(input.slice(lastIndex))) break
      throw new Error(
        `Unexpected token at position ${lastIndex}: "${input.slice(lastIndex, lastIndex + 8)}"`
      )
    }
    if (m[1] !== undefined) tokens.push({ type: 'num', value: Number(m[1]) })
    else if (m[2] !== undefined) tokens.push({ type: 'ident', value: m[2] })
    else if (m[3] === '^') {
      throw new Error('"^" is bitwise XOR on the server (5 ^ 2 is 7). Use "**" for a power.')
    } else tokens.push({ type: 'op', value: m[3] })
    lastIndex = TOKEN_RE.lastIndex
  }
  return tokens
}

// ── Parser ───────────────────────────────────────────────────────────────────

function parse(tokens) {
  let pos = 0
  const peek = () => tokens[pos]
  const eat = (expected) => {
    const t = tokens[pos]
    if (!t) throw new Error(`Unexpected end of expression (expected ${expected})`)
    if (expected && t.value !== expected && t.type !== expected) {
      throw new Error(`Expected "${expected}" at position ${pos}, got "${t.value}"`)
    }
    pos += 1
    return t
  }

  function parseRel() {
    let left = parseAdd()
    const t = peek()
    if (t && t.type === 'op' && ['<', '>', '<=', '>=', '==', '!='].includes(t.value)) {
      eat()
      const right = parseAdd()
      left = { type: 'binop', op: t.value, left, right }
    }
    return left
  }

  function parseAdd() {
    let left = parseMul()
    while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = eat().value
      const right = parseMul()
      left = { type: 'binop', op, left, right }
    }
    return left
  }

  function parseMul() {
    let left = parseUnary()
    while (peek() && peek().type === 'op' && ['*', '/', '%'].includes(peek().value)) {
      const op = eat().value
      const right = parseUnary()
      left = { type: 'binop', op, left, right }
    }
    return left
  }

  // Unary minus binds looser than `**`, as in NCalc: -2 ** 2 is -(2 ** 2).
  function parseUnary() {
    if (peek() && peek().type === 'op' && peek().value === '-') {
      eat()
      return { type: 'unary', op: '-', arg: parseUnary() }
    }
    return parsePow()
  }

  // The exponent is a unary, so 2 ** -1 parses and 2 ** 3 ** 2 is 2 ** 9.
  function parsePow() {
    const left = parsePrimary()
    if (peek() && peek().type === 'op' && peek().value === '**') {
      eat()
      const right = parseUnary()
      return { type: 'binop', op: '**', left, right }
    }
    return left
  }

  function parsePrimary() {
    const t = peek()
    if (!t) throw new Error('Unexpected end of expression')
    if (t.type === 'num') {
      eat()
      return { type: 'num', value: t.value }
    }
    if (t.type === 'op' && t.value === '(') {
      eat('(')
      const inner = parseRel()
      eat(')')
      return inner
    }
    if (t.type === 'ident') {
      eat()
      if (peek() && peek().type === 'op' && peek().value === '(') {
        eat('(')
        const args = []
        if (!(peek() && peek().type === 'op' && peek().value === ')')) {
          args.push(parseRel())
          while (peek() && peek().type === 'op' && peek().value === ',') {
            eat(',')
            args.push(parseRel())
          }
        }
        eat(')')
        return { type: 'call', name: t.value, args }
      }
      return { type: 'var', name: t.value }
    }
    throw new Error(`Unexpected token "${t.value}"`)
  }

  const ast = parseRel()
  if (pos < tokens.length) {
    throw new Error(`Extra tokens after expression (starting at "${tokens[pos].value}")`)
  }
  return ast
}

// ── Evaluator ────────────────────────────────────────────────────────────────

/** .NET's Math.Round(x, digits, MidpointRounding.AwayFromZero), step for step. */
export function roundAwayFromZero(x, digits) {
  const p = 10 ** digits
  const scaled = x * p
  const whole = Math.trunc(scaled)
  const fraction = scaled - whole
  return (Math.abs(fraction) >= 0.5 ? whole + Math.sign(fraction) : whole) / p
}

// Keyed by the lower-cased name; `name` is NCalc's spelling, for messages.
const FUNCTIONS = {
  abs: { name: 'Abs', arity: 1, fn: Math.abs },
  ceiling: { name: 'Ceiling', arity: 1, fn: Math.ceil },
  floor: { name: 'Floor', arity: 1, fn: Math.floor },
  max: { name: 'Max', arity: 2, fn: Math.max },
  min: { name: 'Min', arity: 2, fn: Math.min },
  pow: { name: 'Pow', arity: 2, fn: Math.pow },
  round: { name: 'Round', arity: 2, fn: roundAwayFromZero },
  sign: { name: 'Sign', arity: 1, fn: Math.sign },
  sqrt: { name: 'Sqrt', arity: 1, fn: Math.sqrt },
  truncate: { name: 'Truncate', arity: 1, fn: Math.trunc }
  // `if` is special-cased in the evaluator so condition short-circuits
}

function arityError(name, arity) {
  const hint = name === 'Round' ? ' Give the digits too: Round(x, 0) rounds to a whole number.' : ''
  return new Error(
    `${name}() takes exactly ${arity} argument${arity === 1 ? '' : 's'} on the server.${hint}`
  )
}

export class UnknownVariableError extends Error {
  constructor(name) {
    super(`Unknown variable: ${name}`)
    this.name = 'UnknownVariableError'
    this.variable = name
  }
}

export class UnknownFunctionError extends Error {
  constructor(name) {
    super(`Unknown function: ${name}`)
    this.name = 'UnknownFunctionError'
    this.function = name
  }
}

/** The formula evaluates to 0 on the server, because NCalc or Hybrasyl rejects the result. */
export class ServerZeroError extends Error {
  constructor(reason) {
    super(`${reason}: the server evaluates this formula to 0`)
    this.name = 'ServerZeroError'
  }
}

function evalNode(node, vars) {
  switch (node.type) {
    case 'num':
      return node.value
    case 'var': {
      if (!(node.name in vars)) throw new UnknownVariableError(node.name)
      return Number(vars[node.name])
    }
    case 'unary': {
      const v = evalNode(node.arg, vars)
      return node.op === '-' ? -v : v
    }
    case 'binop': {
      const l = evalNode(node.left, vars)
      const r = evalNode(node.right, vars)
      switch (node.op) {
        case '+':
          return l + r
        case '-':
          return l - r
        case '*':
          return l * r
        case '/':
          if (r === 0) throw new ServerZeroError('Division by zero')
          return l / r
        case '%':
          if (r === 0) throw new ServerZeroError('Division by zero')
          return l % r
        case '**':
          return Math.pow(l, r)
        case '<':
          return l < r ? 1 : 0
        case '>':
          return l > r ? 1 : 0
        case '<=':
          return l <= r ? 1 : 0
        case '>=':
          return l >= r ? 1 : 0
        case '==':
          return l === r ? 1 : 0
        case '!=':
          return l !== r ? 1 : 0
        default:
          throw new Error(`Unknown operator: ${node.op}`)
      }
    }
    case 'call': {
      const name = node.name.toLowerCase()
      if (name === 'if') {
        if (node.args.length !== 3) throw new Error('if() requires exactly 3 arguments')
        const cond = evalNode(node.args[0], vars)
        return evalNode(cond !== 0 ? node.args[1] : node.args[2], vars)
      }
      const def = FUNCTIONS[name]
      if (!def) throw new UnknownFunctionError(node.name)
      if (node.args.length !== def.arity) throw arityError(def.name, def.arity)
      const args = node.args.map((a) => evalNode(a, vars))
      return def.fn(...args)
    }
    default:
      throw new Error(`Unknown node type: ${node.type}`)
  }
}

/**
 * Check every call's name and argument count, so a formula the server cannot
 * evaluate fails at compile time with one message, not once per preview cell.
 */
function checkCalls(node) {
  if (!node) return
  switch (node.type) {
    case 'unary':
      checkCalls(node.arg)
      break
    case 'binop':
      checkCalls(node.left)
      checkCalls(node.right)
      break
    case 'call': {
      const name = node.name.toLowerCase()
      if (name === 'if') {
        if (node.args.length !== 3) throw new Error('if() requires exactly 3 arguments')
      } else {
        const def = FUNCTIONS[name]
        if (!def) throw new UnknownFunctionError(node.name)
        if (node.args.length !== def.arity) throw arityError(def.name, def.arity)
      }
      for (const a of node.args) checkCalls(a)
      break
    }
    default: /* num, var */
  }
}

/** Walk an AST and return a Set of all variable names referenced. */
function collectVariables(node, out = new Set()) {
  if (!node) return out
  switch (node.type) {
    case 'var':
      out.add(node.name)
      break
    case 'unary':
      collectVariables(node.arg, out)
      break
    case 'binop':
      collectVariables(node.left, out)
      collectVariables(node.right, out)
      break
    case 'call':
      for (const a of node.args) collectVariables(a, out)
      break
    default: /* num — no vars */
  }
  return out
}

/**
 * Parse an expression once; return a function that evaluates it with a vars
 * map, plus the Set of variable names referenced (for pre-flight UX like
 * "which variables does this formula need?").
 */
export function compile(expression) {
  const tokens = tokenize(expression)
  const ast = parse(tokens)
  checkCalls(ast)
  const fn = (vars) => {
    const result = evalNode(ast, vars)
    // Hybrasyl's FormulaParser.Eval returns 0 for NaN and the infinities.
    if (!Number.isFinite(result)) throw new ServerZeroError('Not a finite number')
    return result
  }
  fn.variables = collectVariables(ast)
  return fn
}

/** Return the variable names referenced by an expression, without evaluating. */
export function variablesUsed(expression) {
  const tokens = tokenize(expression)
  const ast = parse(tokens)
  return collectVariables(ast)
}

/** One-shot: tokenize + parse + evaluate. Throws on any error. */
export function evaluate(expression, vars = {}) {
  return compile(expression)(vars)
}

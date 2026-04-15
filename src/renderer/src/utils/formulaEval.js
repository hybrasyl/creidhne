/**
 * Hand-rolled NCalc-subset evaluator for the damage calculator preview.
 *
 * **Not authoritative** — the server uses NCalc. This covers the arithmetic
 * + function surface that actually shows up in Hybrasyl formulas. Anything
 * weirder (boolean operators, date funcs, string coercion) isn't supported
 * and will throw a clear error so the UI can tell the user "can't preview
 * this formula locally".
 *
 * Supported:
 *   numbers: 1, 2.5, .5, 1e3
 *   variables: SOURCESTR, RAND_100, ANY_IDENT (uppercase + digits + _)
 *   binary:   + - * / % ^    (with standard precedence, ^ is right-assoc)
 *   relational: < > <= >= == !=   (lower precedence, yields 1 or 0)
 *   unary:    -x
 *   parens:   (...)
 *   functions: min(a,b,...), max(a,b,...), floor(x), ceil(x), round(x),
 *              abs(x), sqrt(x), if(cond, a, b)
 *
 * Evaluation tolerates missing variables: they throw a named error so the
 * caller can surface "variable X unset in this context" to the user.
 */

// ── Tokenizer ────────────────────────────────────────────────────────────────

const TOKEN_RE = /\s*(?:(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(<=|>=|==|!=|[()+\-*/%^<>,]))/y;

export function tokenize(input) {
  const tokens = [];
  TOKEN_RE.lastIndex = 0;
  let lastIndex = 0;
  while (TOKEN_RE.lastIndex < input.length) {
    const m = TOKEN_RE.exec(input);
    if (!m) {
      // Skip pure whitespace at end, otherwise fail
      if (/^\s*$/.test(input.slice(lastIndex))) break;
      throw new Error(`Unexpected token at position ${lastIndex}: "${input.slice(lastIndex, lastIndex + 8)}"`);
    }
    if (m[1] !== undefined) tokens.push({ type: 'num', value: Number(m[1]) });
    else if (m[2] !== undefined) tokens.push({ type: 'ident', value: m[2] });
    else tokens.push({ type: 'op', value: m[3] });
    lastIndex = TOKEN_RE.lastIndex;
  }
  return tokens;
}

// ── Parser ───────────────────────────────────────────────────────────────────

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = (expected) => {
    const t = tokens[pos];
    if (!t) throw new Error(`Unexpected end of expression (expected ${expected})`);
    if (expected && t.value !== expected && t.type !== expected) {
      throw new Error(`Expected "${expected}" at position ${pos}, got "${t.value}"`);
    }
    pos += 1;
    return t;
  };

  function parseRel() {
    let left = parseAdd();
    const t = peek();
    if (t && t.type === 'op' && ['<', '>', '<=', '>=', '==', '!='].includes(t.value)) {
      eat();
      const right = parseAdd();
      left = { type: 'binop', op: t.value, left, right };
    }
    return left;
  }

  function parseAdd() {
    let left = parseMul();
    while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = eat().value;
      const right = parseMul();
      left = { type: 'binop', op, left, right };
    }
    return left;
  }

  function parseMul() {
    let left = parsePow();
    while (peek() && peek().type === 'op' && ['*', '/', '%'].includes(peek().value)) {
      const op = eat().value;
      const right = parsePow();
      left = { type: 'binop', op, left, right };
    }
    return left;
  }

  function parsePow() {
    const left = parseUnary();
    if (peek() && peek().type === 'op' && peek().value === '^') {
      eat();
      const right = parsePow(); // right-assoc
      return { type: 'binop', op: '^', left, right };
    }
    return left;
  }

  function parseUnary() {
    if (peek() && peek().type === 'op' && peek().value === '-') {
      eat();
      return { type: 'unary', op: '-', arg: parseUnary() };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error('Unexpected end of expression');
    if (t.type === 'num') { eat(); return { type: 'num', value: t.value }; }
    if (t.type === 'op' && t.value === '(') {
      eat('(');
      const inner = parseRel();
      eat(')');
      return inner;
    }
    if (t.type === 'ident') {
      eat();
      if (peek() && peek().type === 'op' && peek().value === '(') {
        eat('(');
        const args = [];
        if (!(peek() && peek().type === 'op' && peek().value === ')')) {
          args.push(parseRel());
          while (peek() && peek().type === 'op' && peek().value === ',') {
            eat(',');
            args.push(parseRel());
          }
        }
        eat(')');
        return { type: 'call', name: t.value, args };
      }
      return { type: 'var', name: t.value };
    }
    throw new Error(`Unexpected token "${t.value}"`);
  }

  const ast = parseRel();
  if (pos < tokens.length) {
    throw new Error(`Extra tokens after expression (starting at "${tokens[pos].value}")`);
  }
  return ast;
}

// ── Evaluator ────────────────────────────────────────────────────────────────

const FUNCTIONS = {
  min:   (...a) => Math.min(...a),
  max:   (...a) => Math.max(...a),
  floor: (x) => Math.floor(x),
  ceil:  (x) => Math.ceil(x),
  round: (x) => Math.round(x),
  abs:   (x) => Math.abs(x),
  sqrt:  (x) => Math.sqrt(x),
  // `if` is special-cased in the evaluator so condition short-circuits
};

export class UnknownVariableError extends Error {
  constructor(name) {
    super(`Unknown variable: ${name}`);
    this.name = 'UnknownVariableError';
    this.variable = name;
  }
}

export class UnknownFunctionError extends Error {
  constructor(name) {
    super(`Unknown function: ${name}`);
    this.name = 'UnknownFunctionError';
    this.function = name;
  }
}

function evalNode(node, vars) {
  switch (node.type) {
    case 'num': return node.value;
    case 'var': {
      if (!(node.name in vars)) throw new UnknownVariableError(node.name);
      return Number(vars[node.name]);
    }
    case 'unary': {
      const v = evalNode(node.arg, vars);
      return node.op === '-' ? -v : v;
    }
    case 'binop': {
      const l = evalNode(node.left, vars);
      const r = evalNode(node.right, vars);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return l / r;
        case '%': return l % r;
        case '^': return Math.pow(l, r);
        case '<': return l <  r ? 1 : 0;
        case '>': return l >  r ? 1 : 0;
        case '<=': return l <= r ? 1 : 0;
        case '>=': return l >= r ? 1 : 0;
        case '==': return l === r ? 1 : 0;
        case '!=': return l !== r ? 1 : 0;
        default: throw new Error(`Unknown operator: ${node.op}`);
      }
    }
    case 'call': {
      const name = node.name.toLowerCase();
      if (name === 'if') {
        if (node.args.length !== 3) throw new Error('if() requires exactly 3 arguments');
        const cond = evalNode(node.args[0], vars);
        return evalNode(cond !== 0 ? node.args[1] : node.args[2], vars);
      }
      const fn = FUNCTIONS[name];
      if (!fn) throw new UnknownFunctionError(node.name);
      const args = node.args.map((a) => evalNode(a, vars));
      return fn(...args);
    }
    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

/** Walk an AST and return a Set of all variable names referenced. */
function collectVariables(node, out = new Set()) {
  if (!node) return out;
  switch (node.type) {
    case 'var': out.add(node.name); break;
    case 'unary': collectVariables(node.arg, out); break;
    case 'binop': collectVariables(node.left, out); collectVariables(node.right, out); break;
    case 'call': for (const a of node.args) collectVariables(a, out); break;
    default: /* num — no vars */
  }
  return out;
}

/**
 * Parse an expression once; return a function that evaluates it with a vars
 * map, plus the Set of variable names referenced (for pre-flight UX like
 * "which variables does this formula need?").
 */
export function compile(expression) {
  const tokens = tokenize(expression);
  const ast = parse(tokens);
  const fn = (vars) => evalNode(ast, vars);
  fn.variables = collectVariables(ast);
  return fn;
}

/** Return the variable names referenced by an expression, without evaluating. */
export function variablesUsed(expression) {
  const tokens = tokenize(expression);
  const ast = parse(tokens);
  return collectVariables(ast);
}

/** One-shot: tokenize + parse + evaluate. Throws on any error. */
export function evaluate(expression, vars = {}) {
  return compile(expression)(vars);
}

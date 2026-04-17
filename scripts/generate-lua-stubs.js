const fs = require('fs');
const path = require('path');

// --- Configuration ---
const serverRoot = process.argv[2] || path.join(__dirname, '..', '..', 'server', 'hybrasyl');
const outputDir = process.argv[3] || path.join(__dirname, '..', 'lua-stubs');

console.log(`Scanning: ${serverRoot}`);
console.log(`Output:   ${outputDir}`);

// --- C# to Lua type mapping ---
const typeMap = {
  void: 'nil',
  string: 'string',
  bool: 'boolean',
  int: 'number',
  uint: 'number',
  long: 'number',
  ulong: 'number',
  short: 'number',
  ushort: 'number',
  byte: 'number',
  float: 'number',
  double: 'number',
  decimal: 'number',
  object: 'any',
  dynamic: 'any'
};

function mapType(csType) {
  if (!csType) return 'any';
  csType = csType.trim();

  // Nullable<T> or T?
  if (csType.endsWith('?')) return mapType(csType.slice(0, -1)) + '?';
  const nullableMatch = csType.match(/^Nullable<(.+)>$/);
  if (nullableMatch) return mapType(nullableMatch[1]) + '?';

  // List<T>, IEnumerable<T>, IList<T>, ICollection<T>, T[]
  if (csType.endsWith('[]')) return mapType(csType.slice(0, -2)) + '[]';
  const listMatch = csType.match(/^(?:List|IList|IEnumerable|ICollection)<(.+)>$/);
  if (listMatch) return mapType(listMatch[1]) + '[]';

  // Dictionary<K,V>
  const dictMatch = csType.match(/^(?:Dictionary|IDictionary)<(.+),\s*(.+)>$/);
  if (dictMatch) return `table<${mapType(dictMatch[1])}, ${mapType(dictMatch[2])}>`;

  // Direct map
  if (typeMap[csType]) return typeMap[csType];

  // Strip namespace prefix (e.g. Hybrasyl.Xml.Objects.Gender -> Gender)
  const shortName = csType.split('.').pop();
  if (typeMap[shortName]) return typeMap[shortName];

  // Known Hybrasyl types stay as-is (will reference other stub classes)
  return shortName;
}

// --- Find all .cs files recursively ---
function findCsFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'bin' && entry.name !== 'obj') {
      results = results.concat(findCsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.cs')) {
      results.push(fullPath);
    }
  }
  return results;
}

// --- Parse a single C# file ---
function parseFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Quick check: does this file contain [MoonSharpUserData]?
  if (!content.includes('[MoonSharpUserData]')) return [];

  const lines = content.split(/\r?\n/);
  const classes = [];
  let currentClass = null;
  let docBuffer = [];
  let braceDepth = 0;
  let classBodyDepth = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track brace depth
    for (const ch of trimmed) {
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth--;
    }

    // Accumulate doc comments
    if (trimmed.startsWith('///')) {
      docBuffer.push(trimmed);
      continue;
    }

    // Detect [MoonSharpUserData] then look for class declaration
    if (trimmed === '[MoonSharpUserData]') {
      // Next non-attribute, non-empty line should be the class
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j].trim();
        if (!next || next.startsWith('[') || next.startsWith('//')) continue;
        const classMatch = next.match(/public\s+(?:sealed\s+|abstract\s+|static\s+)*(?:class|record)\s+(\w+)(?:\s*:\s*(.+))?/);
        if (classMatch) {
          currentClass = {
            name: classMatch[1],
            base: classMatch[2]?.split(',').map(s => s.trim()).filter(s => !s.startsWith('I')) || [],
            doc: extractSummary(docBuffer),
            properties: [],
            methods: [],
            file: path.relative(serverRoot, filePath).replace(/\\/g, '/')
          };
          classes.push(currentClass);
          classBodyDepth = braceDepth;
        }
        break;
      }
      docBuffer = [];
      continue;
    }

    // If we're not inside a class, skip
    if (!currentClass) {
      docBuffer = [];
      continue;
    }

    // Detect end of class
    if (braceDepth < classBodyDepth) {
      currentClass = null;
      classBodyDepth = -1;
      docBuffer = [];
      continue;
    }

    // Only parse top-level class members (not nested method bodies)
    if (braceDepth > classBodyDepth + 1) {
      docBuffer = [];
      continue;
    }

    // Parse property: public Type Name => ... or public Type Name { get;
    // Also handles multi-line declarations where { is on the next line
    // (common in StatInfo.cs where properties use lock() bodies).
    // Guard: exclude methods by checking for '(' BEFORE '=>' or '{' in the
    // declaration part — parens in the expression body are OK.
    // Strip leading [Attribute] prefixes for cases like
    //   [FormulaVariable] public double Dodge => BaseDodge + BonusDodge;
    const propLine = trimmed.replace(/^(\[[^\]]*\]\s*)+/, '');
    // Match properties (=> or {) AND public fields (ending with ;)
    const propMatch = propLine.match(
      /^public\s+(?:new\s+|override\s+|virtual\s+|static\s+)*(\S+)\s+(\w+)\s*(?:=>|{|;)/
    );
    const propMatchMultiLine = !propMatch && propLine.match(
      /^public\s+(?:new\s+|override\s+|virtual\s+|static\s+)*(\S+)\s+(\w+)\s*$/
    );
    const resolvedPropMatch = propMatch || (
      propMatchMultiLine &&
      i + 1 < lines.length && lines[i + 1].trim().startsWith('{')
        ? propMatchMultiLine : null
    );
    // Exclude methods: if '(' appears before the '=>' or '{', it's a method, not a property
    const declPart = resolvedPropMatch ? propLine.split(/=>|{/)[0] : '';
    if (resolvedPropMatch && !declPart.includes('(')) {
      currentClass.properties.push({
        name: resolvedPropMatch[2],
        type: resolvedPropMatch[1],
        doc: extractSummary(docBuffer)
      });
      docBuffer = [];
      continue;
    }

    // Parse method: public ReturnType MethodName(params...)
    // Handle multi-line by joining if parens don't close
    let methodLine = trimmed;
    if (methodLine.includes('(') && !methodLine.includes(')')) {
      for (let j = i + 1; j < lines.length && !methodLine.includes(')'); j++) {
        methodLine += ' ' + lines[j].trim();
      }
    }

    const methodMatch = methodLine.match(
      /^public\s+(?:new\s+|override\s+|virtual\s+|static\s+|async\s+)*(\S+)\s+(\w+)\s*\(([^)]*)\)/
    );
    if (methodMatch) {
      const returnType = methodMatch[1];
      const methodName = methodMatch[2];
      const rawParams = methodMatch[3];

      // Skip property accessors and constructors
      if (methodName === currentClass.name) {
        docBuffer = [];
        continue;
      }

      const params = rawParams
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => {
          // Handle default values: Type name = default
          const hasDefault = p.includes('=');
          const isVariadic = p.includes('params ');
          const withoutDefault = p.split('=')[0].trim();
          const parts = withoutDefault.split(/\s+/);
          const paramName = parts.pop();
          const paramType = parts.filter(s => s !== 'params' && s !== 'this').join(' ');
          return { name: paramName, type: paramType, optional: hasDefault, variadic: isVariadic };
        });

      currentClass.methods.push({
        name: methodName,
        returnType,
        params,
        doc: extractDoc(docBuffer)
      });
      docBuffer = [];
      continue;
    }

    // Reset doc buffer for non-matching lines
    if (!trimmed.startsWith('//') && trimmed.length > 0) {
      docBuffer = [];
    }
  }

  return classes;
}

// --- Extract summary text from doc comment lines ---
function extractSummary(docLines) {
  if (!docLines.length) return null;
  const text = docLines
    .map(l => l.replace(/^\/\/\/\s?/, ''))
    .join(' ')
    .replace(/<\/?summary>/g, '')
    .replace(/<see\s+cref="[^"]*">\s*/g, '')
    .replace(/<\/see>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

// --- Extract full doc (summary + params + returns) ---
function extractDoc(docLines) {
  if (!docLines.length) return { summary: null, params: {}, returns: null };

  const joined = docLines.map(l => l.replace(/^\/\/\/\s?/, '')).join('\n');

  // Summary
  const summaryMatch = joined.match(/<summary>([\s\S]*?)<\/summary>/);
  const summary = summaryMatch
    ? summaryMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    : null;

  // Params
  const params = {};
  const paramRegex = /<param\s+name="(\w+)">([\s\S]*?)<\/param>/g;
  let m;
  while ((m = paramRegex.exec(joined)) !== null) {
    params[m[1]] = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }

  // Returns
  const returnsMatch = joined.match(/<returns>([\s\S]*?)<\/returns>/);
  const returns = returnsMatch
    ? returnsMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    : null;

  return { summary, params, returns };
}

// --- Generate Lua stub for a class ---
function generateStub(cls) {
  const lines = [];

  // Header
  lines.push(`-- Generated from ${cls.file}`);
  lines.push(`-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js`);
  lines.push('');

  // Class annotation
  if (cls.doc) lines.push(`---${cls.doc}`);
  if (cls.base.length) {
    lines.push(`---@class ${cls.name} : ${cls.base[0]}`);
  } else {
    lines.push(`---@class ${cls.name}`);
  }

  // Properties as fields
  for (const prop of cls.properties) {
    if (prop.doc) lines.push(`---${prop.doc}`);
    lines.push(`---@field ${prop.name} ${mapType(prop.type)}`);
  }

  lines.push(`local ${cls.name} = {}`);
  lines.push('');

  // Methods
  for (const method of cls.methods) {
    lines.push('');
    if (method.doc.summary) lines.push(`---${method.doc.summary}`);

    for (const param of method.params) {
      const luaType = mapType(param.type);
      if (param.variadic) {
        const desc = method.doc.params[param.name] ? ` ${method.doc.params[param.name]}` : '';
        lines.push(`---@param ... ${luaType}${desc}`);
      } else {
        const optional = param.optional ? '?' : '';
        const desc = method.doc.params[param.name] ? ` ${method.doc.params[param.name]}` : '';
        lines.push(`---@param ${param.name}${optional} ${luaType}${desc}`);
      }
    }

    const retType = mapType(method.returnType);
    if (retType !== 'nil') {
      const retDesc = method.doc.returns ? ` ${method.doc.returns}` : '';
      lines.push(`---@return ${retType}${retDesc}`);
    }

    // Replace the variadic param name with `...` in the function signature
    const paramNames = method.params.map(p => p.variadic ? '...' : p.name).join(', ');
    lines.push(`function ${cls.name}.${method.name}(${paramNames}) end`);
  }

  lines.push('');
  lines.push(`return ${cls.name}`);
  lines.push('');

  return lines.join('\n');
}

// --- Generate todo-docs.md ---
function generateTodo(allClasses) {
  const lines = [];
  lines.push('# Documentation Gaps');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString().slice(0, 16)} UTC`);
  lines.push('');

  let totalGaps = 0;
  const classGaps = [];

  for (const cls of allClasses) {
    const gaps = [];

    if (!cls.doc) gaps.push({ member: '(class)', reason: 'Missing class summary' });

    for (const prop of cls.properties) {
      if (!prop.doc) gaps.push({ member: prop.name, reason: 'Missing property summary' });
    }

    for (const method of cls.methods) {
      if (!method.doc.summary) {
        gaps.push({ member: `${method.name}(${method.params.length} params)`, reason: 'Missing method summary' });
      }
      for (const param of method.params) {
        if (!method.doc.params[param.name]) {
          gaps.push({ member: `${method.name} → ${param.name}`, reason: 'Missing param description' });
        }
      }
      if (mapType(method.returnType) !== 'nil' && !method.doc.returns) {
        gaps.push({ member: `${method.name} → return`, reason: 'Missing return description' });
      }
    }

    if (gaps.length > 0) {
      classGaps.push({ name: cls.name, file: cls.file, gaps });
      totalGaps += gaps.length;
    }
  }

  // Sort by most gaps first
  classGaps.sort((a, b) => b.gaps.length - a.gaps.length);

  lines.push(`**${totalGaps}** documentation gaps across **${allClasses.length}** Lua-exposed types.`);
  lines.push('');

  for (const { name, file, gaps } of classGaps) {
    lines.push(`## ${name} (${gaps.length} gaps)`);
    lines.push(`Source: \`${file}\``);
    lines.push('');
    for (const gap of gaps) {
      lines.push(`- [ ] \`${gap.member}\` — ${gap.reason}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// --- Main ---
function main() {
  if (!fs.existsSync(serverRoot)) {
    console.error(`Server source not found at: ${serverRoot}`);
    console.error('Usage: node generate-lua-stubs.js [server-hybrasyl-path] [output-dir]');
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const csFiles = findCsFiles(serverRoot);
  console.log(`Found ${csFiles.length} .cs files`);

  const allClasses = [];
  for (const file of csFiles) {
    const classes = parseFile(file);
    allClasses.push(...classes);
  }

  console.log(`Found ${allClasses.length} [MoonSharpUserData] types:`);
  for (const cls of allClasses) {
    console.log(`  ${cls.name} (${cls.properties.length} props, ${cls.methods.length} methods)`);
  }

  // Files that have been manually enriched beyond what the generator produces.
  // These are skipped to preserve hand-added fields (e.g. StatInfo has stat
  // modifier properties that aren't decorated with [ScriptableProperty] in the
  // C# source, so the generator misses them).
  // If any stub needs manual enrichment that the generator can't capture,
  // add its class name here and maintain the .lua file by hand.
  const MANUALLY_MAINTAINED = new Set([]);

  // Write stubs
  for (const cls of allClasses) {
    if (MANUALLY_MAINTAINED.has(cls.name)) {
      console.log(`  ** ${cls.name}.lua — SKIPPED (manually maintained)`);
      continue;
    }
    const stub = generateStub(cls);
    const outPath = path.join(outputDir, `${cls.name}.lua`);
    fs.writeFileSync(outPath, stub);
    console.log(`  -> ${outPath}`);
  }

  // ── Enum scanning ────────────────────────────────────────────────────────
  // Scan Internals/Enums/ + XML enum types for C# enums exposed to Lua via
  // MoonSharp. Generates one _enums.lua file with all of them. Also scans
  // any other directories that contain enums used as property types in the
  // generated stubs (e.g. ElementType from the XML namespace).
  // Scan multiple directories for enum definitions. The xml repo is a sibling
  // to the server repo and contains enums like ElementType, Gender, Direction.
  const xmlRoot = process.argv[4] || path.join(serverRoot, '..', '..', 'xml');
  const enumDirs = [
    path.join(serverRoot, 'Internals', 'Enums'),
    path.join(xmlRoot, 'src', 'Objects'),  // ElementType, Gender, Direction, Class
  ];
  const enumPattern = /public\s+enum\s+(\w+)\s*(?::\s*\w+\s*)?\{([^}]+)\}/gs;
  const enumValuePattern = /^\s*(\w+)\s*(?:=\s*[^,\n]+)?/gm;
  const allEnums = [];

  for (const dir of enumDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.cs'))) {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      enumPattern.lastIndex = 0;
      let m;
      while ((m = enumPattern.exec(content)) !== null) {
        const enumName = m[1];
        const body = m[2];
        const values = [];
        enumValuePattern.lastIndex = 0;
        let vm;
        while ((vm = enumValuePattern.exec(body)) !== null) {
          if (vm[1] && !vm[1].startsWith('//')) values.push(vm[1]);
        }
        if (values.length) allEnums.push({ name: enumName, values, file });
      }
    }
  }

  if (allEnums.length) {
    const lines = [
      '---@meta',
      '---@diagnostic disable: missing-fields',
      '-- Auto-generated enum stubs from Hybrasyl C# source.',
      '-- MoonSharp exposes C# enums as table-like globals.',
      '',
    ];
    for (const e of allEnums) {
      lines.push(`---@class ${e.name}`);
      // Fields return the enum type itself (not number) so sumneko matches
      // e.g. Element.Fire : ElementType, which satisfies params typed as ElementType.
      for (const v of e.values) lines.push(`---@field ${v} ${e.name}`);
      lines.push('');
      lines.push(`---@type ${e.name}`);
      lines.push(`${e.name} = {}`);
      lines.push('');
    }
    const enumPath = path.join(outputDir, '_enums.lua');
    fs.writeFileSync(enumPath, lines.join('\n'));
    console.log(`\n  -> ${enumPath} (${allEnums.length} enums)`);
  }

  // Write todo
  const todo = generateTodo(allClasses);
  const todoPath = path.join(outputDir, 'todo-docs.md');
  fs.writeFileSync(todoPath, todo);

  const totalProps = allClasses.reduce((s, c) => s + c.properties.length, 0);
  const totalMethods = allClasses.reduce((s, c) => s + c.methods.length, 0);

  console.log(`\nDone! ${allClasses.length} stubs, ${totalProps} properties, ${totalMethods} methods, ${allEnums.length} enums`);
  console.log(`Doc gaps: ${todoPath}`);
}

main();

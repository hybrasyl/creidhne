import xml2js from 'xml2js';

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02';

const first = (arr, def = undefined) => Array.isArray(arr) && arr.length ? arr[0] : def;
const a = (node, key, def = '') => node?.$?.[key] ?? def;

// =============================================================================
// PARSER
// =============================================================================

export function parseElementTableXml(xmlString) {
  return new Promise((resolve, reject) => {
    const commentMatch = /<!--\s*Comment:\s*(.*?)\s*-->/.exec(xmlString);
    const comment = commentMatch ? commentMatch[1] : '';

    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err);
      try { resolve(mapXmlToElementTable(result, comment)); }
      catch (e) { reject(e); }
    });
  });
}

function mapXmlToElementTable(result, comment) {
  const root = result.ElementTable;
  const sources = root.Source || [];

  // Collect element names in source order
  const elements = sources.map((s) => a(s, 'Element', ''));

  // Build percentage matrix (integers: 80 = 0.8, 100 = 1.0, 150 = 1.5)
  const matrix = elements.map((_, si) => {
    const targets = sources[si].Target || [];
    return elements.map((targetName) => {
      const target = targets.find((t) => a(t, 'Element') === targetName);
      if (!target) return 100;
      const multiplier = parseFloat(a(target, 'Multiplier', '1'));
      return Math.round(multiplier * 100);
    });
  });

  return {
    name: a(root, 'Name', ''),
    comment,
    elements,
    matrix,
  };
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeElementTableXml(tableData) {
  const { name, comment, elements, matrix } = tableData;

  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' },
  });

  const sources = elements.map((elemName, si) => ({
    $: { Element: elemName },
    Target: elements.map((targetName, ti) => {
      const pct = matrix[si]?.[ti] ?? 100;
      const multiplier = parseFloat((pct / 100).toFixed(4)).toString();
      return { $: { Element: targetName, Multiplier: multiplier } };
    }),
  }));

  const obj = {
    ElementTable: {
      $: { xmlns: XMLNS, Name: name },
      Source: sources,
    },
  };

  let xml = builder.buildObject(obj);

  if (comment) {
    xml = xml.replace(/(<ElementTable[^>]*>)/, `$1\n  <!-- Comment: ${comment} -->`);
  }

  return xml + '\n';
}

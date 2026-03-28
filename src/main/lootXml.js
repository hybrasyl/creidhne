import xml2js from 'xml2js';
import { extractComment, injectComment } from './xmlCommentUtils.js';

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02';

const first = (arr, def = undefined) => Array.isArray(arr) && arr.length ? arr[0] : def;
const a = (node, key, def = '') => node?.$?.[key] ?? def;
const omitEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined));

// =============================================================================
// PARSER
// =============================================================================

export function parseLootXml(xmlString) {
  return new Promise((resolve, reject) => {
    const comment = extractComment(xmlString);
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err);
      try { resolve(mapXmlToLoot(result, comment)); }
      catch (e) { reject(e); }
    });
  });
}

function mapXmlToLoot(result, comment) {
  const root = result.LootSet;
  const table = first(root.Table);
  const gold = first(table?.Gold);
  const xp = first(table?.Xp);
  const items = first(table?.Items);

  return {
    name: a(root, 'Name', ''),
    comment,
    prefix: a(root, 'Prefix', ''),
    table: {
      rolls: a(table, 'Rolls', ''),
      chance: a(table, 'Chance', ''),
      gold: { min: a(gold, 'Min', ''), max: a(gold, 'Max', '') },
      xp: { min: a(xp, 'Min', ''), max: a(xp, 'Max', '') },
      items: {
        rolls: a(items, 'Rolls', ''),
        chance: a(items, 'Chance', ''),
        entries: (items?.Item || []).map((item) => ({
          name: typeof item === 'string' ? item : (item._ || ''),
          variants: a(item, 'Variants', '').split(' ').filter(Boolean),
          unique: a(item, 'Unique', 'true') === 'true',
          always: a(item, 'Always', 'true') === 'true',
          max: a(item, 'Max', ''),
        })),
      },
    },
  };
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeLootXml(loot) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' },
  });
  const xml = injectComment(builder.buildObject(buildXmlObject(loot)), loot.comment, 'LootSet');
  return xml + '\n';
}

function buildXmlObject(loot) {
  const { table } = loot;
  const tableNode = { $: omitEmpty({ Rolls: table.rolls, Chance: table.chance }) };

  if (table.gold.min || table.gold.max) {
    tableNode.Gold = [{ $: omitEmpty({ Min: table.gold.min, Max: table.gold.max }) }];
  }
  if (table.xp.min || table.xp.max) {
    tableNode.Xp = [{ $: omitEmpty({ Min: table.xp.min, Max: table.xp.max }) }];
  }

  if (table.items.entries.length > 0 || table.items.rolls || table.items.chance) {
    const itemsNode = { $: omitEmpty({ Rolls: table.items.rolls, Chance: table.items.chance }) };
    itemsNode.Item = table.items.entries.map((entry) => ({
      _: entry.name,
      $: omitEmpty({
        Max: entry.max,
        Variants: entry.variants.length ? entry.variants.join(' ') : undefined,
        Unique: String(entry.unique),
        Always: String(entry.always),
      }),
    }));
    tableNode.Items = [itemsNode];
  }

  return {
    LootSet: {
      $: omitEmpty({ xmlns: XMLNS, Name: loot.name, Prefix: loot.prefix }),
      Table: [tableNode],
    },
  };
}

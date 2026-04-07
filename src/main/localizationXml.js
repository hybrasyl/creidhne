import xml2js from 'xml2js';
import { extractComment, injectComment } from './xmlCommentUtils.js';

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02';
const first = (arr, def = undefined) => (Array.isArray(arr) && arr.length ? arr[0] : def);

const strList = (node) =>
  (node?.String || []).map((s) => ({
    key: s?.$?.Key ?? '',
    message: typeof s === 'string' ? s : (s._ ?? ''),
  }));

// =============================================================================
// PARSER
// =============================================================================

export function parseLocalizationXml(xmlString) {
  return new Promise((resolve, reject) => {
    const comment = extractComment(xmlString);
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err);
      try { resolve(mapXmlToLocalization(result, comment)); }
      catch (e) { reject(e); }
    });
  });
}

function mapXmlToLocalization(result, comment) {
  const root = result?.Localization ?? {};
  const locale = root?.$?.Locale ?? '';

  return {
    locale,
    comment,
    common:       strList(first(root.Common)),
    merchant:     strList(first(root.Merchant)),
    npcSpeak:     strList(first(root.NpcSpeak)),
    monsterSpeak: strList(first(root.MonsterSpeak)),
    npcResponses: (first(root.NpcResponses)?.Response || []).map((r) => ({
      call:     r?.$?.Call ?? '',
      response: typeof r === 'string' ? r : (r._ ?? ''),
    })),
  };
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeLocalizationXml(loc) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0', encoding: 'utf-8' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' },
  });
  const xml = injectComment(builder.buildObject(buildXmlObject(loc)), loc.comment, 'Localization');
  return xml + '\n';
}

function buildXmlObject(loc) {
  const root = { $: { xmlns: XMLNS, Locale: loc.locale } };
  const toStr = (arr) => arr.map((s) => ({ $: { Key: s.key }, _: s.message }));

  if (loc.common?.length)       root.Common       = [{ String: toStr(loc.common) }];
  if (loc.merchant?.length)     root.Merchant     = [{ String: toStr(loc.merchant) }];
  if (loc.npcSpeak?.length)     root.NpcSpeak     = [{ String: toStr(loc.npcSpeak) }];
  if (loc.monsterSpeak?.length) root.MonsterSpeak = [{ String: toStr(loc.monsterSpeak) }];
  if (loc.npcResponses?.length)
    root.NpcResponses = [{ Response: loc.npcResponses.map((r) => ({ $: { Call: r.call }, _: r.response })) }];

  return { Localization: root };
}

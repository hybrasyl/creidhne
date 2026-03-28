import xml2js from 'xml2js';

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02';

const first = (arr, def = undefined) => Array.isArray(arr) && arr.length ? arr[0] : def;
const a = (node, key, def = '') => node?.$?.[key] ?? def;
const toBool = (val, def = false) =>
  val === 'true' ? true : val === 'false' ? false : val === undefined ? def : Boolean(val);
const omitEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined));

// =============================================================================
// PARSER
// =============================================================================

export function parseNpcXml(xmlString) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err);
      try { resolve(mapXmlToNpc(result)); }
      catch (e) { reject(e); }
    });
  });
}

function mapXmlToNpc(result) {
  const root = result.Npc;
  const appearance = first(root.Appearance);
  const roles = first(root.Roles);
  const vend = roles ? first(roles.Vend) : null;
  const train = roles ? first(roles.Train) : null;
  const post = roles ? first(roles.Post) : null;

  return {
    name: first(root.Name, ''),
    displayName: first(root.DisplayName, ''),
    comment: first(root.Comment, ''),
    sprite: a(appearance, 'Sprite', ''),
    portrait: a(appearance, 'Portrait', ''),
    allowDead: toBool(first(root.AllowDead, 'false')),
    responses: (root.Responses?.[0]?.Response || []).map((r) => ({
      call: a(r, 'Call', ''),
      response: typeof r === 'string' ? r : (r._ || ''),
    })),
    strings: (root.Strings?.[0]?.String || []).map((s) => ({
      key: a(s, 'Key', ''),
      message: typeof s === 'string' ? s : (s._ || ''),
    })),
    roles: {
      bankCheck: a(roles, 'BankCheck', ''),
      repairCheck: a(roles, 'RepairCheck', ''),
      postCheck: a(roles, 'PostCheck', ''),
      vendCheck: a(roles, 'VendCheck', ''),
      trainCheck: a(roles, 'TrainCheck', ''),
      bank: roles?.Bank?.[0] ? {
        nation: a(roles.Bank[0], 'Nation', ''),
        discount: a(roles.Bank[0], 'Discount', ''),
      } : null,
      post: post ? {
        nation: a(post, 'Nation', ''),
        surcharges: (post.Surcharge || []).map((s) => ({
          nation: a(s, 'Nation', ''),
          percent: a(s, 'Percent', ''),
        })),
      } : null,
      repair: roles?.Repair?.[0] ? {
        nation: a(roles.Repair[0], 'Nation', ''),
        discount: a(roles.Repair[0], 'Discount', ''),
        type: a(roles.Repair[0], 'Type', ''),
      } : null,
      vend: vend ? {
        items: (vend.Items?.[0]?.Item || []).map((item) => ({
          name: a(item, 'Name', ''),
          quantity: a(item, 'Quantity', '1'),
          restock: a(item, 'Restock', ''),
        })),
      } : null,
      train: train ? {
        castables: (train.Castable || []).map((c) => ({
          name: a(c, 'Name', ''),
          type: a(c, 'Type', ''),
          class: a(c, 'Class', ''),
        })),
      } : null,
    },
  };
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeNpcXml(npc) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' },
  });
  return builder.buildObject(buildXmlObject(npc)) + '\n';
}

function buildXmlObject(npc) {
  const root = { $: { xmlns: XMLNS } };

  root.Name = [npc.name];
  if (npc.comment) root.Comment = [npc.comment];
  root.DisplayName = [npc.displayName || npc.name];
  root.Appearance = [{ $: omitEmpty({ Sprite: npc.sprite, Portrait: npc.portrait }) }];
  if (npc.allowDead) root.AllowDead = ['true'];

  if (npc.responses?.length) {
    root.Responses = [{
      Response: npc.responses.map((r) => ({ $: { Call: r.call }, _: r.response })),
    }];
  }

  if (npc.strings?.length) {
    root.Strings = [{
      String: npc.strings.map((s) => ({ $: { Key: s.key }, _: s.message })),
    }];
  }

  const { bankCheck, repairCheck, postCheck, vendCheck, trainCheck, bank, post, repair, vend, train } = npc.roles;
  const rolesAttrs = omitEmpty({ BankCheck: bankCheck, RepairCheck: repairCheck, PostCheck: postCheck, VendCheck: vendCheck, TrainCheck: trainCheck });
  const hasAnyRole = bank !== null || post !== null || repair !== null || vend !== null || train !== null;

  if (Object.keys(rolesAttrs).length || hasAnyRole) {
    const rolesNode = { $: rolesAttrs };

    if (bank !== null) {
      rolesNode.Bank = [{ $: omitEmpty({ Nation: bank.nation, Discount: bank.discount }) }];
    }

    if (post !== null) {
      const postEl = { $: omitEmpty({ Nation: post.nation }) };
      if (post.surcharges?.length) {
        postEl.Surcharge = post.surcharges.map((s) => ({
          $: omitEmpty({ Nation: s.nation, Percent: s.percent }),
        }));
      }
      rolesNode.Post = [postEl];
    }

    if (repair !== null) {
      rolesNode.Repair = [{ $: omitEmpty({ Nation: repair.nation, Discount: repair.discount, Type: repair.type }) }];
    }

    if (vend !== null) {
      if (vend.items?.length) {
        rolesNode.Vend = [{
          Items: [{
            Item: vend.items.map((item) => ({
              $: omitEmpty({ Name: item.name, Quantity: item.quantity, Restock: item.restock }),
            })),
          }],
        }];
      } else {
        rolesNode.Vend = [{}];
      }
    }

    if (train !== null) {
      if (train.castables?.length) {
        rolesNode.Train = [{
          Castable: train.castables.map((c) => ({
            $: omitEmpty({ Name: c.name, Type: c.type, Class: c.class }),
          })),
        }];
      } else {
        rolesNode.Train = [{}];
      }
    }

    root.Roles = [rolesNode];
  }

  return { Npc: root };
}

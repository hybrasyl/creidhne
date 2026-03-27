import xml2js from 'xml2js';

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02';

const first = (arr, def = undefined) => Array.isArray(arr) && arr.length ? arr[0] : def;
const a = (node, key, def = '') => node?.$?.[key] ?? def;
const omitEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined));

// =============================================================================
// PARSER
// =============================================================================

export function parseRecipeXml(xmlString) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err);
      try { resolve(mapXmlToRecipe(result)); }
      catch (e) { reject(e); }
    });
  });
}

function mapXmlToRecipe(result) {
  const root = result.Recipe;
  const ingredientsNode = first(root.Ingredients, {});
  return {
    name: first(root.Name, ''),
    description: first(root.Description, ''),
    produces: a(first(root.Item), 'Name', ''),
    duration: a(first(root.Duration), 'Length', ''),
    ingredients: (ingredientsNode.Ingredient || []).map((ing) => ({
      name: a(ing, 'Name', ''),
      quantity: a(ing, 'Quantity', '1'),
    })),
  };
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeRecipeXml(recipe) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' },
  });
  return builder.buildObject(buildXmlObject(recipe));
}

function buildXmlObject(recipe) {
  const root = {
    $: { xmlns: XMLNS },
    Name: [recipe.name],
    Item: [{ $: { Name: recipe.produces } }],
    Duration: [{ $: omitEmpty({ Length: recipe.duration !== '' ? String(recipe.duration) : undefined }) }],
  };

  if (recipe.description) root.Description = [recipe.description];

  if (recipe.ingredients.length) {
    root.Ingredients = [{
      Ingredient: recipe.ingredients.map((ing) => ({
        $: { Name: ing.name, Quantity: String(ing.quantity) },
      })),
    }];
  }

  return { Recipe: root };
}

import xml2js from 'xml2js'
import { extractComment, injectComment } from './xmlCommentUtils.js'

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const first = (arr, def = undefined) => (Array.isArray(arr) && arr.length ? arr[0] : def)
const a = (node, key, def = '') => node?.$?.[key] ?? def
const omitEmpty = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  )

// =============================================================================
// PARSER
// =============================================================================

export function parseRecipeXml(xmlString) {
  return new Promise((resolve, reject) => {
    const comment = extractComment(xmlString)
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err)
      try {
        resolve(mapXmlToRecipe(result, comment))
      } catch (e) {
        reject(e)
      }
    })
  })
}

function mapXmlToRecipe(result, comment) {
  const root = result.Recipe
  const ingredientsNode = first(root.Ingredients, {})
  return {
    name: first(root.Name, ''),
    comment,
    description: first(root.Description, ''),
    produces: a(first(root.Item), 'Name', ''),
    duration: a(first(root.Duration), 'Length', ''),
    ingredients: (ingredientsNode.Ingredient || []).map((ing) => ({
      name: a(ing, 'Name', ''),
      quantity: a(ing, 'Quantity', '1')
    }))
  }
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeRecipeXml(recipe) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' }
  })
  const xml = injectComment(builder.buildObject(buildXmlObject(recipe)), recipe.comment, 'Recipe')
  return xml + '\n'
}

function buildXmlObject(recipe) {
  const root = {
    $: { xmlns: XMLNS },
    Name: [recipe.name],
    Item: [{ $: { Name: recipe.produces } }],
    Duration: [
      { $: omitEmpty({ Length: recipe.duration !== '' ? String(recipe.duration) : undefined }) }
    ]
  }

  if (recipe.description) root.Description = [recipe.description]

  if (recipe.ingredients.length) {
    root.Ingredients = [
      {
        Ingredient: recipe.ingredients.map((ing) => ({
          $: { Name: ing.name, Quantity: String(ing.quantity) }
        }))
      }
    ]
  }

  return { Recipe: root }
}

import { describe, it, expect } from 'vitest'
import { parseRecipeXml, serializeRecipeXml } from '../recipeXml.js'
import xml2js from 'xml2js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_XML = `<?xml version="1.0"?>
<!-- Comment: Makes a great sword -->
<Recipe xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02">
  <Name>Great Sword Recipe</Name>
  <Description>Forging instructions for a great sword</Description>
  <Item Name="Great Sword" />
  <Duration Length="30" />
  <Ingredients>
    <Ingredient Name="Iron Bar" Quantity="3" />
    <Ingredient Name="Leather Strip" Quantity="1" />
  </Ingredients>
</Recipe>`

const MINIMAL_XML = `<?xml version="1.0"?>
<Recipe xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02">
  <Name>Plain Recipe</Name>
</Recipe>`

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function parseRaw(xmlString) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}

// ---------------------------------------------------------------------------
// Test 1: Parse round-trip
// ---------------------------------------------------------------------------

describe('Parse round-trip', () => {
  it('serializing a parsed recipe and re-parsing yields the same object', async () => {
    const first = await parseRecipeXml(FULL_XML)
    const xml = serializeRecipeXml(first)
    const second = await parseRecipeXml(xml)
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// Test 2: Field coverage — all fields
// ---------------------------------------------------------------------------

describe('Field coverage — all fields', () => {
  it('parses name', async () => {
    const r = await parseRecipeXml(FULL_XML)
    expect(r.name).toBe('Great Sword Recipe')
  })

  it('parses comment', async () => {
    const r = await parseRecipeXml(FULL_XML)
    expect(r.comment).toBe('Makes a great sword')
  })

  it('parses description', async () => {
    const r = await parseRecipeXml(FULL_XML)
    expect(r.description).toBe('Forging instructions for a great sword')
  })

  it('parses produces from Item Name attribute', async () => {
    const r = await parseRecipeXml(FULL_XML)
    expect(r.produces).toBe('Great Sword')
  })

  it('parses duration from Duration Length attribute', async () => {
    const r = await parseRecipeXml(FULL_XML)
    expect(r.duration).toBe('30')
  })

  it('parses ingredients with name and quantity', async () => {
    const r = await parseRecipeXml(FULL_XML)
    expect(r.ingredients).toHaveLength(2)
    expect(r.ingredients[0]).toEqual({ name: 'Iron Bar', quantity: '3' })
    expect(r.ingredients[1]).toEqual({ name: 'Leather Strip', quantity: '1' })
  })
})

// ---------------------------------------------------------------------------
// Test 3: Field coverage — minimal
// ---------------------------------------------------------------------------

describe('Field coverage — minimal', () => {
  it('parses name', async () => {
    const r = await parseRecipeXml(MINIMAL_XML)
    expect(r.name).toBe('Plain Recipe')
  })

  it('defaults comment to empty string', async () => {
    const r = await parseRecipeXml(MINIMAL_XML)
    expect(r.comment).toBe('')
  })

  it('defaults description to empty string', async () => {
    const r = await parseRecipeXml(MINIMAL_XML)
    expect(r.description).toBe('')
  })

  it('defaults produces to empty string', async () => {
    const r = await parseRecipeXml(MINIMAL_XML)
    expect(r.produces).toBe('')
  })

  it('defaults duration to empty string', async () => {
    const r = await parseRecipeXml(MINIMAL_XML)
    expect(r.duration).toBe('')
  })

  it('defaults ingredients to empty array', async () => {
    const r = await parseRecipeXml(MINIMAL_XML)
    expect(r.ingredients).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Test 4: Output structure
// Serialize a recipe and re-parse it with xml2js to assert the output XML has
// the expected elements, attributes, and nesting. These are structural
// assertions written by hand from the code — they do NOT perform real XSD
// validation and will not catch divergences between creidhne and the XSD.
// ---------------------------------------------------------------------------

describe('Output structure', () => {
  const recipe = {
    name: 'Iron Shield Recipe',
    comment: '',
    description: '',
    produces: 'Iron Shield',
    duration: '20',
    ingredients: [{ name: 'Iron Bar', quantity: '5' }]
  }

  it('root element is Recipe', async () => {
    const parsed = await parseRaw(serializeRecipeXml(recipe))
    expect(parsed).toHaveProperty('Recipe')
  })

  it('Name element is present and non-empty', async () => {
    const parsed = await parseRaw(serializeRecipeXml(recipe))
    expect(parsed.Recipe.Name?.[0]).toBe('Iron Shield Recipe')
  })

  it('Item element has Name attribute', async () => {
    const parsed = await parseRaw(serializeRecipeXml(recipe))
    expect(parsed.Recipe.Item?.[0].$?.Name).toBe('Iron Shield')
  })

  it('Duration element has Length attribute', async () => {
    const parsed = await parseRaw(serializeRecipeXml(recipe))
    expect(parsed.Recipe.Duration?.[0].$?.Length).toBe('20')
  })

  it('each Ingredient has Name and Quantity attributes', async () => {
    const parsed = await parseRaw(serializeRecipeXml(recipe))
    const ings = parsed.Recipe.Ingredients?.[0]?.Ingredient ?? []
    expect(ings).toHaveLength(1)
    expect(ings[0].$?.Name).toBe('Iron Bar')
    expect(ings[0].$?.Quantity).toBe('5')
  })

  it('omits Ingredients element when array is empty', async () => {
    const parsed = await parseRaw(serializeRecipeXml({ ...recipe, ingredients: [] }))
    expect(parsed.Recipe.Ingredients).toBeUndefined()
  })

  it('omits Description element when empty', async () => {
    const parsed = await parseRaw(serializeRecipeXml({ ...recipe, description: '' }))
    expect(parsed.Recipe.Description).toBeUndefined()
  })
})

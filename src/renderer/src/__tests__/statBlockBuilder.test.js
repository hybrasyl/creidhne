import { describe, it, expect } from 'vitest'
import {
  statBlockToExpression,
  expressionToStatBlock
} from '../components/formulas/StatBlockBuilder'

// ── statBlockToExpression ───────────────────────────────────────────────────

describe('statBlockToExpression', () => {
  it('returns 0 for empty rows', () => {
    expect(statBlockToExpression([])).toBe('0')
    expect(statBlockToExpression(null)).toBe('0')
    expect(statBlockToExpression(undefined)).toBe('0')
  })

  it('converts a single row', () => {
    expect(statBlockToExpression([{ stat: 'SOURCESTR', weight: 3 }])).toBe('SOURCESTR * 3')
  })

  it('converts multiple rows joined with +', () => {
    const rows = [
      { stat: 'SOURCESTR', weight: 3 },
      { stat: 'SOURCEDEX', weight: 1 },
      { stat: 'SOURCECON', weight: 1 }
    ]
    expect(statBlockToExpression(rows)).toBe('SOURCESTR * 3 + SOURCEDEX * 1 + SOURCECON * 1')
  })

  it('handles fractional weights', () => {
    expect(statBlockToExpression([{ stat: 'SOURCEINT', weight: 0.5 }])).toBe('SOURCEINT * 0.5')
  })

  it('handles TARGET prefix', () => {
    expect(statBlockToExpression([{ stat: 'TARGETSTR', weight: 2 }])).toBe('TARGETSTR * 2')
  })

  it('handles MAP prefix', () => {
    expect(statBlockToExpression([{ stat: 'MAPBASELEVEL', weight: 1 }])).toBe('MAPBASELEVEL * 1')
  })
})

// ── expressionToStatBlock ───────────────────────────────────────────────────

describe('expressionToStatBlock', () => {
  it('returns empty array for empty/null input', () => {
    expect(expressionToStatBlock('')).toEqual([])
    expect(expressionToStatBlock(null)).toEqual([])
    expect(expressionToStatBlock('0')).toEqual([])
  })

  it('parses a single term', () => {
    const result = expressionToStatBlock('SOURCESTR * 3')
    expect(result).toEqual([{ stat: 'SOURCESTR', weight: 3, prefix: 'SOURCE' }])
  })

  it('parses multiple terms', () => {
    const result = expressionToStatBlock('SOURCESTR * 3 + SOURCEDEX * 1 + SOURCECON * 1')
    expect(result).toEqual([
      { stat: 'SOURCESTR', weight: 3, prefix: 'SOURCE' },
      { stat: 'SOURCEDEX', weight: 1, prefix: 'SOURCE' },
      { stat: 'SOURCECON', weight: 1, prefix: 'SOURCE' }
    ])
  })

  it('infers TARGET prefix', () => {
    const result = expressionToStatBlock('TARGETSTR * 2')
    expect(result).toEqual([{ stat: 'TARGETSTR', weight: 2, prefix: 'TARGET' }])
  })

  it('infers MAP prefix', () => {
    const result = expressionToStatBlock('MAPBASELEVEL * 1')
    expect(result).toEqual([{ stat: 'MAPBASELEVEL', weight: 1, prefix: 'MAP' }])
  })

  it('handles fractional weights', () => {
    const result = expressionToStatBlock('SOURCEINT * 0.5')
    expect(result).toEqual([{ stat: 'SOURCEINT', weight: 0.5, prefix: 'SOURCE' }])
  })
})

// ── Round-trip ──────────────────────────────────────────────────────────────

describe('statBlock round-trip', () => {
  it('round-trips through expression and back (prefix is added on parse)', () => {
    const original = [
      { stat: 'SOURCESTR', weight: 3 },
      { stat: 'SOURCEDEX', weight: 1 }
    ]
    const expr = statBlockToExpression(original)
    const parsed = expressionToStatBlock(expr)
    // Parsed rows gain a `prefix` field
    expect(parsed).toEqual([
      { stat: 'SOURCESTR', weight: 3, prefix: 'SOURCE' },
      { stat: 'SOURCEDEX', weight: 1, prefix: 'SOURCE' }
    ])
    // Re-serializing produces the same expression
    expect(statBlockToExpression(parsed)).toBe(expr)
  })
})

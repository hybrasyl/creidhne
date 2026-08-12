import { describe, it, expect } from 'vitest'
import { refsScanArgsSchema, refsApplyArgsSchema } from '../entityRefs.js'
import { REFERENCED_TYPES } from '../../../shared/entityReferences.js'

/**
 * HTOO-378. `refs:apply` is the widest write in the app — one message rewrites
 * every file in the world that names an entity — so these are the payloads that
 * must not get past the boundary.
 */

const scan = { libraryPath: 'C:/world/xml', type: 'items', oldName: 'Lorica' }
const apply = { ...scan, newName: 'Cuirass' }

describe('rename-repair payloads', () => {
  it('accepts a well-formed pair', () => {
    expect(refsScanArgsSchema.safeParse(scan).success).toBe(true)
    expect(refsApplyArgsSchema.safeParse(apply).success).toBe(true)
  })

  it('refuses a blank new name', () => {
    // The dangerous one. A blank `newName` writes an empty reference into every
    // referring file: it parses, and it keys nothing. That is the fault
    // `worldEntity.js` refuses one file at a time, at hundreds of times the
    // blast radius.
    expect(refsApplyArgsSchema.safeParse({ ...apply, newName: '' }).success).toBe(false)
    expect(refsApplyArgsSchema.safeParse({ ...apply, newName: '   ' }).success).toBe(false)
  })

  it('refuses a blank old name, which would match nothing and report success', () => {
    expect(refsScanArgsSchema.safeParse({ ...scan, oldName: '  ' }).success).toBe(false)
  })

  it('refuses a type the reference table has no edges for', () => {
    expect(refsApplyArgsSchema.safeParse({ ...apply, type: 'nonsense' }).success).toBe(false)
    expect(refsApplyArgsSchema.safeParse({ ...apply, type: 'npcs' }).success).toBe(false)
  })

  it('takes its type vocabulary from the table rather than restating it', () => {
    // Derived, not restated. A type added to the reference table is legal here
    // with no second edit, so the two cannot disagree about what is repairable.
    for (const type of REFERENCED_TYPES) {
      expect(refsScanArgsSchema.safeParse({ ...scan, type }).success, type).toBe(true)
    }
  })

  it('refuses a non-string name instead of coercing it', () => {
    // The `fs:writeFile` lesson: an argument that coerces is an argument that
    // reaches disk as `[object Object]` with the write reporting success.
    expect(refsApplyArgsSchema.safeParse({ ...apply, newName: 42 }).success).toBe(false)
    expect(refsApplyArgsSchema.safeParse({ ...apply, newName: { name: 'x' } }).success).toBe(false)
  })
})

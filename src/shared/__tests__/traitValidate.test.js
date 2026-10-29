import { describe, expect, it } from 'vitest'
import { validateTrait } from '../traitValidate.js'

// The server's trait checks (xml Trait.Validate), as the editor runs them.

const valid = () => ({
  name: 'Dockworker',
  icon: '112',
  iconSet: 'Skill',
  exclusiveGroup: 'Background',
  conflictsWith: ['Scribe']
})
const problemsOf = (edit, known) => {
  const t = valid()
  edit(t)
  return validateTrait(t, known).join(' ')
}

describe('validateTrait', () => {
  it('passes a valid trait', () => {
    expect(validateTrait(valid(), ['Dockworker', 'Scribe'])).toEqual([])
  })
  it.each([[''], [' Dockworker'], ['Dockworker '], ['   ']])('a bad name: "%s"', (name) => {
    expect(problemsOf((t) => (t.name = name))).toMatch(/name is empty, or it has a space/)
  })
  it('a conflict with itself', () => {
    expect(problemsOf((t) => t.conflictsWith.push('Dockworker'))).toMatch(/names the trait itself/)
  })
  it('a conflict named two times', () => {
    expect(problemsOf((t) => t.conflictsWith.push('Scribe'))).toMatch(/names Scribe more than once/)
  })
  it('a conflict that is not a trait, when the world is known', () => {
    expect(problemsOf((t) => t.conflictsWith.push('Juggler'), ['Dockworker', 'Scribe'])).toMatch(
      /names Juggler, which is not a trait/
    )
    expect(problemsOf((t) => t.conflictsWith.push('Juggler'), null)).toBe('')
  })
  it('compares names exactly, as the server does', () => {
    expect(problemsOf((t) => t.conflictsWith.push('dockworker'), null)).toBe('')
  })
  it('a group with a space at an end', () => {
    expect(problemsOf((t) => (t.exclusiveGroup = 'Background '))).toMatch(/exclusive group/)
  })
  it('an icon that is missing or out of range, but not one above 255', () => {
    expect(problemsOf((t) => (t.icon = ''))).toMatch(/0 to 65535/)
    expect(problemsOf((t) => (t.icon = '65536'))).toMatch(/0 to 65535/)
    expect(problemsOf((t) => (t.icon = '4000'))).toBe('')
  })
  it('an icon set that is not Skill or Spell', () => {
    expect(problemsOf((t) => (t.iconSet = ''))).toMatch(/Skill or Spell/)
  })
})

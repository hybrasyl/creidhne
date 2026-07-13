import { describe, it, expect } from 'vitest'
import { extractSection } from './changelog-extract.mjs'

const CHANGELOG = `# Changelog

<!-- a comment -->

## [Unreleased]

### Added

- Something new.

## [1.2.0] - 2026-07-12

### Fixed

- A real bug.

### Changed

- A behavior.

## [1.1.0] - 2026-06-01

### Added

- Older thing.
`

describe('extractSection', () => {
  it('returns the body of a version section, heading excluded', () => {
    expect(extractSection(CHANGELOG, '1.2.0')).toBe(
      '### Fixed\n\n- A real bug.\n\n### Changed\n\n- A behavior.'
    )
  })

  it('strips a leading v from the tag', () => {
    expect(extractSection(CHANGELOG, 'v1.2.0')).toBe(extractSection(CHANGELOG, '1.2.0'))
  })

  it('stops at the next version heading (does not bleed into older entries)', () => {
    expect(extractSection(CHANGELOG, '1.2.0')).not.toContain('Older thing')
  })

  it('handles the Unreleased section by name', () => {
    expect(extractSection(CHANGELOG, 'Unreleased')).toBe('### Added\n\n- Something new.')
  })

  it('is case-insensitive on the version token', () => {
    expect(extractSection(CHANGELOG, 'UNRELEASED')).toContain('Something new')
  })

  it('returns empty string for a missing version (workflow falls back to auto notes)', () => {
    expect(extractSection(CHANGELOG, '9.9.9')).toBe('')
  })
})

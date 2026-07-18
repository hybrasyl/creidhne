import { describe, it, expect } from 'vitest'
import { buildDiagnosticsBlock, formatErrorLine } from '../diagnostics.js'

describe('formatErrorLine', () => {
  it('renders timestamp, source, origin, and message', () => {
    const line = formatErrorLine({
      timestamp: '2026-07-18T12:00:00.000Z',
      source: 'uncaughtException',
      origin: 'main',
      message: 'TypeError: boom'
    })
    expect(line).toBe('2026-07-18T12:00:00.000Z [uncaughtException] main :: TypeError: boom')
  })

  it('flattens a multiline stack to a single line with " | "', () => {
    const line = formatErrorLine({
      timestamp: '2026-07-18T12:00:00.000Z',
      source: 'react',
      origin: 'renderer',
      message: 'Boom',
      stack: 'Error: Boom\n    at Foo\n    at Bar'
    })
    expect(line).toBe(
      '2026-07-18T12:00:00.000Z [react] renderer :: Boom | Error: Boom | at Foo | at Bar'
    )
  })
})

describe('buildDiagnosticsBlock', () => {
  it('includes product, version, OS and an error tail in order', () => {
    const block = buildDiagnosticsBlock({
      productName: 'Creidhne',
      version: '1.8.0',
      os: 'windows',
      errors: [
        { timestamp: 't1', source: 'react', origin: 'renderer', message: 'A' },
        { timestamp: 't2', source: 'uncaughtException', origin: 'main', message: 'B' }
      ]
    })
    expect(block).toBe(
      [
        'App: Creidhne 1.8.0',
        'OS: windows',
        '--- recent errors (scrubbed) ---',
        't1 [react] renderer :: A',
        't2 [uncaughtException] main :: B'
      ].join('\n')
    )
  })

  it('renders a placeholder line when there are no errors', () => {
    const block = buildDiagnosticsBlock({ productName: 'Creidhne', version: '1.8.0', os: 'macOS' })
    expect(block).toContain('No errors captured this session.')
  })
})

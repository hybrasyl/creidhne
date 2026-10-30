/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { hybrasylTheme } from '../../themes'
import { useAppStore, useStoreValue, libraryIndexState } from '../../store/appStore'
import StagingScope from '../shared/StagingScope'
import IndexNamePicker from '../shared/IndexNamePicker'
import EditorHeader from '../shared/EditorHeader'

/**
 * HTOO-453. StagingScope decides what an editor sees, at render time: the
 * index its pickers and duplicate check read, the marks in a picker's list,
 * and Stage or Release in the shared header. A component test, by the tier
 * rule in CLAUDE.md; the page behaviour is e2e/staging.spec.js.
 */

const LIVE = { statuses: ['Burning'] }
const STAGED = {
  statuses: {
    names: ['Crouch'],
    namesByFilename: { 'animist/crouch.xml': 'Crouch' },
    duplicateNames: {}
  }
}
const stagedFile = { rel: 'a.xml', path: '/s/a.xml', staged: true }
const liveFile = { rel: 'a.xml', path: '/x/a.xml', staged: false }

beforeEach(() => {
  useAppStore.setState({ libraryIndex: LIVE, stagedIndex: STAGED })
})

afterEach(() => {
  cleanup()
  useAppStore.setState({ libraryIndex: {}, stagedIndex: {} })
})

function Names() {
  const index = useStoreValue(libraryIndexState)
  return <div data-testid="names">{(index.statuses || []).join(',')}</div>
}

const inScope = (file, children, handlers = {}) =>
  render(
    <ThemeProvider theme={hybrasylTheme}>
      <StagingScope file={file} {...handlers}>
        {children}
      </StagingScope>
    </ThemeProvider>
  )

const openPicker = () => {
  fireEvent.mouseDown(screen.getByRole('combobox'))
  return screen.getAllByRole('option').map((o) => o.textContent)
}

describe('StagingScope', () => {
  it('gives a staged editor the live names and the staged names', () => {
    inScope(stagedFile, <Names />)
    expect(screen.getByTestId('names').textContent).toBe('Burning,Crouch')
  })

  it('gives a live editor the live names only', () => {
    inScope(liveFile, <Names />)
    expect(screen.getByTestId('names').textContent).toBe('Burning')
  })

  it('leaves the index outside the scope alone', () => {
    render(<Names />)
    expect(screen.getByTestId('names').textContent).toBe('Burning')
  })

  it('marks the staged-only options in a staged editor’s picker', () => {
    inScope(
      stagedFile,
      <IndexNamePicker section="statuses" label="Status" value="" onChange={() => {}} />
    )
    expect(openPicker()).toEqual(['Burning', 'Crouchstaged'])
    expect(screen.getAllByTestId('staged-option-mark')).toHaveLength(1)
  })

  it('offers no staged name, and so no mark, in a live editor’s picker', () => {
    inScope(
      liveFile,
      <IndexNamePicker section="statuses" label="Status" value="" onChange={() => {}} />
    )
    expect(openPicker()).toEqual(['Burning'])
    expect(screen.queryByTestId('staged-option-mark')).toBeNull()
  })
})

describe('EditorHeader in a StagingScope', () => {
  const header = (isArchived = false) => (
    <EditorHeader
      title="A"
      entityLabel="castable"
      fileName="a.xml"
      initialFileName="a.xml"
      computedFileName="a.xml"
      isExisting
      isArchived={isArchived}
      onFileNameChange={() => {}}
      onRegenerate={() => {}}
      onSave={() => {}}
      onRenameFile={() => {}}
      onArchive={() => {}}
      onUnarchive={() => {}}
    />
  )
  const noop = () => {}

  it('shows Release and the Staged chip, and no Archive, for a staged file', () => {
    inScope(stagedFile, header(), { onStage: noop, onRelease: noop })
    expect(screen.getByRole('button', { name: 'Release' })).toBeTruthy()
    expect(screen.getByTestId('staged-chip')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Stage' })).toBeNull()
    expect(screen.queryByLabelText(/Archive castable/)).toBeNull()
  })

  it('shows Stage for a live file', () => {
    inScope(liveFile, header(), { onStage: noop, onRelease: noop })
    expect(screen.getByRole('button', { name: 'Stage' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Release' })).toBeNull()
    expect(screen.queryByTestId('staged-chip')).toBeNull()
  })

  it('shows neither for an archived file', () => {
    inScope({ ...liveFile, archived: true }, header(true), { onStage: noop, onRelease: noop })
    expect(screen.queryByRole('button', { name: 'Stage' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Release' })).toBeNull()
  })

  it('shows neither outside a scope', () => {
    render(<ThemeProvider theme={hybrasylTheme}>{header()}</ThemeProvider>)
    expect(screen.queryByRole('button', { name: 'Stage' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Release' })).toBeNull()
  })
})

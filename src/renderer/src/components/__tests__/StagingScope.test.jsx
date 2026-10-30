/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { hybrasylTheme } from '../../themes'
import { useAppStore, useStoreValue, libraryIndexState } from '../../store/appStore'
import StagingScope from '../shared/StagingScope'
import IndexNamePicker from '../shared/IndexNamePicker'
import EditorHeader from '../shared/EditorHeader'
import { EditorAlertsProvider, useEditorAlert } from '../shared/EditorAlerts'

/**
 * HTOO-453, HTOO-628. StagingScope decides what an editor sees, at render
 * time: the index its pickers and duplicate check read, the marks in a
 * picker's list, and the Staging box in the shared header. The header also
 * shows the alerts area. A component test, by the tier rule in CLAUDE.md; the
 * page behaviour is e2e/staging.spec.js and e2e/page-toolbar.spec.js.
 */

const LIVE = { statuses: ['Burning'] }
const STAGED = {
  statuses: {
    names: ['Crouch'],
    namesByFilename: { 'animist/crouch.xml': 'Crouch' },
    duplicateNames: {}
  }
}

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

const inScope = (props, children) =>
  render(
    <ThemeProvider theme={hybrasylTheme}>
      <StagingScope {...props}>{children}</StagingScope>
    </ThemeProvider>
  )

const openPicker = () => {
  fireEvent.mouseDown(screen.getByRole('combobox'))
  return screen.getAllByRole('option').map((o) => o.textContent)
}

describe('StagingScope', () => {
  it('gives an editor that saves into staging the live names and the staged names', () => {
    inScope({ saveStaged: true }, <Names />)
    expect(screen.getByTestId('names').textContent).toBe('Burning,Crouch')
  })

  it('gives an editor that saves into the live tree the live names only', () => {
    inScope({ saveStaged: false }, <Names />)
    expect(screen.getByTestId('names').textContent).toBe('Burning')
  })

  it('leaves the index outside the scope alone', () => {
    render(<Names />)
    expect(screen.getByTestId('names').textContent).toBe('Burning')
  })

  it('marks the staged-only options in the picker of an editor that saves into staging', () => {
    inScope(
      { saveStaged: true },
      <IndexNamePicker section="statuses" label="Status" value="" onChange={() => {}} />
    )
    expect(openPicker()).toEqual(['Burning', 'Crouchstaged'])
    expect(screen.getAllByTestId('staged-option-mark')).toHaveLength(1)
  })

  it('offers no staged name, and so no mark, in a live editor’s picker', () => {
    inScope(
      { saveStaged: false },
      <IndexNamePicker section="statuses" label="Status" value="" onChange={() => {}} />
    )
    expect(openPicker()).toEqual(['Burning'])
    expect(screen.queryByTestId('staged-option-mark')).toBeNull()
  })
})

describe('EditorHeader', () => {
  const header = (over = {}) => (
    <EditorHeader
      title="A"
      entityLabel="castable"
      fileName="a.xml"
      initialFileName="a.xml"
      computedFileName="a.xml"
      isExisting
      isArchived={false}
      folder=""
      initialFolder=""
      onFolderChange={() => {}}
      onFileNameChange={() => {}}
      onRegenerate={() => {}}
      onSave={() => {}}
      onRenameFile={() => {}}
      {...over}
    />
  )
  const staging = () => screen.getByRole('checkbox', { name: 'Staging' })

  it('shows the Staging box, checked while the save goes into staging', () => {
    const onChange = vi.fn()
    inScope({ saveStaged: true, onSaveStagedChange: onChange }, header())
    expect(staging().checked).toBe(true)
    fireEvent.click(staging())
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('disables the Staging box for an archived file', () => {
    inScope({ saveStaged: false, onSaveStagedChange: () => {} }, header({ isArchived: true }))
    expect(staging().disabled).toBe(true)
  })

  it('shows no Staging box outside a file-backed page', () => {
    render(<ThemeProvider theme={hybrasylTheme}>{header()}</ThemeProvider>)
    expect(screen.queryByRole('checkbox', { name: 'Staging' })).toBeNull()
  })

  it('always shows Rename, enabled only when the filename or folder changes', () => {
    const { rerender } = inScope({}, header())
    expect(screen.getByRole('button', { name: 'Rename' }).disabled).toBe(true)
    rerender(
      <ThemeProvider theme={hybrasylTheme}>
        <StagingScope>{header({ fileName: 'b.xml' })}</StagingScope>
      </ThemeProvider>
    )
    expect(screen.getByRole('button', { name: 'Rename' }).disabled).toBe(false)
  })

  it('keeps Archive, Stage and Release out of the header: they are the toolbar’s', () => {
    inScope({ saveStaged: true, onSaveStagedChange: () => {} }, header())
    for (const name of ['Archive', 'Unarchive', 'Stage', 'Release']) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
  })

  it('puts the computed-name line under the whole row, still describing the field', () => {
    // Under the field it was only as wide as the field, and wrapped.
    inScope({}, header({ initialFileName: 'a.xml', computedFileName: 'computed.xml' }))
    const line = screen.getByText(/^Computed name: "computed\.xml"/)
    expect(line.closest('.MuiTextField-root')).toBeNull()
    const field = screen.getByRole('textbox', { name: 'Filename' })
    expect(field.getAttribute('aria-describedby')).toBe(line.id)
  })

  it('puts ↺ inside the filename field', () => {
    inScope({}, header({ computedFileName: 'computed.xml' }))
    const field = screen.getByRole('textbox', { name: 'Filename' }).closest('.MuiInputBase-root')
    expect(field.querySelector('[aria-label="Apply computed filename"]')).not.toBeNull()
  })
})

describe('the alerts area', () => {
  function Notice({ id, alert }) {
    const inArea = useEditorAlert(id, alert)
    return inArea ? null : <div data-testid={`in-place-${id}`} />
  }
  const warn = (message, order = 0) => ({ order, severity: 'warning', message, testId: message })

  it('shows every registered alert under the header, in order, with a count', () => {
    render(
      <ThemeProvider theme={hybrasylTheme}>
        <EditorAlertsProvider>
          {header()}
          <Notice id="b" alert={warn('second', 20)} />
          <Notice id="a" alert={warn('first', 10)} />
          <Notice id="c" alert={null} />
        </EditorAlertsProvider>
      </ThemeProvider>
    )
    const area = screen.getByTestId('editor-alerts')
    expect(screen.getByRole('button', { name: 'Alerts (2)' })).toBeTruthy()
    expect([...area.querySelectorAll('[role="alert"]')].map((el) => el.textContent)).toEqual([
      'first',
      'second'
    ])
    expect(screen.queryByTestId('in-place-a')).toBeNull()
  })

  it('collapses', () => {
    render(
      <ThemeProvider theme={hybrasylTheme}>
        <EditorAlertsProvider>
          {header()}
          <Notice id="a" alert={warn('first')} />
        </EditorAlertsProvider>
      </ThemeProvider>
    )
    const toggle = screen.getByRole('button', { name: 'Alerts (1)' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('shows nothing when no alert is registered', () => {
    render(
      <ThemeProvider theme={hybrasylTheme}>
        <EditorAlertsProvider>{header()}</EditorAlertsProvider>
      </ThemeProvider>
    )
    expect(screen.queryByTestId('editor-alerts')).toBeNull()
  })

  it('lets a notice render in place when there is no area', () => {
    render(<Notice id="a" alert={warn('first')} />)
    expect(screen.getByTestId('in-place-a')).toBeTruthy()
  })

  function header() {
    return (
      <EditorHeader
        title="A"
        fileName="a.xml"
        initialFileName="a.xml"
        computedFileName="a.xml"
        isExisting
        onFileNameChange={() => {}}
        onRegenerate={() => {}}
        onSave={() => {}}
        onRenameFile={() => {}}
      />
    )
  }
})

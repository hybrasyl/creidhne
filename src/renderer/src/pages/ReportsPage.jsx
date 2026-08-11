import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteIcon from '@mui/icons-material/Delete'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import SaveIcon from '@mui/icons-material/Save'
import { CASTABLE_EXPORT_PRESETS } from '@shared/castableExportPresets.js'
import { useStoreValue, activeLibraryState } from '../store/appStore'
import ColumnPicker from '../components/reports/ColumnPicker'
import RuleList from '../components/reports/RuleList'

// The Reports surface (WP2), which was the Exports page's three fixed buttons.
//
// The three built-in reports are read-only and clonable. Their column headers are
// a contract with a balancing workbook and the Hybrasyl website parser, so a
// header change stays a line in a diff rather than something a user can do here.
//
// Label and description come from the preset data now, rather than being restated
// in this file. The restated copy drifted the moment the presets changed, and this
// repo has fixed that same fault twice (HTOO-130, HTOO-159). Reading them here is
// what the `@shared` alias is for.

const PREVIEW_DEBOUNCE_MS = 400

/** A stored report's columns are bare keys; a built-in's are `{ key, header }`. */
const columnKeys = (columns) => (columns ?? []).map((c) => (typeof c === 'string' ? c : c.key))

/** A definition the IPC layer accepts: no preset-only fields, columns as keys. */
function toDefinition(report) {
  return {
    id: report.id,
    label: report.label,
    entity: 'castables',
    format: report.format,
    columns: columnKeys(report.columns),
    match: report.match ?? 'all',
    rules: report.rules ?? [],
    headerOnEmpty: report.headerOnEmpty ?? true
  }
}

function ReportsPage() {
  const activeLibrary = useStoreValue(activeLibraryState)
  const [reports, setReports] = useState([])
  const [loadProblems, setLoadProblems] = useState([])
  const [selectedId, setSelectedId] = useState(CASTABLE_EXPORT_PRESETS[0].id)
  const [draft, setDraft] = useState(null)
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(null)
  const [preview, setPreview] = useState(null)

  const builtIns = CASTABLE_EXPORT_PRESETS
  const isBuiltIn = builtIns.some((p) => p.id === selectedId)

  const selected = useMemo(() => {
    if (draft && draft.id === selectedId) return draft
    return builtIns.find((p) => p.id === selectedId) ?? reports.find((r) => r.id === selectedId)
  }, [builtIns, draft, reports, selectedId])

  const loadSaved = useCallback(async () => {
    if (!activeLibrary) {
      setReports([])
      setLoadProblems([])
      return
    }
    const result = await window.electronAPI.loadReports(activeLibrary)
    setReports(result.reports ?? [])
    setLoadProblems(result.problems ?? [])
  }, [activeLibrary])

  useEffect(() => {
    loadSaved()
  }, [loadSaved])

  // The live row count. Debounced because a rule edit is a keystroke and the
  // preview reads every castable file in the library.
  const previewTimer = useRef(null)
  useEffect(() => {
    setPreview(null)
    if (!activeLibrary || !selected || columnKeys(selected.columns).length === 0) return

    clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(async () => {
      const result = await window.electronAPI.previewReport(activeLibrary, toDefinition(selected))
      setPreview(result?.error ? null : result)
    }, PREVIEW_DEBOUNCE_MS)

    return () => clearTimeout(previewTimer.current)
  }, [activeLibrary, selected])

  const requireLibrary = () => {
    if (activeLibrary) return true
    setStatus({
      type: 'error',
      message: 'No library selected. Open a library from Settings first.'
    })
    return false
  }

  const handleRun = async () => {
    if (!requireLibrary() || !selected) return
    setBusy('run')
    setStatus(null)
    try {
      const result = await window.electronAPI.runCastableReport(
        activeLibrary,
        toDefinition(selected)
      )
      if (result.error) {
        setStatus({ type: 'error', message: result.error })
        return
      }
      const save = await window.electronAPI.saveFile(result.defaultName, result.content)
      setStatus(
        save.canceled
          ? { type: 'info', message: 'Export cancelled.' }
          : {
              type: 'success',
              message: `Exported ${result.matched} of ${result.total} castables to ${save.filePath}`
            }
      )
    } catch (e) {
      setStatus({ type: 'error', message: `Export failed: ${e.message}` })
    } finally {
      setBusy(null)
    }
  }

  // Clone is how a built-in becomes editable. The copy carries the built-in's
  // explicit headers down to bare keys, so the copy takes the field catalogue's
  // labels — the contracted headers stay with the built-in alone.
  const handleClone = () => {
    if (!selected) return
    const id = `r_${Math.abs(hashOf(`${selected.id}${reports.length}${selected.label}`)).toString(36)}`
    const copy = {
      id,
      label: `${selected.label} copy`,
      entity: 'castables',
      format: selected.format,
      columns: columnKeys(selected.columns),
      match: selected.match ?? 'all',
      rules: selected.rules ?? [],
      headerOnEmpty: selected.headerOnEmpty ?? true
    }
    setDraft(copy)
    setSelectedId(id)
    setStatus({ type: 'info', message: 'Cloned. Save the report to keep it.' })
  }

  const handleSave = async () => {
    if (!requireLibrary() || !draft) return
    setBusy('save')
    try {
      const others = reports.filter((r) => r.id !== draft.id)
      const result = await window.electronAPI.saveReports(activeLibrary, [...others, draft])
      if (result.error) {
        setStatus({ type: 'error', message: result.error })
        return
      }
      setReports(result.reports)
      setDraft(null)
      setStatus({ type: 'success', message: `Saved "${draft.label}".` })
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async () => {
    if (!requireLibrary() || isBuiltIn) return
    const remaining = reports.filter((r) => r.id !== selectedId)
    const result = await window.electronAPI.saveReports(activeLibrary, remaining)
    if (result.error) {
      setStatus({ type: 'error', message: result.error })
      return
    }
    setReports(result.reports)
    setDraft(null)
    setSelectedId(builtIns[0].id)
    setStatus({ type: 'info', message: 'Report deleted.' })
  }

  // Every edit goes through the draft, so an unsaved change is visibly unsaved
  // rather than silently living in the list.
  //
  // Refusing a built-in here as well as disabling its inputs. A disabled input is
  // a UI state, and a later refactor that forgets one control would make a
  // contracted column set editable with nothing to say so.
  const edit = (over) => {
    if (isBuiltIn) return
    setDraft({ ...toDefinition(selected), ...over })
  }

  const columns = columnKeys(selected?.columns)
  const dirty = !!draft
  const canRun = columns.length > 0

  return (
    <Box sx={{ display: 'flex', gap: 2, p: 3, height: '100%', overflow: 'hidden' }}>
      <Paper variant="outlined" sx={{ width: 260, p: 1, overflow: 'auto', flexShrink: 0 }}>
        <Typography variant="subtitle2" sx={{ px: 1 }}>
          Built in
        </Typography>
        <List dense disablePadding>
          {builtIns.map((preset) => (
            <ListItemButton
              key={preset.id}
              selected={selectedId === preset.id}
              onClick={() => {
                setDraft(null)
                setSelectedId(preset.id)
              }}
            >
              <ListItemText primary={preset.label} slotProps={{ primary: { variant: 'body2' } }} />
              <LockOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </ListItemButton>
          ))}
        </List>
        <Divider sx={{ my: 1 }} />
        <Typography variant="subtitle2" sx={{ px: 1 }}>
          Your reports
        </Typography>
        {reports.length === 0 && !draft ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', px: 1 }}>
            Clone a built-in report to start one.
          </Typography>
        ) : (
          <List dense disablePadding>
            {[...reports, ...(draft && !reports.some((r) => r.id === draft.id) ? [draft] : [])].map(
              (report) => (
                <ListItemButton
                  key={report.id}
                  selected={selectedId === report.id}
                  onClick={() => setSelectedId(report.id)}
                >
                  <ListItemText
                    primary={report.label}
                    secondary={report.id === draft?.id ? 'unsaved' : undefined}
                    slotProps={{
                      primary: { variant: 'body2' },
                      secondary: { variant: 'caption' }
                    }}
                  />
                </ListItemButton>
              )
            )}
          </List>
        )}
      </Paper>

      <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="h5" sx={{ flex: 1 }}>
            Reports
          </Typography>
          {preview && (
            <Chip
              size="small"
              label={`${preview.matched} of ${preview.total} castables`}
              variant="outlined"
            />
          )}
          {isBuiltIn && (
            <Tooltip title="Clone this report to edit it">
              <Button size="small" startIcon={<ContentCopyIcon />} onClick={handleClone}>
                Clone
              </Button>
            </Tooltip>
          )}
          {!isBuiltIn && selected && (
            <>
              <Button
                size="small"
                startIcon={<SaveIcon />}
                disabled={!dirty || !canRun || busy !== null}
                onClick={handleSave}
              >
                Save
              </Button>
              <Tooltip title="Delete this report">
                <IconButton size="small" color="error" onClick={handleDelete}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Button
            variant="contained"
            size="small"
            startIcon={
              busy === 'run' ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />
            }
            disabled={!selected || !canRun || busy !== null}
            onClick={handleRun}
          >
            Run
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />

        {loadProblems.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setLoadProblems([])}>
            <strong>Some saved reports could not be read.</strong> The rest loaded normally.
            <Box component="ul" sx={{ m: 0, pl: 3 }}>
              {loadProblems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </Box>
          </Alert>
        )}

        {!selected ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Choose a report.
          </Typography>
        ) : (
          <>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                label="Report name"
                sx={{ flex: 1, minWidth: 220 }}
                value={selected.label}
                disabled={isBuiltIn}
                onChange={(e) => edit({ label: e.target.value })}
                slotProps={{ htmlInput: { spellCheck: false } }}
              />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Format</InputLabel>
                <Select
                  label="Format"
                  value={selected.format}
                  disabled={isBuiltIn}
                  onChange={(e) => edit({ format: e.target.value })}
                >
                  <MenuItem value="csv">CSV</MenuItem>
                  <MenuItem value="json">JSON</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {isBuiltIn && (
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                {selected.description}
              </Typography>
            )}

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Columns
            </Typography>
            <ColumnPicker
              value={columns}
              disabled={isBuiltIn}
              onChange={(next) => edit({ columns: next })}
            />

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              Filter
            </Typography>
            <RuleList
              match={selected.match}
              rules={selected.rules}
              disabled={isBuiltIn}
              onChange={(next) => edit(next)}
            />
          </>
        )}

        {status && (
          <Alert severity={status.type} sx={{ mt: 2 }} onClose={() => setStatus(null)}>
            {status.message}
          </Alert>
        )}
      </Box>
    </Box>
  )
}

/**
 * A short stable id from a string. Not for security — `crypto.randomUUID` is
 * available, but a deterministic id keeps a test from depending on randomness,
 * and a collision only means the clone replaces its own earlier copy.
 */
function hashOf(text) {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) | 0
  return hash
}

export default ReportsPage

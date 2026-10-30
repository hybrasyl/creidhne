import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Alert, Box, ButtonBase, Collapse, Typography } from '@mui/material'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

/**
 * The collapsible alerts under the editor header (HTOO-628).
 *
 * Before, each notice stacked above the editor in its own place: the page's
 * shared-key and staged-reference notices above the header, and each editor's
 * own warnings wherever that editor put them. Now a notice registers here, and
 * `EditorHeader` shows every registered alert in one area under itself.
 *
 * An alert is data, not a node — `{ order, severity, message, items, testId }`
 * — so a component that re-renders registers an equal value and nothing
 * updates. A node would be a new object on every render, and the registry would
 * update forever.
 *
 * The provider wraps the right column of every editor page
 * (`EditorFileListPanel`). Outside one, `useEditorAlert` returns false, and the
 * caller renders its alert in place, as it did before.
 */

const AlertsContext = createContext(null)

export function EditorAlertsProvider({ children }) {
  const [alerts, setAlerts] = useState({})
  const register = useCallback((id, alert) => {
    setAlerts((prev) => {
      if (JSON.stringify(prev[id] ?? null) === JSON.stringify(alert ?? null)) return prev
      const next = { ...prev }
      if (alert) next[id] = alert
      else delete next[id]
      return next
    })
  }, [])
  const value = useMemo(() => ({ alerts, register }), [alerts, register])
  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
}

/**
 * Show `alert` in the area while it is not null. Returns true when an area
 * shows it; false when there is no area, and the caller renders it itself.
 */
export function useEditorAlert(id, alert) {
  const ctx = useContext(AlertsContext)
  const register = ctx?.register
  const value = JSON.stringify(alert ?? null)
  useEffect(() => {
    register?.(id, JSON.parse(value))
  }, [register, id, value])
  useEffect(() => () => register?.(id, null), [register, id])
  return !!register
}

/** One alert, the same way in the area and in place. */
export function EditorAlert({ alert, sx }) {
  return (
    <Alert severity={alert.severity} data-testid={alert.testId} sx={sx}>
      {alert.message}
      {alert.items?.length > 0 && (
        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
          {alert.items.map((item, i) => (
            <li key={`${i}:${item}`}>{item}</li>
          ))}
        </Box>
      )}
    </Alert>
  )
}

/**
 * The area itself, rendered by `EditorHeader`. Open by default. Its content has
 * a height limit and scrolls, so a long list of alerts cannot push the editor
 * out of the pane.
 */
export function EditorAlertsArea() {
  const ctx = useContext(AlertsContext)
  const [open, setOpen] = useState(true)
  const list = useMemo(
    () =>
      Object.entries(ctx?.alerts ?? {})
        .map(([id, alert]) => ({ id, ...alert }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id)),
    [ctx?.alerts]
  )
  if (!list.length) return null
  const worst = list.some((a) => a.severity === 'error')
    ? 'error.main'
    : list.some((a) => a.severity === 'warning')
      ? 'warning.main'
      : 'info.main'
  return (
    <Box data-testid="editor-alerts" sx={{ flexShrink: 0, mb: 1 }}>
      <ButtonBase
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Alerts (${list.length})`}
        sx={{ width: '100%', justifyContent: 'flex-start', gap: 0.5, py: 0.25, borderRadius: 1 }}
      >
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        <Typography variant="body2" sx={{ color: worst, fontWeight: 500 }}>
          Alerts ({list.length})
        </Typography>
      </ButtonBase>
      <Collapse in={open}>
        <Box sx={{ maxHeight: '30vh', overflow: 'auto', pt: 0.5 }}>
          {list.map((alert) => (
            <EditorAlert key={alert.id} alert={alert} sx={{ mb: 1 }} />
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}

import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tab,
  Tabs,
  Tooltip,
  Typography
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { emitInline, emitModule } from '@shared/dialogLua.js'
import { validateDialogDocument } from '@shared/dialogValidate.js'
import { hasRequiredText } from '@shared/dialogDocument.js'

// Export renders the document to Lua for the writer to paste (HTOO-458).
// Creidhne writes nothing under scripts/. Two targets over one document:
// inline (paste into the NPC's script) and module (save as a module file, and
// paste a require + install into each NPC that uses it).

function CodeBlock({ title, hint, code }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
          {hint}
        </Typography>
        <Tooltip title={copied ? 'Copied' : 'Copy to clipboard'}>
          <IconButton size="small" onClick={copy}>
            <ContentCopyIcon fontSize="small" color={copied ? 'success' : 'inherit'} />
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          fontSize: 12,
          fontFamily: 'monospace',
          whiteSpace: 'pre',
          overflow: 'auto',
          maxHeight: 320,
          bgcolor: 'action.hover',
          borderRadius: 1
        }}
      >
        {code}
      </Box>
    </Box>
  )
}

function ExportDialog({ open, onClose, doc }) {
  const [mode, setMode] = useState('inline')
  const result = useMemo(() => validateDialogDocument(doc, { mode }), [doc, mode])
  const canExport = result.errors.length === 0
  const required = useMemo(() => hasRequiredText(doc), [doc])
  const output = useMemo(() => {
    if (!canExport) return null
    return mode === 'inline' ? emitInline(doc) : emitModule(doc)
  }, [doc, mode, canExport])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Export {doc.title || doc.name}</DialogTitle>
      <DialogContent dividers>
        <Tabs value={mode} onChange={(_, v) => setMode(v)} sx={{ mb: 2 }}>
          <Tab value="inline" label="Inline — paste into the NPC" />
          <Tab value="module" label="Module — shared by several NPCs" />
        </Tabs>

        {result.errors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              Export is refused while these stand:
            </Typography>
            {result.errors.map((e, i) => (
              <div key={i}>• {e.message}</div>
            ))}
          </Alert>
        )}
        {result.warnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {result.warnings.map((w, i) => (
              <div key={i}>• {w.message}</div>
            ))}
          </Alert>
        )}

        {output && mode === 'inline' && (
          <>
            <CodeBlock
              title="1. Text table"
              hint="Paste above OnSpawn, with the script's other text tables."
              code={output.table}
            />
            <CodeBlock
              title="2. OnSpawn block"
              hint="Paste inside function OnSpawn(), after any other dialogs."
              code={output.onSpawn}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Text is keyed by sequence, so <code>{doc.name}.menu</code> is the menu text. To let
              several NPCs share this dialog with their own words, export as a module.
            </Typography>
          </>
        )}

        {output && mode === 'module' && (
          <>
            <CodeBlock
              title={`1. Module file — scripts/modules/dialogs/${doc.name}.lua`}
              hint="Save as that file. Hand-written callbacks go below the marked line."
              code={output.module}
            />
            <CodeBlock
              title="2. In each NPC's OnSpawn"
              hint={
                required
                  ? 'Every text key with its default. Fill the required ones; delete any you keep as is.'
                  : 'Every text key with its default. Edit for this NPC; delete any you keep as is.'
              }
              code={output.host}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              A callback this dialog names as <code>{doc.name}.something()</code> is a function you
              write below the marker in the module file, as <code>M.something</code>.
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export default ExportDialog

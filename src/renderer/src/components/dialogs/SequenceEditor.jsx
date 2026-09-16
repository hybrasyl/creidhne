import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  DIALOG_KINDS,
  DIALOG_KIND_LABELS,
  SEQUENCE_SCOPES,
  SEQUENCE_SCOPE_LABELS,
  newDialog,
  newEndDialog
} from '@shared/dialogDocument.js'
import DialogRow from './DialogRow'
import { fieldProblem } from './DialogEditor'
import { helpProps } from './FieldHelp'

const SCOPE_HELP = {
  local: 'Registered on the NPC; reached by a jump.',
  pursuit: 'An entry in the NPC menu. Its name is the menu label the player sees.',
  global: 'Registered on the world, so any script can start it by name.'
}

function SequenceEditor({ sequence, sequenceNames, problems, onChange, onRemove }) {
  const mine = (p) => p.sequenceId === sequence.id && !p.dialogId
  const problem = (field) => fieldProblem(problems, mine, field)
  // The banner: every sequence-level warning, and any sequence-level error
  // that has no field to be marked on. Errors with a field are marked inline.
  const banner = [
    ...problems.errors.filter((p) => mine(p) && !p.field),
    ...problems.warnings.filter(mine)
  ]
  const set = (field) => (e) =>
    onChange({
      ...sequence,
      [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value
    })

  const addDialog = (dialog) => onChange({ ...sequence, dialogs: [...sequence.dialogs, dialog] })
  const updateDialog = (id, next) =>
    onChange({ ...sequence, dialogs: sequence.dialogs.map((d) => (d.id === id ? next : d)) })
  const removeDialog = (id) =>
    onChange({ ...sequence, dialogs: sequence.dialogs.filter((d) => d.id !== id) })
  const moveDialog = (id, delta) => {
    const i = sequence.dialogs.findIndex((d) => d.id === id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= sequence.dialogs.length) return
    const next = [...sequence.dialogs]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange({ ...sequence, dialogs: next })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <TextField
            size="small"
            label="Sequence name"
            value={sequence.name}
            onChange={set('name')}
            error={!!problems.errors.find((p) => mine(p) && p.field === 'name')}
            helperText={problems.errors.find((p) => mine(p) && p.field === 'name')?.message}
            sx={{ width: 300 }}
            slotProps={helpProps(
              sequence.scope === 'pursuit'
                ? 'The label the player sees in the NPC menu. Also the key a script starts it by.'
                : 'The key jumps and scripts use to reach this sequence.'
            )}
          />
          <FormControl size="small" sx={{ width: 140 }}>
            <InputLabel>Scope</InputLabel>
            <Select label="Scope" value={sequence.scope} onChange={set('scope')}>
              {SEQUENCE_SCOPES.map((s) => (
                <MenuItem key={s} value={s}>
                  {SEQUENCE_SCOPE_LABELS[s]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', pt: 1, flex: 1, minWidth: 200 }}
          >
            {SCOPE_HELP[sequence.scope]}
          </Typography>
          <Tooltip title="Remove this sequence">
            <IconButton size="small" color="error" onClick={onRemove}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        {banner.map((p, i) => (
          <Alert
            key={i}
            severity={p.level === 'error' ? 'error' : 'warning'}
            variant="outlined"
            sx={{ mt: 1.5, py: 0 }}
          >
            {p.message}
          </Alert>
        ))}
        {sequence.scope === 'pursuit' && (
          <TextField
            size="small"
            fullWidth
            label="Menu check (optional)"
            value={sequence.menuCheck}
            onChange={set('menuCheck')}
            error={!!problems.errors.find((p) => mine(p) && p.field === 'menuCheck')}
            helperText={problems.errors.find((p) => mine(p) && p.field === 'menuCheck')?.message}
            sx={{ mt: 2 }}
            slotProps={helpProps(
              'Lua that returns true when this entry should appear in the menu, e.g. return priest_oaths_available() == true',
              { mono: true }
            )}
          />
        )}
        {sequence.scope === 'global' && (
          <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              label="Display name"
              value={sequence.displayName}
              onChange={set('displayName')}
              sx={{ width: 260 }}
              slotProps={helpProps("Optional. The speaker's name shown in the dialog frame.")}
            />
            <TextField
              size="small"
              label="Sprite"
              value={sequence.sprite}
              onChange={set('sprite')}
              error={!!problem('sprite')}
              helperText={problem('sprite')?.message}
              sx={{ width: 120 }}
              slotProps={{
                ...helpProps('Optional. The NPC sprite shown with a global sequence.'),
                htmlInput: { inputMode: 'numeric' }
              }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={sequence.associateWithScript}
                  onChange={set('associateWithScript')}
                />
              }
              label={
                <Typography variant="body2">Associate with this script (for callbacks)</Typography>
              }
            />
          </Box>
        )}
      </Paper>

      {problem('dialogs') && (
        <Typography variant="caption" color="error">
          {problem('dialogs').message}
        </Typography>
      )}

      {sequence.dialogs.map((dialog, i) => (
        <DialogRow
          key={dialog.id}
          index={i}
          count={sequence.dialogs.length}
          dialog={dialog}
          sequenceId={sequence.id}
          sequenceNames={sequenceNames}
          problems={problems}
          onChange={(next) => updateDialog(dialog.id, next)}
          onRemove={() => removeDialog(dialog.id)}
          onMove={(delta) => moveDialog(dialog.id, delta)}
        />
      ))}

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Add
        </Typography>
        <ButtonGroup size="small" variant="outlined">
          {DIALOG_KINDS.map((kind) => (
            <Button key={kind} onClick={() => addDialog(newDialog(kind))}>
              {DIALOG_KIND_LABELS[kind]}
            </Button>
          ))}
        </ButtonGroup>
        <Tooltip title="A function dialog that ends the conversation: source.EndDialog()">
          <Button size="small" variant="outlined" onClick={() => addDialog(newEndDialog())}>
            End dialog
          </Button>
        </Tooltip>
      </Box>
    </Box>
  )
}

export default SequenceEditor

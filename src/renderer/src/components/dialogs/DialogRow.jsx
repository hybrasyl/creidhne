import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  DIALOG_KIND_LABELS,
  END_DIALOG_EXPR,
  INPUT_MAX_LENGTH,
  hasText,
  newOption
} from '@shared/dialogDocument.js'
import { fieldProblem } from './DialogEditor'

const mono = { htmlInput: { spellCheck: false, style: { fontFamily: 'monospace' } } }

/** A jump target: any sequence in the document, or a name typed ahead of it. */
function SequencePicker({ label, value, onChange, sequenceNames, error, helperText, sx }) {
  return (
    <Autocomplete
      freeSolo
      size="small"
      options={sequenceNames}
      value={value || ''}
      onInputChange={(_, v, reason) => {
        if (reason === 'input') onChange(v)
      }}
      onChange={(_, v) => onChange(v ?? '')}
      sx={sx}
      renderInput={(params) => (
        <TextField {...params} label={label} error={error} helperText={helperText} />
      )}
    />
  )
}

function DialogRow({
  index,
  count,
  dialog,
  sequenceId,
  sequenceNames,
  problems,
  onChange,
  onRemove,
  onMove
}) {
  const mine = (p) => p.sequenceId === sequenceId && p.dialogId === dialog.id && !p.optionId
  const problem = (field) => fieldProblem(problems, mine, field)
  const isError = (field) => !!problems.errors.find((p) => mine(p) && p.field === field)
  const set = (field) => (e) => onChange({ ...dialog, [field]: e.target.value })

  const rowProblems = [...problems.errors, ...problems.warnings].filter(
    (p) => p.sequenceId === sequenceId && p.dialogId === dialog.id && !p.field
  )

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Chip
          size="small"
          label={`${index + 1} · ${DIALOG_KIND_LABELS[dialog.kind]}`}
          color={
            dialog.kind === 'function' && dialog.expr === END_DIALOG_EXPR ? 'default' : 'primary'
          }
          variant="outlined"
        />
        {rowProblems.map((p) => (
          <Typography
            key={p.message}
            variant="caption"
            sx={{ color: p.level === 'error' ? 'error.main' : 'warning.main' }}
          >
            {p.message}
          </Typography>
        ))}
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUpwardIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" disabled={index === count - 1} onClick={() => onMove(1)}>
          <ArrowDownwardIcon fontSize="small" />
        </IconButton>
        <Tooltip title="Remove this dialog">
          <IconButton size="small" color="error" onClick={onRemove}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {hasText(dialog.kind) && (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={2}
            label={dialog.slot ? `Text (default for slot "${dialog.slot}")` : 'Text'}
            value={dialog.text}
            onChange={set('text')}
            error={isError('text')}
            helperText={problem('text')?.message}
            slotProps={{ htmlInput: { maxLength: 65534 } }}
          />
          <Box sx={{ width: 200, flexShrink: 0 }}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={dialog.slot !== ''}
                  onChange={(e) => onChange({ ...dialog, slot: e.target.checked ? 'line' : '' })}
                />
              }
              label={
                <Tooltip title="A slot is text the host NPC supplies when this dialog is exported as a module. The text here is the default.">
                  <Typography variant="body2">Slot</Typography>
                </Tooltip>
              }
            />
            {dialog.slot !== '' && (
              <TextField
                size="small"
                fullWidth
                label="Slot name"
                value={dialog.slot}
                onChange={set('slot')}
                error={isError('slot')}
                helperText={problem('slot')?.message}
                slotProps={mono}
              />
            )}
          </Box>
        </Box>
      )}

      {dialog.kind === 'text' && (
        <TextField
          size="small"
          fullWidth
          label="Callback (optional)"
          value={dialog.callback}
          onChange={set('callback')}
          error={isError('callback')}
          helperText={problem('callback')?.message ?? 'Lua run when this dialog is shown.'}
          sx={{ mt: 1.5 }}
          slotProps={mono}
        />
      )}

      {dialog.kind === 'jump' && (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <SequencePicker
            label="Jump to sequence"
            value={dialog.sequence}
            onChange={(v) => onChange({ ...dialog, sequence: v })}
            sequenceNames={sequenceNames}
            error={isError('sequence')}
            helperText={problem('sequence')?.message}
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            label="Callback (optional)"
            value={dialog.callback}
            onChange={set('callback')}
            error={isError('callback')}
            helperText={problem('callback')?.message ?? 'Lua run as the jump happens.'}
            sx={{ flex: 1 }}
            slotProps={mono}
          />
        </Box>
      )}

      {dialog.kind === 'function' && (
        <TextField
          size="small"
          fullWidth
          label="Lua expression"
          value={dialog.expr}
          onChange={set('expr')}
          error={isError('expr')}
          helperText={
            problem('expr')?.message ??
            'Run in place of showing a dialog, e.g. source.EndDialog() or priest_oaths_check()'
          }
          slotProps={mono}
        />
      )}

      {dialog.kind === 'input' && (
        <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Top caption"
            value={dialog.topCaption}
            onChange={set('topCaption')}
            sx={{ flex: 1, minWidth: 160 }}
          />
          <TextField
            size="small"
            label="Bottom caption"
            value={dialog.bottomCaption}
            onChange={set('bottomCaption')}
            sx={{ flex: 1, minWidth: 160 }}
          />
          <TextField
            size="small"
            label="Max length"
            value={dialog.maxLength}
            onChange={(e) => onChange({ ...dialog, maxLength: Number(e.target.value) || 0 })}
            error={isError('maxLength')}
            helperText={problem('maxLength')?.message ?? `1–${INPUT_MAX_LENGTH}`}
            sx={{ width: 110 }}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          />
          <TextField
            size="small"
            label="Handler"
            value={dialog.handler}
            onChange={set('handler')}
            error={isError('handler')}
            helperText={
              problem('handler')?.message ?? 'Lua run with the answer in player_response.'
            }
            sx={{ flex: 1, minWidth: 200 }}
            slotProps={mono}
          />
          <TextField
            size="small"
            label="Callback (optional)"
            value={dialog.callback}
            onChange={set('callback')}
            error={isError('callback')}
            helperText={problem('callback')?.message ?? 'Lua run when shown.'}
            sx={{ flex: 1, minWidth: 200 }}
            slotProps={mono}
          />
        </Box>
      )}

      {dialog.kind === 'options' && (
        <OptionsList
          dialog={dialog}
          sequenceId={sequenceId}
          sequenceNames={sequenceNames}
          problems={problems}
          onChange={onChange}
        />
      )}
    </Paper>
  )
}

function OptionsList({ dialog, sequenceId, sequenceNames, problems, onChange }) {
  const listProblem = fieldProblem(
    problems,
    (p) => p.sequenceId === sequenceId && p.dialogId === dialog.id && !p.optionId,
    'options'
  )
  const setOptions = (options) => onChange({ ...dialog, options })
  const updateOption = (id, next) => setOptions(dialog.options.map((o) => (o.id === id ? next : o)))
  const removeOption = (id) => setOptions(dialog.options.filter((o) => o.id !== id))

  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Options
      </Typography>
      {listProblem && (
        <Typography variant="caption" color="error" sx={{ ml: 1 }}>
          {listProblem.message}
        </Typography>
      )}
      {dialog.options.map((option) => {
        const mine = (p) =>
          p.sequenceId === sequenceId && p.dialogId === dialog.id && p.optionId === option.id
        const problem = (field) => fieldProblem(problems, mine, field)
        const isError = (field) => !!problems.errors.find((p) => mine(p) && p.field === field)
        return (
          <Box key={option.id} sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'flex-start' }}>
            <TextField
              size="small"
              label="Label"
              value={option.label}
              onChange={(e) => updateOption(option.id, { ...option, label: e.target.value })}
              error={isError('label')}
              helperText={problem('label')?.message}
              sx={{ flex: 1, minWidth: 160 }}
            />
            <Select
              size="small"
              value={option.target.type}
              onChange={(e) =>
                updateOption(option.id, {
                  ...option,
                  target:
                    e.target.value === 'jump'
                      ? { type: 'jump', sequence: '' }
                      : { type: 'callback', expr: '' }
                })
              }
              sx={{ width: 120 }}
            >
              <MenuItem value="jump">Jump to</MenuItem>
              <MenuItem value="callback">Call</MenuItem>
            </Select>
            {option.target.type === 'jump' ? (
              <SequencePicker
                label="Sequence"
                value={option.target.sequence}
                onChange={(v) =>
                  updateOption(option.id, { ...option, target: { type: 'jump', sequence: v } })
                }
                sequenceNames={sequenceNames}
                error={isError('target')}
                helperText={problem('target')?.message}
                sx={{ flex: 1, minWidth: 160 }}
              />
            ) : (
              <TextField
                size="small"
                label="Lua expression"
                value={option.target.expr}
                onChange={(e) =>
                  updateOption(option.id, {
                    ...option,
                    target: { type: 'callback', expr: e.target.value }
                  })
                }
                error={isError('target')}
                helperText={problem('target')?.message}
                sx={{ flex: 1, minWidth: 160 }}
                slotProps={mono}
              />
            )}
            <TextField
              size="small"
              label="Show if (optional)"
              value={option.check}
              onChange={(e) => updateOption(option.id, { ...option, check: e.target.value })}
              error={isError('check')}
              helperText={problem('check')?.message}
              sx={{ width: 180 }}
              slotProps={mono}
            />
            <IconButton size="small" color="error" onClick={() => removeOption(option.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        )
      })}
      <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setOptions([...dialog.options, newOption()])}
        >
          Add option
        </Button>
        <TextField
          size="small"
          label="Handler (optional)"
          value={dialog.handler}
          onChange={(e) => onChange({ ...dialog, handler: e.target.value })}
          error={
            !!problems.errors.find(
              (p) =>
                p.sequenceId === sequenceId &&
                p.dialogId === dialog.id &&
                !p.optionId &&
                p.field === 'handler'
            )
          }
          helperText="Lua run when an option is picked."
          sx={{ flex: 1, minWidth: 200 }}
          slotProps={mono}
        />
        <TextField
          size="small"
          label="Callback (optional)"
          value={dialog.callback}
          onChange={(e) => onChange({ ...dialog, callback: e.target.value })}
          error={
            !!problems.errors.find(
              (p) =>
                p.sequenceId === sequenceId &&
                p.dialogId === dialog.id &&
                !p.optionId &&
                p.field === 'callback'
            )
          }
          helperText="Lua run when shown."
          sx={{ flex: 1, minWidth: 200 }}
          slotProps={mono}
        />
      </Box>
    </Box>
  )
}

export default DialogRow

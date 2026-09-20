import { useEffect, useState } from 'react'
import {
  Box,
  Chip,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import { newSequence, SEQUENCE_SCOPE_LABELS } from '@shared/dialogDocument.js'
import SequenceEditor from './SequenceEditor'
import { helpProps } from './FieldHelp'

/** The problems (errors + warnings) about one sequence, or the document itself. */
export function problemsFor(problems, match) {
  return [...problems.errors, ...problems.warnings].filter(match)
}

/** The first error on a field, for `error` / `helperText`. */
export function fieldProblem(problems, match, field) {
  return (
    problems.errors.find((p) => p.field === field && match(p)) ??
    problems.warnings.find((p) => p.field === field && match(p)) ??
    null
  )
}

function DialogEditor({ doc, onChange, problems }) {
  const [selectedId, setSelectedId] = useState(doc.sequences[0]?.id ?? null)

  // A load, a delete or an undo can remove the selected sequence; fall back to
  // the first one rather than showing an editor for nothing.
  useEffect(() => {
    if (!doc.sequences.some((s) => s.id === selectedId)) {
      setSelectedId(doc.sequences[0]?.id ?? null)
    }
  }, [doc, selectedId])

  const docProblem = (field) => fieldProblem(problems, (p) => !p.sequenceId, field)
  const setField = (field) => (e) => onChange({ ...doc, [field]: e.target.value })

  const addSequence = () => {
    const seq = newSequence('')
    onChange({ ...doc, sequences: [...doc.sequences, seq] })
    setSelectedId(seq.id)
  }
  const updateSequence = (id, next) =>
    onChange({ ...doc, sequences: doc.sequences.map((s) => (s.id === id ? next : s)) })
  const removeSequence = (id) =>
    onChange({ ...doc, sequences: doc.sequences.filter((s) => s.id !== id) })
  const moveSequence = (id, delta) => {
    const i = doc.sequences.findIndex((s) => s.id === id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= doc.sequences.length) return
    const next = [...doc.sequences]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange({ ...doc, sequences: next })
  }

  const selected = doc.sequences.find((s) => s.id === selectedId) ?? null
  const sequenceNames = doc.sequences.map((s) => s.name).filter(Boolean)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Name"
            value={doc.name}
            onChange={setField('name')}
            error={!!docProblem('name')}
            helperText={docProblem('name')?.message}
            sx={{ width: 260 }}
            slotProps={helpProps(
              'Lower snake case, e.g. on_honey. Names the saved file, the Lua text table, and the module.'
            )}
          />
          <TextField
            size="small"
            label="Title"
            value={doc.title}
            onChange={setField('title')}
            sx={{ width: 260 }}
            slotProps={helpProps(
              'Shown in the list and in the generated comment. Not used by the server.'
            )}
          />
          <TextField
            size="small"
            label="Description"
            value={doc.description}
            onChange={setField('description')}
            sx={{ flex: 1, minWidth: 240 }}
            slotProps={helpProps(
              'Notes for the next writer. Saved with the dialog, never exported.'
            )}
          />
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
        <Paper
          variant="outlined"
          sx={{
            width: 260,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1 }}>
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              Sequences
            </Typography>
            <Tooltip title="Add a sequence">
              <IconButton size="small" onClick={addSequence}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          {docProblem('sequences') && (
            <Typography variant="caption" color="error" sx={{ px: 2 }}>
              {docProblem('sequences').message}
            </Typography>
          )}
          <List dense disablePadding sx={{ overflow: 'auto', flex: 1 }}>
            {doc.sequences.map((seq, i) => {
              const errs = problems.errors.filter((p) => p.sequenceId === seq.id).length
              const warns = problems.warnings.filter((p) => p.sequenceId === seq.id).length
              return (
                <ListItemButton
                  key={seq.id}
                  selected={seq.id === selectedId}
                  onClick={() => setSelectedId(seq.id)}
                  sx={{ pr: 1 }}
                >
                  <ListItemText
                    primary={seq.name || <em>unnamed</em>}
                    secondary={`${SEQUENCE_SCOPE_LABELS[seq.scope]} · ${seq.dialogs.length} dialog${seq.dialogs.length === 1 ? '' : 's'}`}
                    slotProps={{
                      primary: { variant: 'body2', noWrap: true },
                      secondary: { variant: 'caption' }
                    }}
                  />
                  {errs > 0 && <Chip size="small" color="error" label={errs} sx={{ ml: 0.5 }} />}
                  {errs === 0 && warns > 0 && (
                    <Chip
                      size="small"
                      color="warning"
                      variant="outlined"
                      label={warns}
                      sx={{ ml: 0.5 }}
                    />
                  )}
                  <Box sx={{ display: 'flex', flexDirection: 'column', ml: 0.5 }}>
                    <IconButton
                      size="small"
                      disabled={i === 0}
                      onClick={(e) => {
                        e.stopPropagation()
                        moveSequence(seq.id, -1)
                      }}
                      sx={{ p: 0 }}
                    >
                      <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      disabled={i === doc.sequences.length - 1}
                      onClick={(e) => {
                        e.stopPropagation()
                        moveSequence(seq.id, 1)
                      }}
                      sx={{ p: 0 }}
                    >
                      <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                </ListItemButton>
              )
            })}
          </List>
          {doc.sequences.length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary', px: 2, pb: 2 }}>
              No sequences yet. Add one with +.
            </Typography>
          )}
        </Paper>

        <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          {selected ? (
            <SequenceEditor
              key={selected.id}
              sequence={selected}
              sequenceNames={sequenceNames}
              problems={problems}
              onChange={(next) => updateSequence(selected.id, next)}
              onRemove={() => removeSequence(selected.id)}
            />
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>
              Add a sequence to begin. A pursuit is what the player sees in the NPC&apos;s menu;
              local sequences are reached by jumps from it.
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  )
}

export default DialogEditor

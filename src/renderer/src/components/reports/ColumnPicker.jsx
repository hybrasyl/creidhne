import { useMemo } from 'react'
import {
  Box,
  Checkbox,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Tooltip,
  Typography
} from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import CloseIcon from '@mui/icons-material/Close'

/**
 * Which castable fields a report exports, and in what order (WP2).
 *
 * Two panes rather than one checkbox list, because a report needs an order as
 * well as a set. The left pane groups the chosen entity's field catalogue by the
 * `group` each entry already carries; the right pane is the report's own column
 * order.
 *
 * Props:
 *   catalogue — that entity's columns, `{ key, label, group }` (WP3)
 *   value     — record keys, in export order
 *   onChange  — (keys: string[]) => void
 *   disabled  — a built-in report: readable, never editable
 */
function ColumnPicker({ catalogue, value, onChange, disabled }) {
  const selected = value ?? []

  const groups = useMemo(() => {
    const byGroup = new Map()
    for (const column of catalogue ?? []) {
      if (!byGroup.has(column.group)) byGroup.set(column.group, [])
      byGroup.get(column.group).push(column)
    }
    return [...byGroup]
  }, [catalogue])

  const labelFor = useMemo(
    () => new Map((catalogue ?? []).map((c) => [c.key, c.label])),
    [catalogue]
  )

  const toggle = (key) => {
    if (disabled) return
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key])
  }

  // Swapping with the neighbour, rather than splice-and-insert: the only two
  // moves the buttons offer are one step each way.
  const move = (index, by) => {
    const target = index + by
    if (disabled || target < 0 || target >= selected.length) return
    const next = [...selected]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, minHeight: 0 }}>
      <Paper variant="outlined" sx={{ flex: 1, p: 1, maxHeight: 360, overflow: 'auto' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Available fields
        </Typography>
        {groups.map(([group, columns]) => (
          <Box key={group} sx={{ mt: 1 }}>
            <Typography variant="subtitle2">{group}</Typography>
            <Divider />
            {columns.map((column) => (
              <FormControlLabel
                key={column.key}
                sx={{ display: 'block', ml: 0 }}
                control={
                  <Checkbox
                    size="small"
                    disabled={disabled}
                    checked={selected.includes(column.key)}
                    onChange={() => toggle(column.key)}
                  />
                }
                label={<Typography variant="body2">{column.label}</Typography>}
              />
            ))}
          </Box>
        ))}
      </Paper>

      <Paper variant="outlined" sx={{ flex: 1, p: 1, maxHeight: 360, overflow: 'auto' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Columns, in order ({selected.length})
        </Typography>
        {selected.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            Choose at least one field.
          </Typography>
        ) : (
          <List dense disablePadding>
            {selected.map((key, index) => (
              <ListItem
                key={key}
                disableGutters
                secondaryAction={
                  disabled ? null : (
                    <Box>
                      <Tooltip title="Move up">
                        <span>
                          <IconButton
                            size="small"
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUpwardIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Move down">
                        <span>
                          <IconButton
                            size="small"
                            disabled={index === selected.length - 1}
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDownwardIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Remove">
                        <IconButton size="small" onClick={() => toggle(key)}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )
                }
              >
                {/* MUI v9 has no primaryTypographyProps — the variant goes
                    through slotProps.primary. */}
                <ListItemText
                  primary={labelFor.get(key) ?? key}
                  slotProps={{ primary: { variant: 'body2' } }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  )
}

export default ColumnPicker

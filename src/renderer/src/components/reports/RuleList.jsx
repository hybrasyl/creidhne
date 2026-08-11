import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { FILTERABLE_FIELDS, OPERATORS, getFilterableField } from '@shared/reportRules.js'

/**
 * A report's filter, as rows (WP2).
 *
 * One level of all-of / any-of and no nesting. That is a deliberate ceiling: a
 * nested query builder is the thing every one of these grows into, and nobody
 * reads the result.
 *
 * The field list, the operators each field allows, and the value lists all come
 * from `FILTERABLE_FIELDS`. Nothing is restated here, so the UI cannot offer a
 * rule the compiler then refuses.
 *
 * Props:
 *   match    — 'all' | 'any'
 *   rules    — [{ field, op, value }]
 *   onChange — ({ match, rules }) => void
 *   disabled — a built-in report: readable, never editable
 */
function RuleList({ match, rules, onChange, disabled }) {
  const list = rules ?? []

  const set = (next) => onChange({ match: match ?? 'all', rules: list, ...next })
  const setRule = (index, over) =>
    set({ rules: list.map((rule, i) => (i === index ? { ...rule, ...over } : rule)) })

  // Changing the field changes which operators are legal, so the operator and
  // the value are reset with it. Keeping a stale operator would produce a rule
  // that only fails when the report runs.
  const changeField = (index, field) => {
    const spec = getFilterableField(field)
    setRule(index, { field, op: spec.ops[0], value: defaultValueFor(spec, spec.ops[0]) })
  }

  const changeOp = (index, op) => {
    const spec = getFilterableField(list[index].field)
    const current = list[index].value
    // `between` needs two values and every other operator needs one, so the
    // value only resets when the shape changes.
    const shapeChanged = (op === 'between') !== Array.isArray(current)
    setRule(index, { op, ...(shapeChanged ? { value: defaultValueFor(spec, op) } : {}) })
  }

  const addRule = () => {
    const spec = FILTERABLE_FIELDS[0]
    set({
      rules: [
        ...list,
        { field: spec.field, op: spec.ops[0], value: defaultValueFor(spec, spec.ops[0]) }
      ]
    })
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="body2">Match</Typography>
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <Select
            value={match ?? 'all'}
            disabled={disabled}
            onChange={(e) => set({ match: e.target.value })}
          >
            <MenuItem value="all">all of</MenuItem>
            <MenuItem value="any">any of</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="body2">
          {list.length === 0 ? 'these rules — with none, every castable' : 'these rules'}
        </Typography>
      </Box>

      {list.map((rule, index) => {
        const spec = getFilterableField(rule.field)
        return (
          <Paper
            key={index}
            variant="outlined"
            sx={{ p: 1, mb: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
          >
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel>Field</InputLabel>
              <Select
                label="Field"
                value={rule.field}
                disabled={disabled}
                onChange={(e) => changeField(index, e.target.value)}
              >
                {FILTERABLE_FIELDS.map((f) => (
                  <MenuItem key={f.field} value={f.field}>
                    {f.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Is</InputLabel>
              <Select
                label="Is"
                value={rule.op}
                disabled={disabled}
                onChange={(e) => changeOp(index, e.target.value)}
              >
                {(spec?.ops ?? []).map((op) => (
                  <MenuItem key={op} value={op}>
                    {OPERATORS[op].label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <ValueEditor
              spec={spec}
              rule={rule}
              disabled={disabled}
              onChange={(value) => setRule(index, { value })}
            />

            {!disabled && (
              <Tooltip title="Remove rule">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => set({ rules: list.filter((_, i) => i !== index) })}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Paper>
        )
      })}

      {!disabled && (
        <Button size="small" startIcon={<AddIcon />} onClick={addRule}>
          Add rule
        </Button>
      )}
    </Box>
  )
}

/** The value a newly chosen field and operator start on. */
function defaultValueFor(spec, op) {
  if (op === 'between') return [1, 99]
  switch (spec?.kind) {
    case 'boolean':
      return true
    case 'enum':
      return spec.values?.[0] ?? ''
    case 'number':
      return 1
    default:
      return ''
  }
}

/** The right editor for the field's kind: a select where the values are known. */
function ValueEditor({ spec, rule, disabled, onChange }) {
  if (!spec) return null

  if (rule.op === 'between') {
    const [from, to] = Array.isArray(rule.value) ? rule.value : [1, 99]
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TextField
          size="small"
          type="number"
          label="From"
          sx={{ width: 100 }}
          value={from}
          disabled={disabled}
          onChange={(e) => onChange([Number(e.target.value), to])}
        />
        <TextField
          size="small"
          type="number"
          label="To"
          sx={{ width: 100 }}
          value={to}
          disabled={disabled}
          onChange={(e) => onChange([from, Number(e.target.value)])}
        />
      </Box>
    )
  }

  if (spec.kind === 'boolean') {
    return (
      <FormControl size="small" sx={{ minWidth: 110 }}>
        <InputLabel>Value</InputLabel>
        <Select
          label="Value"
          value={rule.value === true ? 'true' : 'false'}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === 'true')}
        >
          <MenuItem value="true">yes</MenuItem>
          <MenuItem value="false">no</MenuItem>
        </Select>
      </FormControl>
    )
  }

  if (spec.kind === 'enum') {
    return (
      <FormControl size="small" sx={{ minWidth: 170 }}>
        <InputLabel>Value</InputLabel>
        <Select
          label="Value"
          value={rule.value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          {spec.values.map((v) => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    )
  }

  return (
    <TextField
      size="small"
      label="Value"
      type={spec.kind === 'number' ? 'number' : 'text'}
      sx={{ minWidth: 170 }}
      value={rule.value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(spec.kind === 'number' ? Number(e.target.value) : e.target.value)}
      slotProps={{ htmlInput: { spellCheck: false } }}
    />
  )
}

export default RuleList

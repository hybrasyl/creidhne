import React from 'react';
import {
  Box, TextField, FormControl, InputLabel, Select, MenuItem,
  IconButton, Button, Typography, Autocomplete,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import {
  VARIABLE_PREFIXES, getStatGroupsForPrefix, getStatsForPrefix,
} from '../../data/formulaVariables';

/**
 * Builds a weighted stat expression for formula patterns.
 *
 * Props:
 *   rows     — [{ stat: 'SOURCESTR', weight: 3, prefix: 'SOURCE' }, ...]
 *   onChange  — (rows) => void
 *
 * Output expression: "SOURCESTR * 3 + SOURCEDEX * 1 + TARGETCON * 1"
 */
function StatBlockBuilder({ rows = [], onChange }) {
  const usedStats = rows.map((r) => r.stat);

  const addRow = () => {
    const prefix = rows.length > 0 ? rows[rows.length - 1].prefix || 'SOURCE' : 'SOURCE';
    const available = getStatsForPrefix(prefix);
    const next = available.find((s) => !usedStats.includes(s.key));
    if (!next) return;
    onChange([...rows, { stat: next.key, weight: 1, prefix }]);
  };

  const removeRow = (index) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const updatePrefix = (index, prefix) => {
    // When prefix changes, pick the first available stat for that prefix
    const available = getStatsForPrefix(prefix);
    const next = available.find((s) => !usedStats.includes(s.key) || s.key === rows[index].stat);
    onChange(rows.map((r, i) => (i === index ? { ...r, prefix, stat: next?.key || r.stat } : r)));
  };

  const updateStat = (index, stat) => {
    onChange(rows.map((r, i) => (i === index ? { ...r, stat } : r)));
  };

  const updateWeight = (index, weight) => {
    onChange(rows.map((r, i) => (i === index ? { ...r, weight } : r)));
  };

  return (
    <Box>
      {rows.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          No stats selected. Add stats to build the weighted expression.
        </Typography>
      )}

      {rows.map((row, index) => {
        const prefix = row.prefix || 'SOURCE';
        const allForPrefix = getStatsForPrefix(prefix);
        // Available options: current selection + unused stats
        const options = allForPrefix.filter(
          (s) => s.key === row.stat || !usedStats.includes(s.key),
        );
        const selectedOption = allForPrefix.find((s) => s.key === row.stat) || null;

        return (
          <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.75 }}>
            {index > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ width: 16, textAlign: 'center' }}>+</Typography>
            )}
            {index === 0 && <Box sx={{ width: 16 }} />}
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>Type</InputLabel>
              <Select value={prefix} label="Type" onChange={(e) => updatePrefix(index, e.target.value)}>
                {VARIABLE_PREFIXES.map((p) => (
                  <MenuItem key={p.key} value={p.key}>{p.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Autocomplete
              size="small" sx={{ minWidth: 220 }}
              options={options}
              groupBy={(opt) => opt.group}
              getOptionLabel={(opt) => opt.label}
              isOptionEqualToValue={(opt, val) => opt.key === val.key}
              value={selectedOption}
              onChange={(_, val) => { if (val) updateStat(index, val.key); }}
              renderInput={(params) => <TextField {...params} label="Stat" />}
              disableClearable
            />
            <Typography variant="body2" color="text.secondary">×</Typography>
            <TextField
              size="small" type="number" sx={{ width: 80 }}
              value={row.weight}
              onChange={(e) => updateWeight(index, e.target.value === '' ? '' : Number(e.target.value))}
            />
            <IconButton size="small" onClick={() => removeRow(index)} color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      })}

      <Button size="small" startIcon={<AddIcon />} onClick={addRow} sx={{ mt: 0.5 }}>
        Add Stat
      </Button>

      {/* Preview */}
      {rows.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontFamily: 'monospace' }}>
          {rows.map((r) => `${r.stat} * ${r.weight}`).join(' + ')}
        </Typography>
      )}
    </Box>
  );
}

/** Convert rows array to NCalc expression string */
export function statBlockToExpression(rows) {
  if (!rows || rows.length === 0) return '0';
  return rows.map((r) => `${r.stat} * ${r.weight}`).join(' + ');
}

/** Parse an NCalc stat expression back into rows */
export function expressionToStatBlock(expr) {
  if (!expr || expr === '0') return [];
  const rows = [];
  const parts = expr.split('+').map((p) => p.trim());
  for (const part of parts) {
    const m = /^(\w+)\s*\*\s*(.+)$/.exec(part);
    if (m) {
      const stat = m[1];
      const weight = Number(m[2]);
      // Infer prefix from the stat key
      const prefix = VARIABLE_PREFIXES.find((p) => stat.startsWith(p.key))?.key || 'SOURCE';
      rows.push({ stat, weight: isNaN(weight) ? 1 : weight, prefix });
    }
  }
  return rows;
}

export default StatBlockBuilder;

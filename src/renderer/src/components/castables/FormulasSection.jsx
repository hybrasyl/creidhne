import React from 'react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import HealEditor from '../shared/HealEditor';
import DamageEditor from '../shared/DamageEditor';

const DEFAULT_HEAL   = { kind: 'Static', value: '', min: '', max: '', formula: '' };
const DEFAULT_DAMAGE = { kind: 'Static', type: 'Direct', flags: [], value: '', min: '', max: '', formula: '' };

function HealRow({ heal, onChange, onRemove }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }}>
      <Typography variant="caption" sx={{ width: 52, color: 'text.secondary', flexShrink: 0 }}>Heal</Typography>
      <HealEditor value={heal} onChange={onChange} />
      <IconButton size="small" color="error" onClick={onRemove} sx={{ flexShrink: 0 }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

function DamageRow({ damage, onChange, onRemove }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1.5, flexWrap: 'wrap' }}>
      <Typography variant="caption" sx={{ width: 52, color: 'text.secondary', flexShrink: 0, pt: 1.25 }}>Damage</Typography>
      <Box sx={{ flex: 1 }}>
        <DamageEditor value={damage} onChange={onChange} />
      </Box>
      <IconButton size="small" color="error" onClick={onRemove} sx={{ flexShrink: 0 }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

function FormulasSection({ heal, damage, onChange }) {
  return (
    <Box>
      {heal && (
        <HealRow
          heal={heal}
          onChange={(val) => onChange({ heal: val, damage })}
          onRemove={() => onChange({ heal: null, damage })}
        />
      )}
      {damage && (
        <DamageRow
          damage={damage}
          onChange={(val) => onChange({ heal, damage: val })}
          onRemove={() => onChange({ heal, damage: null })}
        />
      )}
      <Box sx={{ display: 'flex', gap: 1, mt: (heal || damage) ? 1 : 0 }}>
        {!heal && (
          <Button size="small" startIcon={<AddIcon />} onClick={() => onChange({ heal: { ...DEFAULT_HEAL }, damage })}>
            Add Heal
          </Button>
        )}
        {!damage && (
          <Button size="small" startIcon={<AddIcon />} onClick={() => onChange({ heal, damage: { ...DEFAULT_DAMAGE } })}>
            Add Damage
          </Button>
        )}
      </Box>
    </Box>
  );
}

export default FormulasSection;

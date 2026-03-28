import React from 'react';
import { Box, TextField, Typography, Divider } from '@mui/material';

const PLAYER_CLASSES = [
  { key: 'peasant', label: 'Peasant' },
  { key: 'warrior', label: 'Warrior' },
  { key: 'wizard',  label: 'Wizard'  },
  { key: 'priest',  label: 'Priest'  },
  { key: 'rogue',   label: 'Rogue'   },
  { key: 'monk',    label: 'Monk'    },
];

const DEFAULT_MOTION        = { id: '', speed: '' };
const DEFAULT_PLAYER_MOTION = { id: '1', speed: '20' };

const DEFAULT_GROUP = {
  player: {
    peasant: { ...DEFAULT_PLAYER_MOTION }, warrior: { ...DEFAULT_PLAYER_MOTION },
    wizard:  { ...DEFAULT_PLAYER_MOTION }, priest:  { ...DEFAULT_PLAYER_MOTION },
    rogue:   { ...DEFAULT_PLAYER_MOTION }, monk:    { ...DEFAULT_PLAYER_MOTION },
  },
  target: { ...DEFAULT_MOTION },
};

function MotionRow({ label, motion, onChange }) {
  const setNum = (field) => (e) => onChange({ ...motion, [field]: e.target.value.replace(/\D/g, '') });
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.75 }}>
      <Typography variant="body2" sx={{ width: 72, flexShrink: 0, color: 'text.secondary' }}>{label}</Typography>
      <TextField label="ID"    size="small" sx={{ width: 90 }} value={motion.id    || ''} onChange={setNum('id')}    inputProps={{ inputMode: 'numeric' }} />
      <TextField label="Speed" size="small" sx={{ width: 90 }} value={motion.speed || ''} onChange={setNum('speed')} inputProps={{ inputMode: 'numeric' }} />
    </Box>
  );
}

function AnimationGroup({ group, onChange }) {
  const setPlayer = (cls, val) => onChange({ ...group, player: { ...group.player, [cls]: val } });
  const setTarget = (val)      => onChange({ ...group, target: val });

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>Player</Typography>
      {PLAYER_CLASSES.map(({ key, label }) => (
        <MotionRow
          key={key}
          label={label}
          motion={group.player?.[key] || DEFAULT_MOTION}
          onChange={(v) => setPlayer(key, v)}
        />
      ))}
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>Target</Typography>
        <MotionRow
          label="Target"
          motion={group.target || DEFAULT_MOTION}
          onChange={setTarget}
        />
      </Box>
    </Box>
  );
}

function AnimationsSection({ sound, animations, onSoundChange, onAnimationsChange }) {
  const onCast = animations?.onCast || DEFAULT_GROUP;
  const onEnd  = animations?.onEnd  || DEFAULT_GROUP;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* Sound */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography variant="body2" sx={{ flexShrink: 0 }}>Sound</Typography>
        <TextField
          label="Sound ID" size="small" sx={{ width: 120 }}
          value={sound?.id || ''}
          onChange={(e) => onSoundChange({ id: e.target.value.replace(/\D/g, '') })}
          inputProps={{ inputMode: 'numeric' }}
        />
      </Box>

      <Divider />

      {/* OnCast */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>On Cast</Typography>
        <AnimationGroup
          group={onCast}
          onChange={(val) => onAnimationsChange({ onCast: val, onEnd })}
        />
      </Box>

      <Divider />

      {/* OnEnd */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>On End</Typography>
        <AnimationGroup
          group={onEnd}
          onChange={(val) => onAnimationsChange({ onCast, onEnd: val })}
        />
      </Box>

    </Box>
  );
}

export default AnimationsSection;

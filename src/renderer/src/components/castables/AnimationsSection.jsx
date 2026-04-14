import React from 'react';
import { Box, TextField, Typography, Divider, Switch, FormControlLabel, Button } from '@mui/material';
import SoundPicker from '../shared/SoundPicker';

const PLAYER_CLASSES = [
  { key: 'peasant', label: 'Peasant' },
  { key: 'warrior', label: 'Warrior' },
  { key: 'wizard',  label: 'Wizard'  },
  { key: 'priest',  label: 'Priest'  },
  { key: 'rogue',   label: 'Rogue'   },
  { key: 'monk',    label: 'Monk'    },
];

const EMPTY_MOTION = { id: '', speed: '' };

const EMPTY_GROUP = {
  player: {
    peasant: { ...EMPTY_MOTION }, warrior: { ...EMPTY_MOTION },
    wizard:  { ...EMPTY_MOTION }, priest:  { ...EMPTY_MOTION },
    rogue:   { ...EMPTY_MOTION }, monk:    { ...EMPTY_MOTION },
  },
  spellEffect: { ...EMPTY_MOTION },
  target:      { ...EMPTY_MOTION },
};

// class -> motionId for each preset
const SKILL_PRESET = { peasant: 1, warrior: 1, wizard: 1, priest: 1, rogue: 1, monk: 1 };
const SPELL_PRESET = { peasant: 6, warrior: 6, wizard: 136, priest: 128, rogue: 6, monk: 6 };

// Hardcoded fallback speeds per motion id
const FALLBACK_SPEEDS = { 1: 20, 6: 40, 128: 20, 129: 20, 130: 20, 131: 20, 132: 20, 133: 20, 134: 40, 135: 40, 136: 20, 137: 20, 138: 20, 139: 20, 140: 20, 141: 20, 142: 20, 143: 20, 144: 20, 145: 40 };

function lookupSpeed(id, motions) {
  const entry = (motions || []).find(m => String(m.id) === String(id));
  return entry ? String(entry.speed) : String(FALLBACK_SPEEDS[Number(id)] ?? 20);
}

function applyPreset(presetMap, motions) {
  const player = {};
  for (const cls of Object.keys(SKILL_PRESET)) {
    const id = presetMap[cls];
    player[cls] = { id: String(id), speed: lookupSpeed(id, motions) };
  }
  return { ...EMPTY_GROUP, player };
}

function MotionRow({ label, motion, onChange }) {
  const setNum = (field) => (e) => onChange({ ...motion, [field]: e.target.value.replace(/\D/g, '') });
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.75 }}>
      <Typography variant="body2" sx={{ width: 84, flexShrink: 0, color: 'text.secondary' }}>{label}</Typography>
      <TextField label="ID"    size="small" sx={{ width: 90 }} value={motion.id    || ''} onChange={setNum('id')}    inputProps={{ inputMode: 'numeric' }} />
      <TextField label="Speed" size="small" sx={{ width: 90 }} value={motion.speed || ''} onChange={setNum('speed')} inputProps={{ inputMode: 'numeric' }} />
    </Box>
  );
}

function AnimationGroup({ group, onChange }) {
  const setPlayer     = (cls, val) => onChange({ ...group, player:      { ...group.player, [cls]: val } });
  const setSpellEffect = (val)     => onChange({ ...group, spellEffect: val });
  const setTarget      = (val)     => onChange({ ...group, target:      val });

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>Player</Typography>
      {PLAYER_CLASSES.map(({ key, label }) => (
        <MotionRow
          key={key}
          label={label}
          motion={group.player?.[key] || EMPTY_MOTION}
          onChange={(v) => setPlayer(key, v)}
        />
      ))}
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>Spell Effect</Typography>
        <MotionRow label="Effect" motion={group.spellEffect || EMPTY_MOTION} onChange={setSpellEffect} />
      </Box>
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>Target</Typography>
        <MotionRow label="Target" motion={group.target || EMPTY_MOTION} onChange={setTarget} />
      </Box>
    </Box>
  );
}

function AnimationGroupSection({ label, group, motions, onToggle, onChange }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FormControlLabel
          control={<Switch checked={group !== null} onChange={(e) => onToggle(e.target.checked)} size="small" />}
          label={<Typography variant="subtitle2">{label}</Typography>}
        />
        {group !== null && (
          <>
            <Button size="small" variant="outlined" sx={{ py: 0, minWidth: 0, fontSize: '0.7rem' }}
              onClick={() => onChange(applyPreset(SKILL_PRESET, motions))}>
              Skill
            </Button>
            <Button size="small" variant="outlined" sx={{ py: 0, minWidth: 0, fontSize: '0.7rem' }}
              onClick={() => onChange(applyPreset(SPELL_PRESET, motions))}>
              Spell
            </Button>
          </>
        )}
      </Box>
      {group !== null && (
        <Box sx={{ mt: 1 }}>
          <AnimationGroup group={group} onChange={onChange} />
        </Box>
      )}
    </Box>
  );
}

function AnimationsSection({ sound, animations, motions, onSoundChange, onAnimationsChange }) {
  const onCast = animations?.onCast ?? null;
  const onEnd  = animations?.onEnd  ?? null;

  const toggleOnCast = (enabled) =>
    onAnimationsChange({ onCast: enabled ? { ...EMPTY_GROUP } : null, onEnd });
  const toggleOnEnd = (enabled) =>
    onAnimationsChange({ onCast, onEnd: enabled ? { ...EMPTY_GROUP } : null });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* Sound */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography variant="body2" sx={{ flexShrink: 0 }}>Sound</Typography>
        <SoundPicker
          label="Sound ID"
          width={120}
          value={sound?.id || ''}
          onChange={(val) => onSoundChange({ id: String(val).replace(/\D/g, '') })}
        />
      </Box>

      <Divider />

      <AnimationGroupSection
        label="On Cast"
        group={onCast}
        motions={motions}
        onToggle={toggleOnCast}
        onChange={(val) => onAnimationsChange({ onCast: val, onEnd })}
      />

      <Divider />

      <AnimationGroupSection
        label="On End"
        group={onEnd}
        motions={motions}
        onToggle={toggleOnEnd}
        onChange={(val) => onAnimationsChange({ onCast, onEnd: val })}
      />

    </Box>
  );
}

export default AnimationsSection;

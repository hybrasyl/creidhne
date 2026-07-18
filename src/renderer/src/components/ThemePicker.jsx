import { Box, ButtonBase, Typography } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { themesByName } from '../themes'

// Ordered list + labels for the six themes (matches the Settings THEMES list).
const THEME_OPTIONS = [
  { value: 'hybrasyl', label: 'Hybrasyl' },
  { value: 'chadul', label: 'Chadul' },
  { value: 'danaan', label: 'Danaan' },
  { value: 'grinneal', label: 'Grinneal' },
  { value: 'mundanes', label: 'Mundanes (light)' },
  { value: 'dubhaimid', label: 'Dubhaimid (dark)' }
]

// A live mini-preview of one theme, painted in THAT theme's own palette (not the
// active one) so each card shows what it would look like. Ported from mabon.
function ThemeSwatch({ name, label }) {
  const p = themesByName[name].palette
  const chips = [p.secondary.light, p.info.main, p.warning.main, p.primary.light]
  return (
    <Box
      sx={{
        bgcolor: p.background.default,
        p: 1.25,
        minHeight: 78,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 1,
        width: '100%'
      }}
    >
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        {chips.map((c, i) => (
          <Box
            key={i}
            sx={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              bgcolor: c,
              border: '1px solid rgba(0,0,0,0.35)'
            }}
          />
        ))}
      </Box>
      <Typography sx={{ color: p.text.primary, fontWeight: 600, fontSize: '0.82rem' }}>
        {label}
      </Typography>
    </Box>
  )
}

// The Settings theme picker: the six themes as selectable preview cards (a swatch
// of each palette + its name) rather than a bare dropdown — theming is a flagship
// feature, so it's worth showing. Selecting one round-trips through the store like
// the old Select did.
const ThemePicker = ({ value, onChange }) => {
  return (
    <Box
      role="radiogroup"
      aria-label="Theme"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 1.5
      }}
    >
      {THEME_OPTIONS.map(({ value: name, label }) => {
        const selected = value === name
        return (
          <ButtonBase
            key={name}
            role="radio"
            aria-checked={selected}
            aria-label={label}
            onClick={() => onChange(name)}
            sx={{
              display: 'block',
              textAlign: 'left',
              borderRadius: 1,
              overflow: 'hidden',
              position: 'relative',
              border: '2px solid',
              borderColor: selected ? 'primary.light' : 'divider',
              transition: 'border-color 0.15s',
              '&:hover': { borderColor: selected ? 'primary.light' : 'text.secondary' }
            }}
          >
            <ThemeSwatch name={name} label={label} />
            {selected && (
              <CheckCircleIcon
                sx={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                  fontSize: 20,
                  color: 'primary.light',
                  filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))'
                }}
              />
            )}
          </ButtonBase>
        )
      })}
    </Box>
  )
}

export default ThemePicker

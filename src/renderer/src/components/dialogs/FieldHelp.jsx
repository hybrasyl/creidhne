import { InputAdornment, Tooltip } from '@mui/material'
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined'

/**
 * A field's explanation as a hover tooltip on a small ? in the field, so the
 * helper-text line stays free for a validation message. Use as
 * `slotProps={{ input: { endAdornment: <FieldHelp text="…" /> } }}`.
 */
function FieldHelp({ text }) {
  return (
    <InputAdornment position="end">
      <Tooltip title={text} placement="top">
        <HelpOutlineOutlinedIcon fontSize="small" sx={{ color: 'text.disabled', cursor: 'help' }} />
      </Tooltip>
    </InputAdornment>
  )
}

/** The slotProps for a plain TextField with a help tooltip and, optionally, monospace input. */
export function helpProps(text, { mono = false } = {}) {
  return {
    input: { endAdornment: <FieldHelp text={text} /> },
    htmlInput: mono
      ? { spellCheck: false, style: { fontFamily: 'monospace' } }
      : { spellCheck: false }
  }
}

export default FieldHelp

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography
} from '@mui/material'
import { useStoreState, confirmDialogState } from '../store/appStore'

const OK = [{ value: 'ok', label: 'OK', variant: 'contained' }]

/** How many items the list shows before it says how many more there are. */
const MAX_ITEMS = 20

/**
 * The one confirm dialog (see `hooks/useConfirm.js`). Mounted once in App.
 */
export default function ConfirmDialog() {
  const [dialog, setDialog] = useStoreState(confirmDialogState)
  const answer = (value) => {
    dialog?.resolve(value)
    setDialog(null)
  }
  const items = dialog?.items ?? []
  const choices = dialog?.choices?.length ? dialog.choices : OK
  return (
    <Dialog open={!!dialog} onClose={() => answer(null)} data-testid="confirm-dialog">
      <DialogTitle>{dialog?.title}</DialogTitle>
      <DialogContent>
        {dialog?.message && <DialogContentText sx={{ mb: 1 }}>{dialog.message}</DialogContentText>}
        {items.length > 0 && (
          <Box
            component="ul"
            sx={{
              maxHeight: 240,
              overflow: 'auto',
              bgcolor: 'action.hover',
              borderRadius: 1,
              m: 0,
              py: 1,
              pl: 3.5,
              pr: 1.5
            }}
          >
            {items.slice(0, MAX_ITEMS).map((item, i) => (
              <Typography
                key={`${i}:${item}`}
                component="li"
                variant="body2"
                sx={{ fontFamily: 'monospace' }}
              >
                {item}
              </Typography>
            ))}
            {items.length > MAX_ITEMS && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                …and {items.length - MAX_ITEMS} more
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {dialog?.choices?.length ? <Button onClick={() => answer(null)}>Cancel</Button> : null}
        {choices.map((c) => (
          <Button
            key={c.value}
            onClick={() => answer(c.value)}
            variant={c.variant ?? 'text'}
            color={c.color ?? 'primary'}
          >
            {c.label}
          </Button>
        ))}
      </DialogActions>
    </Dialog>
  )
}

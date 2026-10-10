import { Alert } from '@mui/material'
import { describeInlineLoot } from '@shared/lootModel.js'

// The part of a creature's or spawn group's <Loot> that the editor does not
// show: inline <Table>s, a <Gold> and the Xp attribute (HTOO-522). Loot is
// managed through named loot sets, so these are not edited here, but a save
// writes them back unchanged. The notice tells the author they exist, because
// otherwise nothing on the page says so.
export default function InlineLootNotice({ inline }) {
  const what = describeInlineLoot(inline)
  if (!what) return null
  return (
    <Alert severity="info" sx={{ mb: 1.5 }}>
      The file also gives this loot {what}. The editor does not show these. A save keeps them
      unchanged. To change them, edit the XML file.
    </Alert>
  )
}

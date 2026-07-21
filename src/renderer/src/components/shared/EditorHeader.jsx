import { Box, Button, IconButton, TextField, Tooltip, Typography } from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import ArchiveIcon from '@mui/icons-material/Archive'
import UnarchiveIcon from '@mui/icons-material/Unarchive'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import FolderSelect from './FolderSelect'

/**
 * Shared editor header used by all entity editors.
 *
 * Props:
 *   title            — display name (e.g. data.name || '(unnamed status)')
 *   entityLabel      — lowercase entity type ('status', 'castable', 'item', …) for tooltip text
 *   fileName         — current filename state
 *   initialFileName  — filename when the entity was loaded (null for new entities)
 *   computedFileName — auto-derived filename based on current data (computed by parent)
 *   isExisting       — whether this entity has an associated file
 *   isArchived       — whether the file is in the archive folder
 *   onFileNameChange — (value: string) => void
 *   folder           — save destination within the type directory ('' is the type root)
 *   folderOptions    — folders already in use in this section
 *   initialFolder    — the folder the file is in now ('' for a new file)
 *   onFolderChange   — (value: string) => void; omit to hide the picker entirely
 *   onRegenerate     — () => void  — reset fileName to computedFileName
 *   onSave           — () => void
 *   onArchive        — () => void
 *   onUnarchive      — () => void
 */
function EditorHeader({
  title,
  entityLabel,
  fileName,
  initialFileName,
  computedFileName,
  isExisting,
  isArchived,
  onFileNameChange,
  folder,
  folderOptions,
  initialFolder,
  onFolderChange,
  onRegenerate,
  onSave,
  onArchive,
  onUnarchive
}) {
  const recyclePending = !!initialFileName && fileName !== computedFileName
  const willRename = !!initialFileName && fileName !== initialFileName
  // A move is a rename by another name: it also writes a new file and archives
  // the old one, so it warns the same way and says the same thing.
  const willMove = !!initialFileName && initialFolder !== undefined && folder !== initialFolder
  const fileNameWarn = recyclePending || willRename || willMove
  const recycleDisabled = fileName === computedFileName

  const destination = folder ? `${folder}/${fileName}` : fileName
  const origin = `${initialFolder ? `${initialFolder}/` : ''}${initialFileName}`
  const helperText =
    willRename || willMove
      ? `Saving will create "${destination}" and archive "${origin}"`
      : recyclePending
        ? `Computed name: "${computedFileName}" — click ↺ to apply (saves as new file)`
        : undefined

  const recycleTooltip = recycleDisabled
    ? 'Filename is auto-computed'
    : willRename
      ? 'Reset to computed filename'
      : 'Apply computed filename'

  const label = entityLabel ?? 'entity'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 1, flexShrink: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {isExisting && !isArchived && (
            <Tooltip title={`Archive ${label}`}>
              <IconButton size="small" onClick={onArchive}>
                <ArchiveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {isExisting && isArchived && (
            <Tooltip title={`Unarchive ${label}`}>
              <IconButton size="small" onClick={onUnarchive}>
                <UnarchiveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={onSave}>
            Save
          </Button>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <TextField
          size="small"
          label="Filename"
          value={fileName}
          onChange={(e) => onFileNameChange(e.target.value)}
          sx={{
            flex: 1,
            ...(fileNameWarn && {
              '& .MuiOutlinedInput-root fieldset': { borderColor: 'warning.main' },
              '& .MuiInputLabel-root:not(.Mui-focused)': { color: 'warning.main' },
              '& .MuiFormHelperText-root': { color: 'warning.main' }
            })
          }}
          helperText={helperText}
          slotProps={{
            htmlInput: { spellCheck: false },
            formHelperText: { sx: { mx: 0 } }
          }}
        />
        <Tooltip title={recycleTooltip}>
          <span>
            <IconButton size="small" onClick={onRegenerate} disabled={recycleDisabled}>
              <AutorenewIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        {onFolderChange && (
          <FolderSelect
            value={folder ?? ''}
            options={folderOptions ?? []}
            onChange={onFolderChange}
            warn={willMove}
          />
        )}
      </Box>
    </Box>
  )
}

export default EditorHeader

import { Box, Button, IconButton, TextField, Tooltip, Typography } from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import ArchiveIcon from '@mui/icons-material/Archive'
import UnarchiveIcon from '@mui/icons-material/Unarchive'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
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
 *   onSave           — () => void  — supersede: write the new file, archive the old
 *   onRenameFile     — () => void  — rename the file in place, keeping only one
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
  onRenameFile,
  onArchive,
  onUnarchive
}) {
  const recyclePending = !!initialFileName && fileName !== computedFileName
  const willRename = !!initialFileName && fileName !== initialFileName
  // A move to another folder is the same operation as a rename — the path
  // changes — so it warns the same way and both buttons handle it.
  const willMove = !!initialFileName && initialFolder !== undefined && folder !== initialFolder
  const fileNameWarn = recyclePending || willRename || willMove
  const recycleDisabled = fileName === computedFileName

  const destination = folder ? `${folder}/${fileName}` : fileName
  const origin = `${initialFolder ? `${initialFolder}/` : ''}${initialFileName}`
  // Two different intents, and until they had two buttons the first one was the
  // only one on offer. Save supersedes: it writes a new file and keeps the old
  // one as an archived record. Rename changes the file's name and nothing else
  // is left behind. Neither touches `<Name>`, which is the server's key — a
  // filename is Creidhne's business alone.
  const helperText =
    willRename || willMove
      ? `Save creates "${destination}" and archives "${origin}" · Rename changes the name in place`
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
          <Button
            variant="contained"
            size="small"
            startIcon={<SaveIcon />}
            onClick={() => onSave()}
          >
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
        {/* Beside the field it acts on, and only once there is a change to
            apply — an always-present Rename with nothing to rename to is a
            control that does nothing on most clicks. */}
        {isExisting && (willRename || willMove) && (
          <Tooltip
            title={
              willMove && !willRename
                ? `Move "${initialFileName}" to ${folder ? `"${folder}"` : 'the type root'}`
                : `Rename "${origin}" to "${destination}"`
            }
          >
            <Button
              size="small"
              variant="outlined"
              startIcon={<DriveFileRenameOutlineIcon />}
              onClick={() => onRenameFile()}
              sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              Rename
            </Button>
          </Tooltip>
        )}
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

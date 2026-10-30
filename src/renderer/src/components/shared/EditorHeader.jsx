import { useId } from 'react'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import FolderSelect from './FolderSelect'
import { useStaging } from './StagingScope'
import { EditorAlertsArea } from './EditorAlerts'

/**
 * Shared editor header used by all entity editors (HTOO-628 layout):
 *
 *   title                         [Staging ☐] [Rename] [Save]
 *   [Filename ............. ↺]  [Folder .................]
 *   Alerts (n) ▾
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
 *
 * Editors still pass `onArchive` and `onUnarchive`. The header ignores them:
 * Archive, Unarchive, Stage and Release are the page toolbar's item actions.
 *
 * The Staging box comes from the page's `StagingScope`, not from a prop, so
 * every editor has it without passing it through. It chooses the root of the
 * save — `xml/<type>/` or `.staging/<type>/` — and the folder stays the path
 * inside the type. It is disabled for an archived file.
 *
 * Rename is always shown, and enabled only when the filename or the folder
 * differs from where the file is. Before HTOO-628 it appeared only after a
 * change, which made it hard to find.
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
  onRenameFile
}) {
  const staging = useStaging()
  const helperId = useId()
  const staged = staging.staged
  const recyclePending = !!initialFileName && fileName !== computedFileName
  const willRename = !!initialFileName && fileName !== initialFileName
  // A move to another folder is the same operation as a rename — the path
  // changes — so it warns the same way and both buttons handle it.
  const willMove = !!initialFileName && initialFolder !== undefined && folder !== initialFolder
  const fileNameWarn = recyclePending || willRename || willMove
  const recycleDisabled = fileName === computedFileName
  const canRename = !!isExisting && (willRename || willMove)

  const destination = folder ? `${folder}/${fileName}` : fileName
  const origin = `${initialFolder ? `${initialFolder}/` : ''}${initialFileName}`
  // Two different intents, each with its own button. Save supersedes: it writes
  // a new file and keeps the old one as an archived record. Rename changes the
  // file's name and nothing else is left behind. Neither touches `<Name>`, which
  // is the server's key — a filename is Creidhne's business alone. Staging keeps
  // no archive, so there both of them rename.
  const helperText =
    (willRename || willMove) && staged
      ? `Save renames "${origin}" to "${destination}" · staging keeps no archive`
      : willRename || willMove
        ? `Save creates "${destination}" and archives "${origin}" · Rename changes the name in place`
        : recyclePending
          ? `Computed name: "${computedFileName}" — click ↺ to apply (saves as new file)`
          : undefined

  const recycleTooltip = recycleDisabled
    ? 'Filename is auto-computed'
    : willRename
      ? 'Reset to computed filename'
      : 'Apply computed filename'

  const renameTooltip = !canRename
    ? 'Change the filename or the folder to rename the file'
    : willMove && !willRename
      ? `Move "${initialFileName}" to ${folder ? `"${folder}"` : 'the type root'}`
      : `Rename "${origin}" to "${destination}"`

  const label = entityLabel ?? 'entity'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 1, flexShrink: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {staging.onSaveStagedChange && (
            <Tooltip
              // A description, not the name: the box's name stays "Staging".
              describeChild
              title={
                isArchived
                  ? 'An archived file stays in the archive. Unarchive it first.'
                  : staged
                    ? `Save writes this ${label} into .staging, which the server does not load`
                    : `Save writes this ${label} into the live world`
              }
            >
              <FormControlLabel
                sx={{ mr: 0 }}
                control={
                  <Checkbox
                    size="small"
                    checked={staged}
                    disabled={!!isArchived}
                    onChange={(e) => staging.onSaveStagedChange(e.target.checked)}
                  />
                }
                label="Staging"
              />
            </Tooltip>
          )}
          <Tooltip title={renameTooltip}>
            <span>
              <Button
                size="small"
                variant="outlined"
                startIcon={<DriveFileRenameOutlineIcon />}
                disabled={!canRename}
                onClick={() => onRenameFile()}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Rename
              </Button>
            </span>
          </Tooltip>
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
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <TextField
          size="small"
          label="Filename"
          value={fileName}
          onChange={(e) => onFileNameChange(e.target.value)}
          sx={{
            flex: 1,
            ...(fileNameWarn && {
              '& .MuiOutlinedInput-root fieldset': { borderColor: 'warning.main' },
              '& .MuiInputLabel-root:not(.Mui-focused)': { color: 'warning.main' }
            })
          }}
          slotProps={{
            // The helper line is below the row, not under the field, so it can
            // use the header's full width; it still describes the field.
            htmlInput: { spellCheck: false, 'aria-describedby': helperText ? helperId : undefined },
            input: {
              // ↺ sits in the field it acts on.
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={recycleTooltip}>
                    <span>
                      <IconButton
                        size="small"
                        edge="end"
                        onClick={onRegenerate}
                        disabled={recycleDisabled}
                        aria-label={recycleTooltip}
                      >
                        <AutorenewIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </InputAdornment>
              )
            }
          }}
        />
        {onFolderChange && (
          <FolderSelect
            value={folder ?? ''}
            options={folderOptions ?? []}
            onChange={onFolderChange}
            warn={willMove}
          />
        )}
      </Box>
      {helperText && (
        <Typography id={helperId} variant="caption" sx={{ color: 'warning.main' }}>
          {helperText}
        </Typography>
      )}
      <EditorAlertsArea />
    </Box>
  )
}

export default EditorHeader

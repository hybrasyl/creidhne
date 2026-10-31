import { Checkbox, FormControlLabel, Tooltip } from '@mui/material'
import HouseEditorHeader from '../editorShell/EditorHeader'
import FolderSelect from './FolderSelect'
import { useStaging } from './StagingScope'

/**
 * Creidhne's editor header: the house header (`editorShell/EditorHeader.jsx`,
 * HTOO-637) with Creidhne's three parts.
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
 * The save sentence is Creidhne's. Save supersedes: it writes a new file and
 * keeps the old one as an archived record. Rename changes the file's name and
 * leaves nothing behind. Neither touches `<Name>`, which is the server's key.
 * Staging keeps no archive, so there both of them rename.
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
  const staged = staging.staged
  const label = entityLabel ?? 'entity'

  const describeSave = ({ willRename, willMove, recyclePending, origin, destination }) =>
    (willRename || willMove) && staged
      ? `Save renames "${origin}" to "${destination}" · staging keeps no archive`
      : willRename || willMove
        ? `Save creates "${destination}" and archives "${origin}" · Rename changes the name in place`
        : recyclePending
          ? `Computed name: "${computedFileName}". Click ↺ to apply it, which saves a new file`
          : undefined

  const stagingBox = staging.onSaveStagedChange && (
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
  )

  return (
    <HouseEditorHeader
      title={title}
      fileName={fileName}
      initialFileName={initialFileName}
      computedFileName={computedFileName}
      isExisting={isExisting}
      onFileNameChange={onFileNameChange}
      folder={folder}
      initialFolder={initialFolder}
      renderFolderPicker={
        onFolderChange
          ? (willMove) => (
              <FolderSelect
                value={folder ?? ''}
                options={folderOptions ?? []}
                onChange={onFolderChange}
                warn={willMove}
              />
            )
          : undefined
      }
      onRegenerate={onRegenerate}
      onSave={onSave}
      onRenameFile={onRenameFile}
      controls={stagingBox || null}
      describeSave={describeSave}
    />
  )
}

export default EditorHeader

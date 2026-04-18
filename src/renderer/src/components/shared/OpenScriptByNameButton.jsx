import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useRecoilValue } from 'recoil';
import { libraryIndexState, activeLibraryState } from '../../recoil/atoms';

/**
 * Open-script button for entities that reference their script by name rather
 * than by an explicit <Script> element (NPCs, creatures, subtypes). Searches
 * `libraryIndex.scripts` for an entry whose basename matches `name` (case
 * sensitive — matches how the server resolves scripts on disk).
 *
 * Disabled when the name is empty, no library is active, or no matching
 * script exists. If multiple scripts share the name, opens the first match
 * and surfaces a tooltip listing the candidates.
 */
export default function OpenScriptByNameButton({ name, tooltipPrefix = 'Open script' }) {
  const libraryIndex = useRecoilValue(libraryIndexState);
  const activeLibrary = useRecoilValue(activeLibraryState);

  const trimmed = (name || '').trim();
  const scripts = libraryIndex?.scripts || [];
  const matches = trimmed
    ? scripts.filter((p) => p.split(/[\\/]/).pop() === trimmed)
    : [];

  const canOpen = !!(activeLibrary && matches.length > 0);
  const target = matches[0] || null;

  const title = !trimmed
    ? 'Enter a name first'
    : !activeLibrary
      ? 'Select an active library'
      : matches.length === 0
        ? `No script found matching "${trimmed}"`
        : matches.length === 1
          ? `${tooltipPrefix}: ${target}.lua`
          : `${tooltipPrefix}: ${target}.lua (1 of ${matches.length} matches: ${matches.join(', ')})`;

  const handleOpen = async () => {
    if (!canOpen) return;
    await window.electronAPI.openScript(activeLibrary, target);
  };

  return (
    <Tooltip title={title}>
      <span>
        <IconButton size="small" onClick={handleOpen} disabled={!canOpen}>
          <OpenInNewIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Typography, Divider, TextField, Tooltip, IconButton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SaveIcon from '@mui/icons-material/Save';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

function computeFileName(name) {
  const safe = (name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
  return safe ? `${safe}.xml` : '';
}

function ElementTableEditor({
  table, initialFileName, isArchived, isExisting,
  onSave, onArchive, onUnarchive, onDirtyChange, saveRef,
}) {
  const theme = useTheme();
  const headerBg = theme.palette.background.paper;
  const borderColor = theme.palette.divider;

  const [name, setName] = useState(table.name);
  const [comment, setComment] = useState(table.comment);
  const [elements, setElements] = useState(table.elements);
  const [matrix, setMatrix] = useState(table.matrix);
  const [fileName, setFileName] = useState(initialFileName || computeFileName(table.name));
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName);
  const [focusedCell, setFocusedCell] = useState(null); // { row, col }

  const isDirtyRef = useRef(false);

  useEffect(() => {
    setName(table.name);
    setComment(table.comment);
    setElements(table.elements);
    setMatrix(table.matrix);
    setFileName(initialFileName || computeFileName(table.name));
    setFileNameEdited(!!initialFileName);
    setFocusedCell(null);
    isDirtyRef.current = false;
    onDirtyChange?.(false);
  }, [table, initialFileName]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirty = useCallback(() => {
    if (!isDirtyRef.current) { isDirtyRef.current = true; onDirtyChange?.(true); }
  }, [onDirtyChange]);

  const handleNameChange = (val) => {
    setName(val);
    if (!fileNameEdited) setFileName(computeFileName(val));
    markDirty();
  };

  const handleRegenerate = () => {
    setFileName(computeFileName(name));
    setFileNameEdited(false);
    markDirty();
  };

  // ── Grid mutations ──────────────────────────────────────────────────────────

  const handleCellChange = (row, col, raw) => {
    const parsed = parseInt(raw, 10);
    const val = isNaN(parsed) ? '' : Math.max(0, Math.min(9999, parsed));
    setMatrix((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = val;
      return next;
    });
    markDirty();
  };

  const handleRenameElement = (index, val) => {
    setElements((prev) => { const next = [...prev]; next[index] = val; return next; });
    markDirty();
  };

  const handleAddElement = () => {
    const existing = elements;
    let counter = existing.length + 1;
    let newName = `NewElement(${counter})`;
    while (existing.includes(newName)) { counter++; newName = `NewElement(${counter})`; }

    setElements((prev) => [...prev, newName]);
    setMatrix((prev) => {
      const next = prev.map((r) => [...r, 100]);
      next.push(new Array(existing.length + 1).fill(100));
      return next;
    });
    markDirty();
  };

  const handleDeleteElement = (index) => {
    setElements((prev) => prev.filter((_, i) => i !== index));
    setMatrix((prev) =>
      prev.filter((_, i) => i !== index).map((r) => r.filter((_, j) => j !== index))
    );
    if (focusedCell && (focusedCell.row === index || focusedCell.col === index)) {
      setFocusedCell(null);
    }
    markDirty();
  };

  // ── Save ────────────────────────────────────────────────────────────────────

  const getFileName = () => {
    if (isExisting) return initialFileName;
    return fileName || `${computeFileName(name) || 'element_table'}.xml`;
  };

  const handleSave = useCallback(() => {
    onSave({ name, comment, elements, matrix }, getFileName());
    isDirtyRef.current = false;
    onDirtyChange?.(false);
  }, [name, comment, elements, matrix, isExisting, initialFileName, fileName]); // eslint-disable-line react-hooks/exhaustive-deps

  if (saveRef) saveRef.current = handleSave;

  // ── Mirror highlight helpers ────────────────────────────────────────────────

  const isMirrorCell = (row, col) => {
    if (!focusedCell) return false;
    const { row: fr, col: fc } = focusedCell;
    // Mirror of [fr, fc] is [fc, fr] — highlight only if it's a different cell
    return row === fc && col === fr && !(row === fr && col === fc);
  };

  // ── Shared cell/header styles ───────────────────────────────────────────────

  const cellBorder = `1px solid ${borderColor}`;
  const thickBorder = `2px solid ${theme.palette.divider}`;

  const stickyCorner = {
    position: 'sticky', top: 0, left: 0, zIndex: 4,
    background: headerBg,
    borderBottom: thickBorder, borderRight: thickBorder,
    minWidth: 160, width: 160,
  };

  const stickyColHeader = (ci) => ({
    position: 'sticky', top: 0, zIndex: 3,
    background: headerBg,
    borderBottom: thickBorder, borderRight: cellBorder,
    minWidth: 76, width: 76,
    padding: '4px 6px',
    textAlign: 'center',
    fontSize: 12, fontWeight: 600,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    userSelect: 'none',
  });

  const stickyRowHeader = {
    position: 'sticky', left: 0, zIndex: 2,
    background: headerBg,
    borderRight: thickBorder, borderBottom: cellBorder,
    padding: '2px 4px',
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header bar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, flexShrink: 0 }}>
        <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>
          {name || '(unnamed table)'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {isExisting && !isArchived && (
            <Tooltip title="Archive Table">
              <IconButton size="small" onClick={onArchive}><ArchiveIcon fontSize="small" /></IconButton>
            </Tooltip>
          )}
          {isExisting && isArchived && (
            <Tooltip title="Unarchive Table">
              <IconButton size="small" onClick={onUnarchive}><UnarchiveIcon fontSize="small" /></IconButton>
            </Tooltip>
          )}
          <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={handleSave}>
            Save
          </Button>
        </Box>
      </Box>

      {/* ── Filename row ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pb: 1, flexShrink: 0 }}>
        <TextField
          size="small" label="Filename" value={fileName}
          onChange={(e) => { setFileName(e.target.value); setFileNameEdited(true); markDirty(); }}
          sx={{ width: 240 }} inputProps={{ spellCheck: false }}
          disabled={isExisting}
        />
        {!isExisting && (
          <Tooltip title="Regenerate from name">
            <IconButton size="small" onClick={handleRegenerate}><AutorenewIcon fontSize="small" /></IconButton>
          </Tooltip>
        )}
      </Box>

      <Divider sx={{ mb: 1.5, flexShrink: 0 }} />

      {/* ── Name + Comment ── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 1.5, flexShrink: 0 }}>
        <TextField
          label="Name" size="small" value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          sx={{ width: 200 }} inputProps={{ maxLength: 128 }}
        />
        <TextField
          label="Comment" size="small" value={comment}
          onChange={(e) => { setComment(e.target.value); markDirty(); }}
          sx={{ flex: 1 }} inputProps={{ maxLength: 512 }}
        />
      </Box>

      {/* ── Help tip ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5, flexShrink: 0 }}>
        <InfoOutlinedIcon fontSize="small" color="action" />
        <Typography variant="caption" color="text.secondary">
          Enter values as whole-number percentages — 80 = 80% (×0.8), 100 = no change (×1.0), 150 = 150% (×1.5).
          Row = source element (attacker); column = target element (defender).
          The highlighted cell shows the reverse interaction.
        </Typography>
      </Box>

      <Divider sx={{ mb: 1, flexShrink: 0 }} />

      {/* ── Add element ── */}
      <Box sx={{ mb: 1, flexShrink: 0 }}>
        <Button size="small" startIcon={<AddIcon />} onClick={handleAddElement} variant="outlined">
          Add Element
        </Button>
      </Box>

      {/* ── Grid ── */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={stickyCorner} />
              {elements.map((el, ci) => (
                <th key={ci} style={stickyColHeader(ci)}>
                  {el || `(${ci + 1})`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {elements.map((el, ri) => (
              <tr key={ri}>
                {/* Row name + delete */}
                <td style={stickyRowHeader}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <input
                      type="text"
                      value={el}
                      onChange={(e) => handleRenameElement(ri, e.target.value)}
                      style={{
                        width: 110, fontSize: 12,
                        border: `1px solid ${borderColor}`,
                        borderRadius: 3, padding: '2px 5px',
                        background: 'transparent',
                        color: 'inherit',
                      }}
                    />
                    <IconButton size="small" color="error" onClick={() => handleDeleteElement(ri)}>
                      <DeleteIcon style={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                </td>
                {/* Value cells */}
                {elements.map((_, ci) => {
                  const mirror = isMirrorCell(ri, ci);
                  const isSelf = ri === ci;
                  return (
                    <td
                      key={ci}
                      style={{
                        borderBottom: cellBorder,
                        borderRight: cellBorder,
                        padding: 2,
                        background: mirror
                          ? (theme.palette.mode === 'dark' ? '#3d1a1a' : '#fff5f5')
                          : isSelf
                            ? (theme.palette.mode === 'dark' ? '#1a2a1a' : '#f5fff5')
                            : undefined,
                        outline: mirror ? '2px solid #f44336' : undefined,
                        outlineOffset: -2,
                      }}
                    >
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        value={matrix[ri]?.[ci] ?? ''}
                        onChange={(e) => handleCellChange(ri, ci, e.target.value)}
                        onFocus={() => setFocusedCell({ row: ri, col: ci })}
                        onBlur={() => setFocusedCell(null)}
                        style={{
                          width: 64, fontSize: 12,
                          border: `1px solid ${borderColor}`,
                          borderRadius: 3, padding: '2px 4px',
                          textAlign: 'right',
                          background: 'transparent',
                          color: 'inherit',
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>


    </Box>
  );
}

export default ElementTableEditor;

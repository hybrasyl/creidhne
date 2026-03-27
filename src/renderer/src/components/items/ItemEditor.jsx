import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, Typography, Divider, TextField, Tooltip, IconButton } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import BasicTab from './tabs/BasicTab';
import AppearanceTab from './tabs/AppearanceTab';
import PhysicalTab from './tabs/PhysicalTab';
import StatsTab from './tabs/StatsTab';
import RestrictionsTab from './tabs/RestrictionsTab';
import UseTab from './tabs/UseTab';
import VendorTab from './tabs/VendorTab';
import AdvancedTab from './tabs/AdvancedTab';
import { computeItemFilename } from '../../data/itemConstants';

function SectionHeader({ children }) {
  return (
    <Box sx={{ mt: 3, mb: 1 }}>
      <Typography variant="overline" color="text.secondary">{children}</Typography>
      <Divider />
    </Box>
  );
}

function deriveFilename(data) {
  return computeItemFilename(
    data.name,
    data.properties.equipment?.slot,
    data.properties.vendor?.shopTab,
  );
}

function ItemEditor({ item, initialFileName, isArchived, isExisting, onSave, onArchive, onUnarchive }) {
  const [data, setData] = useState(item);
  const [fileName, setFileName] = useState(initialFileName || deriveFilename(item));
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName);

  useEffect(() => {
    setData(item);
    setFileName(initialFileName || deriveFilename(item));
    setFileNameEdited(!!initialFileName);
  }, [item, initialFileName]);

  // Auto-update filename when relevant fields change, unless manually edited
  const updateData = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!fileNameEdited) setFileName(deriveFilename(next));
      return next;
    });
  }, [fileNameEdited]);

  const updateProperties = (slice) =>
    updateData((d) => ({ ...d, properties: { ...d.properties, ...slice } }));

  const handleRegenerate = () => {
    const generated = deriveFilename(data);
    setFileName(generated);
    setFileNameEdited(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>
            {data.name || '(unnamed item)'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {isExisting && !isArchived && (
              <Tooltip title="Archive item">
                <IconButton size="small" onClick={onArchive}>
                  <ArchiveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {isExisting && isArchived && (
              <Tooltip title="Unarchive item">
                <IconButton size="small" onClick={onUnarchive}>
                  <UnarchiveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Button
              variant="contained"
              size="small"
              startIcon={<SaveIcon />}
              onClick={() => onSave(data, fileName)}
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
            onChange={(e) => { setFileName(e.target.value); setFileNameEdited(true); }}
            sx={{ flex: 1 }}
            inputProps={{ spellCheck: false }}
          />
          <Tooltip title="Regenerate from name / slot / vendor">
            <IconButton size="small" onClick={handleRegenerate}>
              <AutorenewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Divider sx={{ mb: 1, flexShrink: 0 }} />

      {/* Scrollable form body */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <SectionHeader>Basic</SectionHeader>
        <BasicTab
          data={{
            name: data.name,
            unidentifiedName: data.unidentifiedName,
            comment: data.comment,
            includeInMetafile: data.includeInMetafile,
            tags: data.properties.tags,
          }}
          onChange={(updated) => {
            const { tags, ...top } = updated;
            updateData((d) => ({ ...d, ...top, properties: { ...d.properties, tags } }));
          }}
        />

        <SectionHeader>Appearance</SectionHeader>
        <AppearanceTab
          data={data.properties.appearance}
          onChange={(updated) => updateProperties({ appearance: updated })}
        />

        <SectionHeader>Physical &amp; Equipment</SectionHeader>
        <PhysicalTab
          data={{
            physical: data.properties.physical,
            stackable: data.properties.stackable,
            equipment: data.properties.equipment,
            damage: data.properties.damage,
          }}
          onChange={(updated) => updateProperties(updated)}
        />

        <SectionHeader>Stat Modifiers</SectionHeader>
        <StatsTab
          data={data.properties.statModifiers}
          onChange={(updated) => updateProperties({ statModifiers: updated })}
        />

        <SectionHeader>Restrictions</SectionHeader>
        <RestrictionsTab
          data={{ restrictions: data.properties.restrictions }}
          onChange={(updated) => updateProperties(updated)}
        />

        <SectionHeader>Use</SectionHeader>
        <UseTab
          data={{ use: data.properties.use }}
          onChange={(updated) => updateProperties(updated)}
        />

        <SectionHeader>Vendor</SectionHeader>
        <VendorTab
          data={{ vendor: data.properties.vendor }}
          onChange={(updated) => updateProperties(updated)}
        />

        <SectionHeader>Advanced</SectionHeader>
        <AdvancedTab
          data={{
            flags: data.properties.flags,
            categories: data.properties.categories,
            variants: data.properties.variants,
            motions: data.properties.motions,
            castModifiers: data.properties.castModifiers,
            procs: data.properties.procs,
          }}
          onChange={(updated) => updateProperties(updated)}
        />

        <Box sx={{ height: 32 }} />
      </Box>
    </Box>
  );
}

export default ItemEditor;

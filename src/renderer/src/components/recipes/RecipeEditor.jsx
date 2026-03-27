import React, { useState, useEffect } from 'react';
import {
  Box, Button, Typography, Divider, TextField, Tooltip, IconButton,
  Paper, Autocomplete,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useRecoilValue } from 'recoil';
import { libraryIndexState } from '../../recoil/atoms';

function computeRecipeFilename(name) {
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '');
  if (!safe) return '';
  return `recipe_${safe}.xml`;
}

function RecipeEditor({ recipe, initialFileName, isArchived, isExisting, onSave, onArchive, onUnarchive }) {
  const libraryIndex = useRecoilValue(libraryIndexState);
  const itemNames = libraryIndex.items || [];

  const [data, setData] = useState(recipe);
  const [fileName, setFileName] = useState(initialFileName || computeRecipeFilename(recipe.name));
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName);

  useEffect(() => {
    setData(recipe);
    setFileName(initialFileName || computeRecipeFilename(recipe.name));
    setFileNameEdited(!!initialFileName);
  }, [recipe, initialFileName]);

  const updateData = (updater) => {
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!fileNameEdited) setFileName(computeRecipeFilename(next.name));
      return next;
    });
  };

  const set = (field) => (e) => updateData((d) => ({ ...d, [field]: e.target.value }));

  const handleRegenerate = () => {
    setFileName(computeRecipeFilename(data.name));
    setFileNameEdited(false);
  };

  const addIngredient = () =>
    updateData((d) => ({ ...d, ingredients: [...d.ingredients, { name: '', quantity: '1' }] }));

  const setIngredient = (index, field, val) =>
    updateData((d) => ({
      ...d,
      ingredients: d.ingredients.map((ing, i) => i === index ? { ...ing, [field]: val } : ing),
    }));

  const removeIngredient = (index) =>
    updateData((d) => ({ ...d, ingredients: d.ingredients.filter((_, i) => i !== index) }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>
            {data.name || '(unnamed recipe)'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {isExisting && !isArchived && (
              <Tooltip title="Archive recipe">
                <IconButton size="small" onClick={onArchive}>
                  <ArchiveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {isExisting && isArchived && (
              <Tooltip title="Unarchive recipe">
                <IconButton size="small" onClick={onUnarchive}>
                  <UnarchiveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={() => onSave(data, fileName)}>
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
          <Tooltip title="Regenerate from name">
            <IconButton size="small" onClick={handleRegenerate}>
              <AutorenewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Divider sx={{ mb: 1, flexShrink: 0 }} />

      {/* Form */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Name"
              value={data.name}
              onChange={set('name')}
              size="small"
              required
              inputProps={{ maxLength: 255 }}
            />
            <TextField
              label="Description"
              value={data.description}
              onChange={set('description')}
              size="small"
              multiline
              minRows={2}
              inputProps={{ maxLength: 500 }}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Autocomplete
                freeSolo
                options={itemNames}
                value={data.produces}
                onInputChange={(_, val) => updateData((d) => ({ ...d, produces: val }))}
                size="small"
                sx={{ flex: 1 }}
                renderInput={(params) => <TextField {...params} label="Produces (Item)" required />}
              />
              <TextField
                label="Duration"
                value={data.duration}
                onChange={set('duration')}
                size="small"
                sx={{ width: 140 }}
                inputProps={{ maxLength: 64 }}
              />
            </Box>
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Ingredients</Typography>
          {data.ingredients.map((ing, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <Autocomplete
                freeSolo
                options={itemNames}
                value={ing.name}
                onInputChange={(_, val) => setIngredient(index, 'name', val)}
                size="small"
                sx={{ flex: 1 }}
                renderInput={(params) => <TextField {...params} label="Item" />}
              />
              <TextField
                label="Qty"
                type="number"
                value={ing.quantity}
                onChange={(e) => setIngredient(index, 'quantity', e.target.value)}
                size="small"
                sx={{ width: 90 }}
                inputProps={{ min: 1 }}
              />
              <IconButton size="small" color="error" onClick={() => removeIngredient(index)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addIngredient}>
            Add Ingredient
          </Button>
        </Paper>

        <Box sx={{ height: 32 }} />
      </Box>
    </Box>
  );
}

export default RecipeEditor;

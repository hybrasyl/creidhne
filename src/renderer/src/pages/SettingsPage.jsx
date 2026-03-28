import React from 'react';
import { Box, Typography, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { useRecoilState } from 'recoil';
import { themeState } from '../recoil/atoms';
import ManageLibraries from '../components/ManageLibraries';

const THEMES = [
  { value: 'hybrasyl', label: 'Hybrasyl' },
  { value: 'chadul',   label: 'Chadul' },
  { value: 'danaan',   label: 'Danaan' },
  { value: 'grinneal', label: 'Grinneal' },
];

const SettingsPage = ({ libraries, onAddLibrary, onRemoveLibrary }) => {
  const [theme, setTheme] = useRecoilState(themeState);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: 'text.button', fontWeight: 'bold' }}>
        Settings
      </Typography>
      <FormControl size="small" sx={{ minWidth: 280, mb: 3 }}>
        <InputLabel>Theme</InputLabel>
        <Select
          value={theme}
          label="Theme"
          onChange={(e) => setTheme(e.target.value)}
        >
          {THEMES.map((t) => (
            <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <ManageLibraries
        libraries={libraries}
        onAddLibrary={onAddLibrary}
        onRemoveLibrary={onRemoveLibrary}
      />
    </Box>
  );
};

export default SettingsPage;

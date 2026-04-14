import React, { useState } from 'react';
import { Box, Typography, Select, MenuItem, FormControl, InputLabel, Button } from '@mui/material';
import { useRecoilState } from 'recoil';
import { themeState } from '../recoil/atoms';
import ManageLibraries from '../components/ManageLibraries';
import DAClientPathSection from '../components/DAClientPathSection';
import AboutDialog from '../components/AboutDialog';

const THEMES = [
  { value: 'hybrasyl', label: 'Hybrasyl' },
  { value: 'chadul',   label: 'Chadul' },
  { value: 'danaan',   label: 'Danaan' },
  { value: 'grinneal', label: 'Grinneal' },
];

const SettingsPage = ({ libraries, onAddLibrary, onRemoveLibrary }) => {
  const [theme, setTheme] = useRecoilState(themeState);
  const [aboutOpen, setAboutOpen] = useState(false);

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
      <DAClientPathSection />
      <Box sx={{ mt: 4 }}>
        <Button variant="outlined" size="small" onClick={() => setAboutOpen(true)}>
          About Creidhne
        </Button>
      </Box>
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </Box>
  );
};

export default SettingsPage;

import Button from '@mui/material/Button';
import LandscapeIcon from '@mui/icons-material/Landscape';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import { AppBar, Box, Container, CssBaseline, IconButton, Toolbar, Typography } from '@mui/material';
import ImageFilter from 'react-image-filter';
import { useState } from 'react';

function App() {
  const [imageFilter, setImageFilter] = useState(undefined);
  const [imageUrl, setImageUrl] = useState('https://placehold.co/600x400');

  async function onOpenFileClick() {
    const filePath = await window.electronAPI.openFile();
    setImageUrl(filePath);
  };

  return (
    <>
      <CssBaseline />
      <Box sx={{
        flexGrow: 1,
        whiteSpace: 'nowrap',
        button: {
          color: 'inherit',
        }
      }}>
        <AppBar position="static">
          <Container>
            <Toolbar>
              <LandscapeIcon sx={{ mr: 1 }} />
              <Typography sx={{
                mr: '0.5em',
                fontSize: '1.4em',
                flexGrow: 1
              }}>Image Filter</Typography>
              <Button onClick={() => setImageFilter(undefined)}>Original</Button>
              <Button onClick={() => setImageFilter('invert')}>Invert</Button>
              <Button onClick={() => setImageFilter('sepia')}>Sepia</Button>
              <Button onClick={() => setImageFilter('duotone')}>Neon</Button>
              <IconButton type='button' color='inherit' onClick={onOpenFileClick}>
                <FileOpenIcon />
              </IconButton>
            </Toolbar>
          </Container>
        </AppBar>
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <ImageFilter
          image={imageUrl}
          alt="image to be styled"
          filter={imageFilter}
          colorOne={[104, 255, 0]}
          colorTwo={[255, 0, 92]}
          style={{ margin: '2em' }}
        />
      </Box>
    </>
  );
}

export default App;

import { createTheme, responsiveFontSizes } from '@mui/material/styles';

const chadulTheme = responsiveFontSizes(createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main:        '#2e7a3a',
      light:       '#4ab858',
      dark:        '#1a4a22',
      contrastText:'#a8d8a0',
    },
    secondary: {
      main:        '#2e1a4a',
      light:       '#4a2870',
      dark:        '#1e1030',
      contrastText:'#a8d8a0',
    },
    background: {
      default: '#020804',
      paper:   'rgba(4,14,6,0.90)',
    },
    text: {
      primary:   '#a8d8a0',
      secondary: '#6a9870',
      disabled:  '#3a5840',
      button:    '#a8d8a0',
      dark:      '#020804',
    },
    divider: 'rgba(46,122,58,0.28)',
    error:   { main: '#6aff30' },
    warning: { main: '#2e7a3a' },
    info:    { main: '#4ab858' },
    success: { main: '#4ab858' },
  },

  typography: {
    fontFamily: '"Crimson Pro", Georgia, serif',
    h1: { fontFamily: '"Cinzel Decorative", serif', letterSpacing: '0.22em', fontWeight: 400 },
    h2: { fontFamily: '"Cinzel", serif', letterSpacing: '0.08em', fontWeight: 400 },
    h3: { fontFamily: '"Cinzel", serif', letterSpacing: '0.06em', fontWeight: 400 },
    h4: { fontFamily: '"Cinzel", serif', letterSpacing: '0.06em', fontWeight: 400 },
    h5: { fontFamily: '"Cinzel", serif', letterSpacing: '0.06em', fontWeight: 400 },
    h6: { fontFamily: '"Cinzel", serif', letterSpacing: '0.06em', fontWeight: 400 },
    button: { fontFamily: '"Cinzel", serif', letterSpacing: '0.12em', textTransform: 'uppercase' },
    caption: { fontFamily: '"Cinzel", serif', letterSpacing: '0.18em', fontSize: '0.7rem' },
  },

  shape: { borderRadius: 2 },

  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(4,14,6,0.90)',
          border:          '1px solid rgba(46,122,58,0.35)',
          backdropFilter:  'blur(2px)',
          boxShadow: '-2px -2px 0 0 #1a4a22, 2px 2px 0 0 #1a4a22',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          border: '1px solid #2e7a3a',
          color:  '#4ab858',
          '&:hover': { backgroundColor: 'rgba(46,122,58,0.15)', borderColor: '#4ab858', boxShadow: '0 0 8px rgba(74,184,88,0.25)' },
        },
        contained: {
          backgroundColor: 'rgba(46,122,58,0.25)',
          color: '#a8d8a0',
          '&:hover': { backgroundColor: 'rgba(46,122,58,0.4)' },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(2,8,4,0.97)',
          backgroundImage: 'none',
          borderBottom:    '1px solid rgba(46,122,58,0.25)',
          boxShadow:       'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(4,14,6,0.95)',
          borderRight:     '1px solid rgba(46,122,58,0.32)',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          fontFamily: '"Cinzel", serif', fontSize: '0.7rem', letterSpacing: '0.1em',
          color: '#3a5840', borderBottom: '1px solid rgba(46,122,58,0.08)',
          '&.Mui-selected': { backgroundColor: 'rgba(46,122,58,0.14)', borderLeft: '2px solid #2e7a3a', color: '#4ab858' },
          '&:hover': { backgroundColor: 'rgba(46,122,58,0.1)', paddingLeft: '20px' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(6,18,8,0.94)', border: '1px solid rgba(46,122,58,0.18)',
          backgroundImage: 'none', transition: 'border-color 0.2s, transform 0.2s',
          '&:hover': { borderColor: '#2e7a3a', transform: 'translateY(-2px)', boxShadow: '0 4px 20px rgba(46,122,58,0.15)' },
        },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: 'rgba(46,122,58,0.15)' } } },
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.1em',
          backgroundColor: 'rgba(46,122,58,0.14)', color: '#2e7a3a', border: '1px solid rgba(46,122,58,0.3)',
        },
      },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          fontFamily: '"Cinzel", serif', fontSize: '0.7rem',
          border: '1px solid rgba(46,122,58,0.2)', color: '#3a5840', borderRadius: 2,
          '&.Mui-selected': { backgroundColor: 'rgba(46,122,58,0.2)', borderColor: '#2e7a3a', color: '#4ab858' },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: '"Cinzel", serif', fontSize: '0.7rem', letterSpacing: '0.14em', color: '#3a5840',
          '&.Mui-selected': { color: '#4ab858' },
        },
      },
    },
    MuiTabs: { styleOverrides: { indicator: { backgroundColor: '#2e7a3a' } } },
  },
}));

export default chadulTheme;

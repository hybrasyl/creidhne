import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import "@fontsource/eagle-lake";
import "@fontsource/yaldevi";

const darkTheme = responsiveFontSizes(createTheme({
  palette: {
    type: 'dark',
    primary: {
      main: '#37474f',
    },
    secondary: {
      main: '#00838f',
    },
    background: {
      default: '#323740',
      paper: '#A4B7DC',
      paperGreen: '#8aa27b',
      paperLight: '#a5b3f0',
    },
    text: {
      primary: '#263238',
      secondary: '#6d4c41',
      disabled: '#78909c',
      hint: '#81c784',
      headline: '#d5e1f5',
      link: '#940b99',
      button: '#fff',
      dark: '#174c57',
    },
    error: {
      main: '#b71c1c',
    },
    warning: {
      main: '#ef6c00',
    },
    info: {
      main: '#9575cd',
    },
    success: {
      main: '#00695c',
    },
    divider: '#212121',
  },
  typography: {
    fontFamily: 'Yaldevi',
  },
  props: {
    MuiList: {
      dense: true,
    },
    MuiMenuItem: {
      dense: true,
    },
    MuiTable: {
      size: 'small',
    },
    MuiButton: {
      size: 'small',
    },
    MuiButtonGroup: {
      size: 'small',
    },
    MuiCheckbox: {
      size: 'small',
    },
    MuiFab: {
      size: 'small',
    },
    MuiFormControl: {
      margin: 'dense',
      size: 'small',
    },
    MuiFormHelperText: {
      margin: 'dense',
    },
    MuiIconButton: {
      size: 'small',
    },
    MuiInputBase: {
      margin: 'dense',
    },
    MuiInputLabel: {
      margin: 'dense',
    },
    MuiRadio: {
      size: 'small',
    },
    MuiSwitch: {
      size: 'small',
    },
    MuiTextField: {
      margin: 'dense',
      size: 'small',
    },
    MuiTooltip: {
      arrow: true,
    },
  },
}));

export default darkTheme;

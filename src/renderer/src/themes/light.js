import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import "@fontsource/eagle-lake";
import "@fontsource/yaldevi";

const lightTheme = responsiveFontSizes(createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#5285fa',
    },
    background: {
      default: '#EAF0F7',
      paper: '#E8E8F7',
      paperLight: '#DEE6FD',
    },
    text: {
      primary: '#212121',
      secondary: '#757575',
      headline: '#ffffff',
      disabled: '#78909c',
      hint: '#81c784',
      link: '#03C172',
      button:'#000',
      dark: '#242f75',
    },
    error: {
      main: '#e57373',
    },
    warning: {
      main: '#ffb74d',
    },
    info: {
      main: '#64b5f6',
    },
    success: {
      main: '#81c784',
    },
    divider: '#e0e0e0',
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

export default lightTheme;

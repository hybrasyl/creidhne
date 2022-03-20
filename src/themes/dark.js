import { createTheme, responsiveFontSizes } from "@mui/material/styles";
import "@fontsource/barlow";

const darkTheme = responsiveFontSizes(
    createTheme({
        palette: {
            type: "dark",
            primary: {
                main: "#231230",
            },
            secondary: {
                main: "#582c51",
            },
            background: {
                paper: "#696868",
                default: "#333333",
            },
            text: {
                primary: "#f1eeee",
            },
            white: {
                main: "#FFFFFF"
            }
        },
        typography: {
            fontFamily: "Barlow",
            h1: {
                fontFamily: "Barlow",
            },
            h2: {
                fontFamily: "Barlow",
            },
            h3: {
                fontFamily: "Barlow",
            },
            h4: {
                fontFamily: "Barlow",
            },
            h5: {
                fontFamily: "Barlow",
            },
            h6: {
                fontFamily: "Barlow",
            },
            body1: {
                fontSize: "1rem",
            },
            body2: {
                fontSize: "0.8rem",
                fontFamily: "Barlow",
            },
            button: {
                fontFamily: "Barlow Condensed",
            },
        },
    })
);

export default darkTheme;

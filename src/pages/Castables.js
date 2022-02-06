import React from "react";
import { Box, TextField, Button, List, ListItem, Grid, ListItemText, ListItemButton, Divider, Accordion, AccordionSummary, AccordionDetails, Typography } from "@mui/material";
import MuiTextField from '@mui/material/TextField';
import { styled } from '@mui/material/styles';

const options = {
  shouldForwardProp: (prop) => prop !== 'borderColor',
};
const outlinedSelectors = [
  '& .MuiOutlinedInput-notchedOutline',
  '&:hover .MuiOutlinedInput-notchedOutline',
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline',
];
const StyledTextField = styled(
  MuiTextField,
  options,
)(({ borderColor }) => ({
  '& label.Mui-focused': {
    color: borderColor,
  },
  [outlinedSelectors.join(',')]: {
    borderWidth: 1,
    borderColor,
  },
}));

const Castables = () => {
  return (
  <Grid container px={1.5} spacing={1}>
    <Grid item xs={12} >
      <Typography variant="h3" textAlign="center">Castables</Typography>
      <Divider />
    </Grid>
    <Grid item xs={2}>
        <select name="file-select-box" size="20">
          <option>List Item 1</option>
          <option>List Item 2</option>
          <option>List Item 3</option>
          <option>List Item 4</option>
          <option>List Item 5</option>
          <option>List Item 6</option>
          <option>List Item 7</option>
          <option>List Item 8</option>
          <option>List Item 9</option>
        </select>
    </Grid>
    <Grid item xs={10}>
      <StyledTextField label="Name" size="small" InputLabelProps={{ shrink: true, sx: { color: "info.main" } }} borderColor="white" type="text" />
      <StyledTextField label="Lines" size="small" InputLabelProps={{ shrink: true, sx: { color: "info.main" } }} borderColor="white" type="number" />
      <StyledTextField label="Icon" size="small" InputLabelProps={{ shrink: true, sx: { color: "info.main" } }} borderColor="white" type="number" />
    </Grid>
  </Grid>
  )
};

export default Castables;
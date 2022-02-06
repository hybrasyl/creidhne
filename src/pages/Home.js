import React from "react";
import { Grid, Select, } from "@mui/material";

const Home = () => {
    return (
        <Grid container spacing={0.5}>
            <Grid item xs={12}>
                Home Placeholder
            </Grid>
            <Select size={5}>
                <option value="1">Balls</option>
                <option value="2">Dicks</option>
            </Select>
        </Grid>
    );
};

export default Home
import React from "react";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";

const nationList = [
    { id: 1, name: "Abel" },
    { id: 2, name: "Itinerant" },
    { id: 3, name: "Loures" },
    { id: 4, name: "Mileth" },
    { id: 5, name: "Noes" },
    { id: 6, name: "Oren" },
    { id: 7, name: "Outcast" },
    { id: 8, name: "Piet" },
    { id: 9, name: "Refugee" },
    { id: 10, name: "Rucesion" },
    { id: 11, name: "Suomi" },
    { id: 12, name: "Tagor" },
    { id: 13, name: "Undine" },
    { id: 14, name: "Undine" },
    { id: 15, name: "Undine" },
    { id: 16, name: "Undine" },
    { id: 17, name: "Undine" },
    { id: 18, name: "Undine" },
    { id: 19, name: "Undine" },
    { id: 20, name: "Undine" },
    { id: 21, name: "Undine" },
];

const Nations = () => {
    return (
        <Box sx={{ mx: 1, mt: 1 }}>
            <Box display="flex" justifyContent="space-between">
                <Box>
                    <Typography variant="h4">Nations</Typography>
                </Box>
                <Box>
                    <Button
                        sx={{ height: "50%", mt: 2, mr: 2 }}
                        variant="contained"
                        id="btnSave"
                    >
                        Save
                    </Button>
                    <Button
                        sx={{ height: "50%", mt: 2, }}
                        variant="contained"
                        id="btnCreate"
                    >
                        Create
                    </Button>
                </Box>
            </Box>
            <Divider sx={{ mt: 1, mb: 4, borderColor: "white.main" }} />
            <Grid container>
                <Grid item xs={2}>
                    <Box
                        sx={{
                            height: "70vh",
                            backgroundColor: "background.paper",
                            border: 1,
                            borderRadius: 2,
                            borderColor: "white.main",
                            overflow: "auto",
                            position: "relative",
                            mr: 4,
                        }}
                    >
                        <List dense disableGutters sx={{ maxHeight: "95%" }}>
                            {nationList.map((nation) => (
                                <ListItem key={nation.id} sx={{ height: "3vh" }}>
                                    <ListItemButton>
                                        <ListItemText primary={nation.name} />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                </Grid>
                <Grid item xs={10}>
                    <Grid container sx={{ ml: -2 }}>
                        <Grid container item spacing={1} xs={10}>
                            <Grid item xs={4}>
                                <TextField
                                    focused
                                    color="white"
                                    id="nation-name"
                                    label="Name"
                                    InputLabelProps={{ shrink: true }}
                                    size="small"
                                    sx={{ width: "100%" }}
                                />
                            </Grid>
                            <Grid item xs={2}>
                                <TextField
                                    focused
                                    color="white"
                                    type="number"
                                    id="nation-flag"
                                    label="Flag"
                                    InputLabelProps={{ shrink: true }}
                                    size="small"
                                    sx={{ width: "100%" }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    focused
                                    color="white"
                                    id="nation-desc"
                                    label="Description"
                                    InputLabelProps={{ shrink: true }}
                                    size="small"
                                    multiline
                                    maxRows={3}
                                    sx={{ width: "100%" }}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    focused
                                    color="white"
                                    id="nation-comment"
                                    label="Comment"
                                    InputLabelProps={{ shrink: true }}
                                    size="small"
                                    multiline
                                    maxRows={3}
                                    sx={{ width: "100%", mt: 2 }}
                                />
                            </Grid>
                        </Grid>
                        <Grid item xs={2} container alignItems="center" justifyContent="center">
                            <Box
                                sx={{ border: 2, color: "white.main", height: "100px", width: "100px", ml: 1 }}
                                alignItems="center"
                                justifyContent="center"
                                display="flex"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Box sx={{ mt: 2, borderTop: 1, borderColor: "white.main" }}>
                                <Typography variant="h5">Spawn Points</Typography>
                                <Grid container alignItems="center" justifyContent="flex-start">
                                    <Grid item xs={2}>
                                        <TextField
                                            focused
                                            color="white"
                                            id="nation-spawn1x"
                                            label="X Coordinate"
                                            InputLabelProps={{ shrink: true }}
                                            size="small"
                                            sx={{ mt: 2, mr: 1 }}
                                        />
                                    </Grid>
                                    <Grid item xs={2}>
                                        <TextField
                                            focused
                                            color="white"
                                            id="nation-spawn1y"
                                            label="Y Coordinate"
                                            InputLabelProps={{ shrink: true }}
                                            size="small"
                                            sx={{ mt: 2, mr: 1 }}
                                        />
                                    </Grid>
                                    <Grid item xs={6}>
                                        <TextField
                                            focused
                                            color="white"
                                            id="nation-spawnmap1"
                                            label="Map Name"
                                            InputLabelProps={{ shrink: true }}
                                            size="small"
                                            sx={{ width: "100%", mt: 2, mr: 1 }}
                                        />
                                    </Grid>
                                    <Grid item xs={1}>
                                        <Button
                                            sx={{ height: "50%", width: "50%", mt: 2, ml: 1 }}
                                            variant="contained"
                                            id="btnAdd1"
                                        >
                                            +
                                        </Button>
                                    </Grid>
                                    <Grid item xs={1}>
                                        <Button
                                            sx={{ height: "50%", width: "50%", mt: 2 }}
                                            variant="contained"
                                            disabled
                                            id="btnSub1"
                                        >
                                            -
                                        </Button>
                                    </Grid>
                                    <Grid item xs={2}>
                                        <TextField
                                            focused
                                            color="white"
                                            id="nation-spawn2x"
                                            label="X Coordinate"
                                            InputLabelProps={{ shrink: true }}
                                            size="small"
                                            sx={{ mt: 2, mr: 1 }}
                                        />
                                    </Grid>
                                    <Grid item xs={2}>
                                        <TextField
                                            focused
                                            color="white"
                                            id="nation-spawn2y"
                                            label="Y Coordinate"
                                            InputLabelProps={{ shrink: true }}
                                            size="small"
                                            sx={{ mt: 2, mr: 1 }}
                                        />
                                    </Grid>
                                    <Grid item xs={6}>
                                        <TextField
                                            focused
                                            color="white"
                                            id="nation-spawnmap2"
                                            label="Map Name"
                                            InputLabelProps={{ shrink: true }}
                                            size="small"
                                            sx={{ width: "100%", mt: 2, mr: 1 }}
                                        />
                                    </Grid>
                                    <Grid item xs={1}>
                                        <Button
                                            sx={{ height: "50%", width: "50%", mt: 2, ml: 1 }}
                                            variant="contained"
                                            id="btnAdd2"
                                        >
                                            +
                                        </Button>
                                    </Grid>
                                    <Grid item xs={1}>
                                        <Button
                                            sx={{ height: "50%", width: "50%", mt: 2, }}
                                            variant="contained"
                                            id="btnSub2"
                                        >
                                            -
                                        </Button>
                                    </Grid>
                                </Grid>
                            </Box>
                        </Grid>
                        <Grid item xs={12}>
                            <Box sx={{ mt: 2, borderTop: 1, borderColor: "white.main" }}>
                                <Typography variant="h5">Territories</Typography>
                                <Grid container alignItems="center" justifyContent="flex-start">
                                    <Grid item xs={8}>
                                        <TextField
                                            focused
                                            color="white"
                                            id="nation-terrmap1"
                                            label="Map Name"
                                            InputLabelProps={{ shrink: true }}
                                            size="small"
                                            sx={{ width: "100%", mt: 2 }}
                                        />
                                    </Grid>
                                    <Grid item xs={1}>
                                        <Button
                                            sx={{ height: "50%", mt: 2, width: "50%", ml: 1 }}
                                            variant="contained"
                                            id="btnTerrAdd2"
                                        >
                                            +
                                        </Button>
                                    </Grid>
                                    <Grid item xs={1}>
                                        <Button
                                            sx={{ height: "50%", mt: 2, width: "50%", }}
                                            variant="contained"
                                            id="btnTerrSub2"
                                            disabled
                                        >
                                            -
                                        </Button>
                                    </Grid>
                                    <Grid item spacing={1} xs={2}></Grid>
                                    <Grid item spacing={1} xs={8}>
                                        <TextField
                                            focused
                                            color="white"
                                            id="nation-terrmap1"
                                            label="Map Name"
                                            InputLabelProps={{ shrink: true }}
                                            size="small"
                                            sx={{ width: "100%", mt: 2 }}
                                        />
                                    </Grid>
                                    <Grid item xs={1}>
                                        <Button
                                            sx={{ height: "50%", mt: 2, width: "50%", ml: 1 }}
                                            variant="contained"
                                            id="btnTerrAdd2"
                                        >
                                            +
                                        </Button>
                                    </Grid>
                                    <Grid item xs={1}>
                                        <Button
                                            sx={{ height: "50%", mt: 2, width: "50%", }}
                                            variant="contained"
                                            id="btnTerrSub2"
                                        >
                                            -
                                        </Button>
                                    </Grid>
                                    <Grid item spacing={1} xs={2}></Grid>
                                </Grid>
                            </Box>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Nations;

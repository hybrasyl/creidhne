import * as React from "react";
import { styled, useTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import CssBaseline from "@mui/material/CssBaseline";
import MuiAppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import List from "@mui/material/List";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import SettingsIcon from "@mui/icons-material/Settings";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ColorizeIcon from "@mui/icons-material/Colorize";
import SentimentDissatisfiedIcon from "@mui/icons-material/SentimentDissatisfied";
import GroupsIcon from "@mui/icons-material/Groups";
import PetsIcon from "@mui/icons-material/Pets";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";
import FortIcon from "@mui/icons-material/Fort";
import PaidIcon from "@mui/icons-material/Paid";
import AutoAwesomeMotionIcon from "@mui/icons-material/AutoAwesomeMotion";
import OutdoorGrillIcon from "@mui/icons-material/OutdoorGrill";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import ScienceIcon from "@mui/icons-material/Science";
import DisplaySettingsIcon from "@mui/icons-material/DisplaySettings";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import MapIcon from "@mui/icons-material/Map";
import CreateIcon from "@mui/icons-material/Create";
import HomeIcon from "@mui/icons-material/Home";
import { BrowserRouter, Route, Link, Routes } from "react-router-dom";
import Castables from "./pages/Castables.js";
import Items from "./pages/Items.js";
import Statuses from "./pages/Statuses.js";
import Npcs from "./pages/Npcs.js";
import Creatures from "./pages/Creatures.js";
import BehaviorSets from "./pages/BehaviorSets.js";
import Nations from "./pages/Nations.js";
import LootSets from "./pages/LootSets.js";
import ItemVariants from "./pages/Variants.js";
import Recipes from "./pages/Recipes.js";
import ElementTable from "./pages/Elements.js";
import SpawnGroups from "./pages/SpawnGroups.js";
import Formulas from "./pages/FormulasServer.js";
import SettingsServer from "./pages/SettingsServer.js";
import Maps from "./pages/Maps.js";
import Scripting from "./pages/Scripting.js";
import SettingsApp from "./pages/SettingsApp.js";
import Strings from "./pages/Strings.js"
import Home from "./pages/Home.js";

const drawerWidth = 240;

const Main = styled("main", { shouldForwardProp: (prop) => prop !== "open" })(({ theme, open }) => ({
    flexGrow: 1,
    padding: theme.spacing(0),
    transition: theme.transitions.create("margin", {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: `-${drawerWidth}px`,
    ...(open && {
        transition: theme.transitions.create("margin", {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
        marginLeft: 0,
    }),
}));

const AppBar = styled(MuiAppBar, {
    shouldForwardProp: (prop) => prop !== "open",
})(({ theme, open }) => ({
    transition: theme.transitions.create(["margin", "width"], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    ...(open && {
        width: `calc(100% - ${drawerWidth}px)`,
        marginLeft: `${drawerWidth}px`,
        transition: theme.transitions.create(["margin", "width"], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
    }),
}));

const DrawerHeader = styled("div")(({ theme }) => ({
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(0, 1),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
    justifyContent: "flex-end",
}));

export default function App() {
    const theme = useTheme();
    const [open, setOpen] = React.useState(false);

    const handleDrawerOpen = () => {
        setOpen(true);
    };

    const handleDrawerClose = () => {
        setOpen(false);
    };

    return (
        <BrowserRouter>
            <Box sx={{ display: "flex" }}>
                <CssBaseline />
                <AppBar position="fixed" open={open}>
                    <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            onClick={handleDrawerOpen}
                            edge="start"
                            sx={{ mr: 2, ...(open && { display: "none" }) }}
                        >
                            <MenuIcon />
                        </IconButton>
                        <IconButton
                            color="inherit"
                            aria-label="settings"
                            edge="end"
                            key="settingsapp"
                            to="/settingsapp"
                            component={Link}
                        >
                            <SettingsIcon />
                        </IconButton>
                    </Toolbar>
                </AppBar>
                <Drawer
                    sx={{
                        width: drawerWidth,
                        flexShrink: 0,
                        "& .MuiDrawer-paper": {
                            width: drawerWidth,
                            boxSizing: "border-box",
                        },
                    }}
                    variant="persistent"
                    anchor="left"
                    open={open}
                >
                    <DrawerHeader sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Box display="flex" flexDirection="row" alignItems="center">
                            <IconButton key="home" to="/" component={Link}>
                                <HomeIcon sx={{ color: "white" }} />
                            </IconButton>
                            <Typography>Navigation</Typography>
                        </Box>
                        <IconButton onClick={handleDrawerClose}>
                            {theme.direction === "ltr" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                        </IconButton>
                    </DrawerHeader>
                    <Divider />
                    <List dense={true}>
                        <ListItem button key="castables" to="/castables" component={Link}>
                            <ListItemIcon>
                                <AutoAwesomeIcon sx={{ color: "white" }} />
                            </ListItemIcon>
                            <ListItemText primary="Castables" />
                        </ListItem>
                        <ListItem button key="items" to="/items" component={Link}>
                            <ListItemIcon>
                                <ColorizeIcon sx={{ color: "white" }} />
                            </ListItemIcon>
                            <ListItemText primary="Items" />
                        </ListItem>
                        <ListItem button key="statuses" to="/statuses" component={Link}>
                            <ListItemIcon>
                                <SentimentDissatisfiedIcon sx={{ color: "white" }} />
                            </ListItemIcon>
                            <ListItemText primary="Statuses" />
                        </ListItem>
                        <ListItem button key="npcs" to="/npcs" component={Link}>
                            <ListItemIcon>
                                <GroupsIcon sx={{ color: "white" }} />
                            </ListItemIcon>
                            <ListItemText primary="NPCs" />
                        </ListItem>
                        <ListItem button key="creatures" to="/creatures" component={Link}>
                            <ListItemIcon>
                                <PetsIcon sx={{ color: "white" }} />
                            </ListItemIcon>
                            <ListItemText primary="Creatures" />
                        </ListItem>
                        <ListItem button key="behaviors" to="/behaviorsets" component={Link}>
                            <ListItemIcon>
                                <QuestionMarkIcon sx={{ color: "white" }} />
                            </ListItemIcon>
                            <ListItemText primary="Behavior Sets" />
                        </ListItem>
                        <ListItem button key="nations" to="/nations" component={Link}>
                            <ListItemIcon>
                                <FortIcon sx={{ color: "white" }} />
                            </ListItemIcon>
                            <ListItemText primary="Nations" />
                        </ListItem>
                        <ListItem button key="loot" to="/lootsets" component={Link}>
                            <ListItemIcon>
                                <PaidIcon sx={{ color: "white" }} />
                            </ListItemIcon>
                            <ListItemText primary="Loot Sets" />
                        </ListItem>
                        <ListItem button key="variants" to="/variants" component={Link}>
                            <ListItemIcon>
                                <AutoAwesomeMotionIcon sx={{ color: "white" }} />
                            </ListItemIcon>
                            <ListItemText primary="Item Variants" />
                        </ListItem>
                        <ListItem button key="recipes" to="/recipes" component={Link}>
                            <ListItemIcon>
                                <OutdoorGrillIcon sx={{ color: "white" }} />
                            </ListItemIcon>
                            <ListItemText primary="Recipes" />
                        </ListItem>
                        <ListItem button key="elements" to="/elements" component={Link}>
                            <ListItemIcon>
                                <LocalFireDepartmentIcon sx={{ color: "white" }} />
                            </ListItemIcon>
                            <ListItemText primary="Element Table" />
                        </ListItem>
                        <ListItem button key="spawns" to="/spawngroups" component={Link}>
                            <ListItemIcon>
                                <PeopleOutlineIcon sx={{ color: "white" }} />
                            </ListItemIcon>
                            <ListItemText primary="Spawn Groups" />
                        </ListItem>
                    </List>
                    <Divider />
                    <List dense={true}>
                        <ListItem button key="formulas" to="/formulas" component={Link}>
                            <ListItemIcon>
                                <ScienceIcon sx={{ color: "white" }} />
                            </ListItemIcon>
                            <ListItemText primary="Formulas" />
                        </ListItem>
                        <ListItem button key="settingsserver" to="/settingsserver" component={Link}>
                            <ListItemIcon>
                                <DisplaySettingsIcon sx={{ color: "white" }} />
                            </ListItemIcon>
                            <ListItemText primary="Server Settings" />
                        </ListItem>
                        <ListItem button key="strings" to="/strings" component={Link}>
                            <ListItemIcon>
                                <RecordVoiceOverIcon sx={{ color: "white" }} />
                            </ListItemIcon>
                            <ListItemText primary="Strings" />
                        </ListItem>
                    </List>
                    <Divider />
                    <List dense={true}>
                        <ListItem button key="maps" to="/maps" component={Link}>
                            <ListItemIcon>
                                <MapIcon sx={{ color: "white" }} />
                            </ListItemIcon>
                            <ListItemText primary="Maps" />
                        </ListItem>
                    </List>
                    <Divider />
                    <List dense={true}>
                        <ListItem button key="scripting" to="/scripting" component={Link}>
                            <ListItemIcon>
                                <CreateIcon sx={{ color: "white" }} />
                            </ListItemIcon>
                            <ListItemText primary="Scripting" />
                        </ListItem>
                    </List>
                </Drawer>
                <Main open={open}>
                    <DrawerHeader />
                    <Routes>
                        <Route exact path="/castables" element={<Castables />} />
                        <Route path="/items" element={<Items />} />
                        <Route path="/statuses" element={<Statuses />} />
                        <Route path="/npcs" element={<Npcs />} />
                        <Route path="/creatures" element={<Creatures />} />
                        <Route path="/behaviorsets" element={<BehaviorSets />} />
                        <Route path="/nations" element={<Nations />} />
                        <Route path="/lootsets" element={<LootSets />} />
                        <Route path="/variants" element={<ItemVariants />} />
                        <Route path="/recipes" element={<Recipes />} />
                        <Route path="/elements" element={<ElementTable />} />
                        <Route path="/spawngroups" element={<SpawnGroups />} />
                        <Route path="/formulas" element={<Formulas />} />
                        <Route path="/settingsserver" element={<SettingsServer />} />
                        <Route path="/strings" element={<Strings />} />
                        <Route path="/maps" element={<Maps />} />
                        <Route path="/scripting" element={<Scripting />} />
                        <Route path="/settingsapp" element={<SettingsApp />} />
                        <Route path="/" element={<Home />} />
                    </Routes>
                </Main>
            </Box>
        </BrowserRouter>
    );
}

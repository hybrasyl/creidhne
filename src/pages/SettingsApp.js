import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";

var worldDir = "F:\\Documents\\Hybrasyl\\world";
var clientDir = "D:\\Other Games\\Dark Ages"

const SettingsApp = () => {
    return (
        <Box sx={{ mx: 1, mt: 1}}>
            <Typography variant="h4">Settings</Typography>
            <Divider sx={{ mt: 1, mb: 4, borderColor: "white.main" }} />
            <Box display="flex" flexDirection="row" justifyContent="left">
                <Box sx={{ border: 1, borderColor: "white.main", mx: 1, my: 1, width: "60%", borderRadius: 2, p: 0.5 }}>
                    <Typography variant="caption" sx={{ bgColor: "primary", position: "relative", bottom: "30px" }}>
                        World Data Directory
                    </Typography>
                    <Typography variant="body1" sx={{ mt: -3 }} value={worldDir}>
                        {worldDir}
                    </Typography>
                </Box>
                <Button variant="contained" size="small" sx={{ my: 1 }} color="secondary">
                    Edit
                </Button>
            </Box>
            <Box display="flex" flexDirection="row" justifyContent="left" sx={{my: 1}}>
                <Box sx={{ border: 1, borderColor: "white.main", mx: 1, my: 1, width: "60%", borderRadius: 2, p: 0.5 }}>
                    <Typography variant="caption" sx={{ bgColor: "primary", position: "relative", bottom: "30px" }}>
                        Hybrasyl Client Directory
                    </Typography>
                    <Typography variant="body1" sx={{ mt: -3 }} value={worldDir}>
                        {clientDir}
                    </Typography>
                </Box>
                <Button variant="contained" size="small" sx={{ my: 1 }} color="secondary">
                    Edit
                </Button>
            </Box>
        </Box>
    );
};

export default SettingsApp;

import { Box, Typography } from "@mui/material";

export default function AppFooter() {
  return (
    <Box
      component="footer"
      sx={{
        mt: "auto",
        py: 2,
        textAlign: "center",
        color: "text.secondary",
      }}
    >
      <Typography variant="caption">
        Powered by <b>AFB Global</b>
      </Typography>
    </Box>
  );
}

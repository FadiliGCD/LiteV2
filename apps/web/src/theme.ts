import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#0B3D91" }, // official deep blue
    secondary: { main: "#1F6FEB" },
    background: {
      default: "#F4F6F8",
      paper: "#FFFFFF",
    },
    divider: "rgba(0,0,0,0.10)",
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: [
      "system-ui",
      "-apple-system",
      "Segoe UI",
      "Roboto",
      "Arial",
      "sans-serif",
    ].join(","),
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
        },
      },
    },
    MuiAppBar: {
      defaultProps: { color: "transparent" },
      styleOverrides: {
        root: {
          backdropFilter: "blur(10px)",
          backgroundImage: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
  },
});

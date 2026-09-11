
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Box,
  Button,
  Divider,
  Drawer,
  Stack,
  Typography,
} from "@mui/material";
import AppFooter from "../components/AppFooter";
import AppHeader from "../components/AppHeader";

const drawerWidth = 260;

function NavItem({ to, label }: { to: string; label: string }) {
  const location = useLocation();

  const active =
    location.pathname === to ||
    (to === "/stock" && location.pathname === "/stock");

  return (
    <Button
      component={Link}
      to={to}
      variant={active ? "contained" : "text"}
      sx={{
        justifyContent: "flex-start",
        px: 2,
        py: 1.1,
        fontWeight: active ? 800 : 700,
      }}
      fullWidth
    >
      {label}
    </Button>
  );
}

export default function AppLayout() {
  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: "#f4f7fb",
      }}
    >
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          },
        }}
      >
        <Stack sx={{ p: 2 }} spacing={1}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            Gestion de stock
          </Typography>

          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              lineHeight: 1.5,
            }}
          >
            Entrées, parking, sorties et rapports.
          </Typography>
        </Stack>

        <Divider />

        <Stack sx={{ p: 1.5 }} spacing={1}>
          <NavItem to="/stock" label="Tableau de bord" />
          <NavItem to="/stock/entree" label="Entrée" />
          <NavItem to="/stock/parking" label="Parking" />
          <NavItem to="/stock/sortie" label="Sortie" />
          <NavItem to="/stock/rapport-charge" label="Rapport de charge" />
        </Stack>
      </Drawer>

      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <AppHeader
          title="Gestion de stock"
          subtitle="Entrées, réservations, sorties et rapports"
          actions={
            <Button component={Link} to="/modules" variant="outlined">
              Modules
            </Button>
          }
        />

        <Box
          sx={{
            p: { xs: 2, md: 2.5 },
            flex: 1,
            minWidth: 0,
          }}
        >
          <Outlet />
        </Box>

        <AppFooter />
      </Box>
    </Box>
  );
}
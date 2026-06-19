import * as React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  Paper,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import AppFooter from "../components/AppFooter";
import { getSession, onAuthChange, signOut } from "../auth/auth";

const drawerWidth = 260;

function NavItem({
  to,
  label,
}: {
  to: string;
  label: string;
}) {
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
      }}
      fullWidth
    >
      {label}
    </Button>
  );
}

export default function AppLayout() {
  const navigate = useNavigate();

  const [sessionLabel, setSessionLabel] = React.useState("");
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    const setFromSession = (session: any) => {
      if (!mounted) return;

      if (!session) {
        setSessionLabel("");
        return;
      }

      setSessionLabel(
        `${session.user.email} • ${session.role}`
      );
    };

    const initialize = async () => {
      try {
        const session = await getSession();
        setFromSession(session);
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    };

    initialize();

    const { data } = onAuthChange((session) => {
      setFromSession(session);

      if (mounted) {
        setChecking(false);
      }
    });

    return () => {
      mounted = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  const logout = async () => {
  try {
    await signOut();
  } catch (error) {
    console.error("Logout failed:", error);
  } finally {
    navigate("/login", { replace: true });
  }
};

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: "background.default",
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
          },
        }}
      >
        <Stack sx={{ p: 2 }} spacing={1}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Lite V2
          </Typography>

          <ChipLabel />

          <Typography
            variant="caption"
            sx={{
              color: "primary.main",
              fontWeight: 700,
            }}
          >
            Gestion de stock
          </Typography>

          <Typography
            variant="caption"
            sx={{ color: "text.secondary" }}
          >
            {checking
              ? "Checking session..."
              : sessionLabel || "Not signed in"}
          </Typography>
        </Stack>

        <Divider />

        <Stack sx={{ p: 1.5 }} spacing={1}>
          <NavItem to="/stock" label="Dashboard" />
          <NavItem to="/stock/entree" label="Entrée" />
          <NavItem to="/stock/parking" label="Parking" />
          <NavItem to="/stock/sortie" label="Sortie" />
          <NavItem
            to="/stock/rapport-charge"
            label="Rapport de charge"
          />
        </Stack>

        <Box sx={{ mt: "auto" }}>
          <Divider />

          <Stack sx={{ p: 1.5 }} spacing={1}>
            <Button
              variant="text"
              onClick={() => navigate("/modules")}
            >
              Changer de module
            </Button>

            <Button variant="outlined" onClick={logout}>
              Logout
            </Button>
          </Stack>
        </Box>
      </Drawer>

      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Toolbar sx={{ display: "flex", gap: 2 }}>
            <Box
              component="img"
              src="/logo.png"
              alt="AFB Global"
              sx={{
                height: 34,
                width: "auto",
              }}
            />

            <Box sx={{ flexGrow: 1 }} />

            <Paper
              variant="outlined"
              sx={{
                px: 1.5,
                py: 0.6,
                borderRadius: 2,
                bgcolor: "background.paper",
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: "text.secondary" }}
              >
                Gestion de stock • Secure Session
              </Typography>
            </Paper>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: 2, flex: 1, minWidth: 0 }}>
          <Outlet />
        </Box>

        <AppFooter />
      </Box>
    </Box>
  );
}

function ChipLabel() {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignSelf: "flex-start",
        px: 1,
        py: 0.35,
        borderRadius: 1.5,
        bgcolor: "primary.main",
        color: "primary.contrastText",
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      ADMIN
    </Box>
  );
}
import * as React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  Stack,
  Toolbar,
  Typography,
  Paper,
} from "@mui/material";
import AppFooter from "../components/AppFooter";
import { getSession, onAuthChange, signOut } from "../auth/auth";

const drawerWidth = 260;

function NavItem({ to, label }: { to: string; label: string }) {
  const loc = useLocation();
  const active = loc.pathname === to || (to === "/" && loc.pathname === "/");
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
  const nav = useNavigate();

  const [sessionLabel, setSessionLabel] = React.useState<string>("");
  const [checking, setChecking] = React.useState<boolean>(true);

  React.useEffect(() => {
    let mounted = true;

    const setFromSession = (s: any) => {
      if (!mounted) return;
      if (!s) setSessionLabel("");
      else setSessionLabel(`${s.user.email} • ${s.role}`);
    };

    const init = async () => {
      try {
        const s = await getSession();
        setFromSession(s);
      } finally {
        if (mounted) setChecking(false);
      }
    };

    init();

    const { data } = onAuthChange((s) => {
      setFromSession(s);
      if (mounted) setChecking(false);
    });

    return () => {
      mounted = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await signOut();
    nav("/login", { replace: true });
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid rgba(0,0,0,0.10)",
          },
        }}
      >
        <Stack sx={{ p: 2 }} spacing={1}>
          <Typography variant="h6">Lite V2</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {checking ? "Checking session..." : sessionLabel || "Not signed in"}
          </Typography>
        </Stack>
        <Divider />

        <Stack sx={{ p: 1.5 }} spacing={1}>
          <NavItem to="/" label="Dashboard" />
          <NavItem to="/entree" label="Entreé" />
          <NavItem to="/parking" label="Parking" />
          <NavItem to="/sortie" label="Sortie" />
        </Stack>

        <Box sx={{ mt: "auto" }}>
          <Divider />
          <Stack sx={{ p: 1.5 }}>
            <Button variant="outlined" onClick={logout}>
              Logout
            </Button>
          </Stack>
        </Box>
      </Drawer>

      {/* Main */}
      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        <AppBar position="sticky" elevation={0} sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
          <Toolbar sx={{ display: "flex", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box component="img" src="/logo.png" alt="AFB Global" sx={{ height: 34, width: "auto" }} />
            </Box>

            <Box sx={{ flexGrow: 1 }} />

            <Paper variant="outlined" sx={{ px: 1.5, py: 0.6, borderRadius: 2, bgcolor: "background.paper" }}>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Secure Session
              </Typography>
            </Paper>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: 2, flex: 1 }}>
          <Outlet />
        </Box>

        <AppFooter />
      </Box>
    </Box>
  );
}

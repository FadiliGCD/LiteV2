import * as React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  Stack,
  Typography,
} from "@mui/material";
import AppFooter from "../components/AppFooter";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

const drawerWidth = 260;

type ProfileRow = {
  role: string | null;
  stock_access: string[] | null;
};

type StockNavItem = {
  to: string;
  label: string;
  permission: string;
};

const STOCK_NAV_ITEMS: StockNavItem[] = [
  {
    to: "/stock",
    label: "Tableau de bord",
    permission: "stock_dashboard",
  },
  {
    to: "/stock/entree",
    label: "Entrée",
    permission: "entree_view",
  },
  {
    to: "/stock/parking",
    label: "Parking",
    permission: "parking_view",
  },
  {
    to: "/stock/sortie",
    label: "Sortie",
    permission: "sortie_view",
  },
  {
    to: "/stock/rapport-charge",
    label: "Rapport de charge",
    permission: "rapport_charge_view",
  },
];

function hasStockAccess(profile: ProfileRow | null, permission: string) {
  if (!profile) return false;

  const role = String(profile.role ?? "").toLowerCase();

  if (role === "superuser" || role === "admin") {
    return true;
  }

  const access = Array.isArray(profile.stock_access)
    ? profile.stock_access
    : [];

  return access.includes(permission);
}

function getFirstAllowedStockPath(profile: ProfileRow | null) {
  const firstItem = STOCK_NAV_ITEMS.find((item) =>
    hasStockAccess(profile, item.permission)
  );

  return firstItem?.to ?? "/modules";
}

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
        fontWeight: active ? 800 : 700,
      }}
      fullWidth
    >
      {label}
    </Button>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [profile, setProfile] = React.useState<ProfileRow | null>(null);
  const [loadingProfile, setLoadingProfile] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      setLoadingProfile(true);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (mounted) setProfile(null);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("role, stock_access")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw new Error(error.message);

        if (mounted) {
          setProfile((data ?? null) as ProfileRow | null);
        }
      } catch {
        if (mounted) setProfile(null);
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const visibleNavItems = React.useMemo(() => {
    return STOCK_NAV_ITEMS.filter((item) =>
      hasStockAccess(profile, item.permission)
    );
  }, [profile]);

  React.useEffect(() => {
    if (loadingProfile) return;
    if (!profile) return;

    const currentPath = location.pathname;

    const isCurrentPathAllowed = visibleNavItems.some((item) => {
      if (item.to === "/stock") {
        return currentPath === "/stock";
      }

      return currentPath.startsWith(item.to);
    });

    if (!isCurrentPathAllowed) {
      navigate(getFirstAllowedStockPath(profile), { replace: true });
    }
  }, [loadingProfile, profile, visibleNavItems, location.pathname, navigate]);

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
          {loadingProfile ? (
            <Stack alignItems="center" spacing={1.5} sx={{ py: 2 }}>
              <CircularProgress size={22} />

              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Chargement des accès...
              </Typography>
            </Stack>
          ) : visibleNavItems.length ? (
            visibleNavItems.map((item) => (
              <NavItem key={item.to} to={item.to} label={item.label} />
            ))
          ) : (
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                px: 1,
                py: 2,
              }}
            >
              Aucun accès stock disponible.
            </Typography>
          )}
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
import * as React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AppFooter from "../components/AppFooter";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

const drawerWidth = 278;

type ProfileRow = {
  role: string | null;
  stock_access: string[] | null;
};

type StockNavItem = {
  to: string;
  label: string;
  shortLabel: string;
  description: string;
  permission: string;
};

const STOCK_NAV_ITEMS: StockNavItem[] = [
  {
    to: "/stock",
    label: "Tableau de bord",
    shortLabel: "Dashboard",
    description: "Vue générale du stock",
    permission: "stock_dashboard",
  },
  {
    to: "/stock/entree",
    label: "Entrée",
    shortLabel: "Entrée",
    description: "Réception et stock disponible",
    permission: "entree_view",
  },
  {
    to: "/stock/parking",
    label: "Parking",
    shortLabel: "Parking",
    description: "Réservations clients",
    permission: "parking_view",
  },
  {
    to: "/stock/sortie",
    label: "Sortie",
    shortLabel: "Sortie",
    description: "Ventes et chargements",
    permission: "sortie_view",
  },
  {
    to: "/stock/rapport-charge",
    label: "Rapport de charge",
    shortLabel: "Rapport",
    description: "Document de charge",
    permission: "rapport_charge_view",
  },
];

function hasStockAccess(profile: ProfileRow | null, permission: string) {
  if (!profile) return false;
  const role = String(profile.role ?? "").toLowerCase();
  if (role === "superuser" || role === "admin") return true;
  const access = Array.isArray(profile.stock_access) ? profile.stock_access : [];
  return access.includes(permission);
}

function getFirstAllowedStockPath(profile: ProfileRow | null) {
  const firstItem = STOCK_NAV_ITEMS.find((item) => hasStockAccess(profile, item.permission));
  return firstItem?.to ?? "/modules";
}

function NavItem({ to, label, description }: { to: string; label: string; description: string }) {
  const location = useLocation();
  const active = location.pathname === to || (to === "/stock" && location.pathname === "/stock");

  return (
    <Button
      component={Link}
      to={to}
      variant="text"
      fullWidth
      sx={{
        justifyContent: "flex-start",
        textAlign: "left",
        px: 1.4,
        py: 1.15,
        borderRadius: 2.2,
        bgcolor: active ? "primary.main" : "transparent",
        color: active ? "primary.contrastText" : "text.primary",
        boxShadow: active ? "0 10px 24px rgba(15, 23, 42, 0.16)" : "none",
        "&:hover": {
          bgcolor: active ? "primary.dark" : "action.hover",
        },
      }}
    >
      <Stack spacing={0.1} alignItems="flex-start">
        <Typography variant="body2" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
          {label}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: active ? "rgba(255,255,255,0.78)" : "text.secondary",
            lineHeight: 1.2,
            textTransform: "none",
          }}
        >
          {description}
        </Typography>
      </Stack>
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
        if (mounted) setProfile((data ?? null) as ProfileRow | null);
      } catch {
        if (mounted) setProfile(null);
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    };

    void loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleNavItems = React.useMemo(
    () => STOCK_NAV_ITEMS.filter((item) => hasStockAccess(profile, item.permission)),
    [profile]
  );

  React.useEffect(() => {
    if (loadingProfile || !profile) return;
    const currentPath = location.pathname;
    const isCurrentPathAllowed = visibleNavItems.some((item) => {
      if (item.to === "/stock") return currentPath === "/stock";
      return currentPath.startsWith(item.to);
    });
    if (!isCurrentPathAllowed) navigate(getFirstAllowedStockPath(profile), { replace: true });
  }, [loadingProfile, profile, visibleNavItems, location.pathname, navigate]);

  const role = String(profile?.role ?? "user");
  const currentPage = React.useMemo(() => {
    return (
      STOCK_NAV_ITEMS.find((item) => {
        if (item.to === "/stock") return location.pathname === "/stock";
        return location.pathname.startsWith(item.to);
      }) ?? STOCK_NAV_ITEMS[0]
    );
  }, [location.pathname]);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#eef4fb" }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          display: { xs: "none", md: "block" },
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid rgba(15, 23, 42, 0.08)",
            bgcolor: "#f8fafc",
          },
        }}
      >
        <Stack sx={{ height: "100%" }}>
          <Box sx={{ p: 2 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 3,
                color: "white",
                background:
                  "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #0ea5e9 100%)",
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 950 }}>
                Gestion de stock
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.82, lineHeight: 1.5 }}>
                Entrées, parking, sorties et rapports.
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap">
                <Chip
                  size="small"
                  label={loadingProfile ? "Chargement..." : role}
                  sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "white", fontWeight: 800 }}
                />
                <Chip
                  size="small"
                  label={`${visibleNavItems.length} accès`}
                  sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "white", fontWeight: 800 }}
                />
              </Stack>
            </Paper>
          </Box>

          <Divider />

          <Stack sx={{ p: 1.5, flex: 1 }} spacing={0.8}>
            {loadingProfile ? (
              <Stack alignItems="center" spacing={1.5} sx={{ py: 3 }}>
                <CircularProgress size={22} />
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Chargement des accès...
                </Typography>
              </Stack>
            ) : visibleNavItems.length ? (
              visibleNavItems.map((item) => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  description={item.description}
                />
              ))
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary", px: 1, py: 2 }}>
                Aucun accès stock disponible.
              </Typography>
            )}
          </Stack>

          <Box sx={{ p: 1.5 }}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "background.paper" }}>
              <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.5 }}>
                Workflow: Entrée → Parking → Sortie → Rapport de charge.
              </Typography>
            </Paper>
          </Box>
        </Stack>
      </Drawer>

      <Box sx={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <AppHeader
          title="Gestion de stock"
          subtitle={`${currentPage.label} — ${currentPage.description}`}
          actions={
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={role}
                size="small"
                variant="outlined"
                sx={{ display: { xs: "none", sm: "inline-flex" }, fontWeight: 800 }}
              />
              <Button component={Link} to="/modules" variant="outlined">
                Modules
              </Button>
            </Stack>
          }
        />

        <Box
          sx={{
            px: { xs: 1.5, md: 2.5 },
            py: { xs: 1.5, md: 2.25 },
            flex: 1,
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              display: { xs: "block", md: "none" },
              mb: 1.5,
              overflowX: "auto",
            }}
          >
            <Stack direction="row" spacing={1} sx={{ minWidth: "max-content" }}>
              {visibleNavItems.map((item) => {
                const active =
                  location.pathname === item.to ||
                  (item.to !== "/stock" && location.pathname.startsWith(item.to));
                return (
                  <Button
                    key={item.to}
                    component={Link}
                    to={item.to}
                    variant={active ? "contained" : "outlined"}
                    size="small"
                    sx={{ borderRadius: 999, fontWeight: 900 }}
                  >
                    {item.shortLabel}
                  </Button>
                );
              })}
            </Stack>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.25, md: 2 },
              borderRadius: 4,
              bgcolor: "rgba(255,255,255,0.76)",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
              minHeight: "calc(100vh - 170px)",
            }}
          >
            <Outlet />
          </Paper>
        </Box>

        <AppFooter />
      </Box>
    </Box>
  );
}
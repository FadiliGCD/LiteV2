import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AppFooter from "../components/AppFooter";
import AppHeader from "../components/AppHeader";
import { getSession } from "../auth/auth";
import { supabase } from "../lib/supabaseClient";

type ModuleKey = "reception" | "production" | "stock" | "accounting" | "hr" | "settings";
type ModuleCard = {
  key: ModuleKey;
  title: string;
  description: string;
  shortName: string;
  path?: string;
  available: boolean;
  category: string;
};
type ProfileRow = {
  role: string | null;
  module_access: string[] | null;
  stock_access: string[] | null;
};

const MODULES: ModuleCard[] = [
  {
    key: "reception",
    title: "Réception",
    description: "Gestion de la réception des marchandises, fournisseurs et contrôles d'arrivée.",
    shortName: "RC",
    available: false,
    category: "Opérations",
  },
  {
    key: "production",
    title: "Production",
    description: "Suivi des opérations de production, transformation et rendement.",
    shortName: "PR",
    available: false,
    category: "Opérations",
  },
  {
    key: "stock",
    title: "Gestion de stock",
    description: "Entrées, réservations, sorties, rapports de charge et vue d'ensemble du stock.",
    shortName: "GS",
    path: "/stock",
    available: true,
    category: "Core workflow",
  },
  {
    key: "accounting",
    title: "Comptabilité",
    description: "Gestion financière, règlements, facturation et suivi comptable.",
    shortName: "CP",
    available: false,
    category: "Finance",
  },
  {
    key: "hr",
    title: "HR",
    description: "Employés, pointage, horaires, contrats et ressources humaines.",
    shortName: "HR",
    path: "/hr",
    available: true,
    category: "Administration",
  },
  {
    key: "settings",
    title: "Settings",
    description: "Security control center for users, roles, access, logs and maintenance.",
    shortName: "ST",
    path: "/settings",
    available: true,
    category: "Security",
  },
];

const STOCK_PATHS = [
  { permission: "stock_dashboard", path: "/stock" },
  { permission: "entree_view", path: "/stock/entree" },
  { permission: "parking_view", path: "/stock/parking" },
  { permission: "sortie_view", path: "/stock/sortie" },
  { permission: "rapport_charge_view", path: "/stock/rapport-charge" },
];

function hasStockAccess(profile: ProfileRow | null, permission: string) {
  if (!profile) return false;
  const role = String(profile.role ?? "").toLowerCase();
  if (role === "superuser" || role === "admin") return true;
  const access = Array.isArray(profile.stock_access) ? profile.stock_access : [];
  return access.includes(permission);
}

function getFirstAllowedStockPath(profile: ProfileRow | null) {
  const firstAllowed = STOCK_PATHS.find((item) => hasStockAccess(profile, item.permission));
  return firstAllowed?.path ?? "/modules";
}

function getVisibleModules(profile: ProfileRow | null) {
  if (!profile) return [];
  const role = String(profile.role ?? "").toLowerCase();
  if (role === "superuser") return MODULES;
  const access = Array.isArray(profile.module_access) ? profile.module_access : [];
  return MODULES.filter((module) => {
    if (module.key === "settings") return false;
    return access.includes(module.key);
  });
}

function ModuleIcon({ module, muted }: { module: ModuleCard; muted: boolean }) {
  return (
    <Box
      sx={{
        width: 62,
        height: 62,
        borderRadius: 3,
        display: "grid",
        placeItems: "center",
        fontWeight: 950,
        fontSize: 18,
        letterSpacing: 0.3,
        color: muted ? "text.secondary" : "white",
        bgcolor: muted ? "action.hover" : "primary.main",
        boxShadow: muted ? "none" : "0 14px 28px rgba(37, 99, 235, 0.24)",
      }}
    >
      {module.shortName}
    </Box>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 3,
        bgcolor: "rgba(255,255,255,0.14)",
        border: "1px solid rgba(255,255,255,0.18)",
        color: "white",
        minWidth: 130,
      }}
    >
      <Typography variant="h5" sx={{ fontWeight: 950, lineHeight: 1.1 }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.78 }}>
        {label}
      </Typography>
    </Paper>
  );
}

export default function ModulesPage() {
  const navigate = useNavigate();
  const [message, setMessage] = React.useState("");
  const [profile, setProfile] = React.useState<ProfileRow | null>(null);
  const [loadingProfile, setLoadingProfile] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const session = await getSession();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!mounted) return;
        if (!user) {
          setProfile(null);
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("role, module_access, stock_access")
          .eq("id", user.id)
          .maybeSingle();
        if (error) throw new Error(error.message);
        setProfile({
          role: String(data?.role ?? session?.role ?? "user"),
          module_access: Array.isArray(data?.module_access) ? data.module_access : [],
          stock_access: Array.isArray(data?.stock_access) ? data.stock_access : [],
        });
      } catch {
        setProfile(null);
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    };
    void loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleModules = React.useMemo(() => getVisibleModules(profile), [profile]);
  const availableModules = React.useMemo(() => visibleModules.filter((m) => m.available), [visibleModules]);
  const comingSoonModules = React.useMemo(() => visibleModules.filter((m) => !m.available), [visibleModules]);
  const role = String(profile?.role ?? "user");

  const openModule = (module: ModuleCard) => {
    setMessage("");
    if (!module.available || !module.path) {
      setMessage(`${module.title} sera disponible dans une prochaine étape.`);
      return;
    }
    if (module.key === "stock") {
      navigate(getFirstAllowedStockPath(profile));
      return;
    }
    navigate(module.path);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#eef4fb",
        background:
          "radial-gradient(circle at top left, rgba(14,165,233,0.20), transparent 32%), radial-gradient(circle at top right, rgba(37,99,235,0.18), transparent 30%), #eef4fb",
      }}
    >
      <AppHeader
        title="KATASAB Fish Portal"
        subtitle="Administration centrale"
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={role} size="small" variant="outlined" sx={{ fontWeight: 800 }} />
          </Stack>
        }
      />
      <Box
        component="main"
        sx={{
          flex: 1,
          width: "100%",
          maxWidth: 1520,
          mx: "auto",
          px: { xs: 1.5, md: 3 },
          py: { xs: 2, md: 3 },
        }}
      >
        <Stack spacing={2.5}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.4, md: 3.5 },
              borderRadius: 4,
              color: "white",
              overflow: "hidden",
              position: "relative",
              background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #0ea5e9 100%)",
              boxShadow: "0 20px 50px rgba(15, 23, 42, 0.16)",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                width: 280,
                height: 280,
                borderRadius: "50%",
                bgcolor: "rgba(255,255,255,0.10)",
                right: -90,
                top: -100,
              }}
            />
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={2.5}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", lg: "center" }}
              sx={{ position: "relative" }}
            >
              <Box sx={{ maxWidth: 760 }}>
                <Chip
                  label="Lite V2 Workspace"
                  size="small"
                  sx={{ bgcolor: "rgba(255,255,255,0.14)", color: "white", fontWeight: 850, mb: 1.4 }}
                />
                <Typography
                  variant="h3"
                  sx={{ fontWeight: 950, fontSize: { xs: "2rem", md: "2.9rem" }, lineHeight: 1.05 }}
                >
                  Sélectionnez un espace
                </Typography>
                <Typography variant="body1" sx={{ mt: 1.4, opacity: 0.82, lineHeight: 1.7 }}>
                  Accédez aux services disponibles selon le rôle et les permissions de l'utilisateur.
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} flexWrap="wrap">
                <StatBox label="Modules visibles" value={loadingProfile ? "—" : visibleModules.length} />
                <StatBox label="Disponibles" value={loadingProfile ? "—" : availableModules.length} />
                <StatBox label="Bientôt" value={loadingProfile ? "—" : comingSoonModules.length} />
              </Stack>
            </Stack>
          </Paper>

          {message ? (
            <Alert severity="info" onClose={() => setMessage("")} sx={{ borderRadius: 3 }}>
              {message}
            </Alert>
          ) : null}

          {loadingProfile ? (
            <Paper
              elevation={0}
              sx={{
                minHeight: 300,
                borderRadius: 4,
                display: "grid",
                placeItems: "center",
                bgcolor: "rgba(255,255,255,0.78)",
                border: "1px solid rgba(15, 23, 42, 0.08)",
              }}
            >
              <Stack spacing={2} alignItems="center">
                <CircularProgress />
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Chargement des modules...
                </Typography>
              </Stack>
            </Paper>
          ) : visibleModules.length === 0 ? (
            <Alert severity="warning" sx={{ borderRadius: 3 }}>
              Aucun module n'est disponible pour cet utilisateur.
            </Alert>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
                gap: 2,
              }}
            >
              {visibleModules.map((module) => {
                const muted = !module.available;
                return (
                  <Paper
                    key={module.key}
                    elevation={0}
                    onClick={() => openModule(module)}
                    sx={{
                      position: "relative",
                      overflow: "hidden",
                      minHeight: 248,
                      p: 2.4,
                      borderRadius: 4,
                      border: "1px solid rgba(15, 23, 42, 0.08)",
                      cursor: module.available ? "pointer" : "not-allowed",
                      bgcolor: muted ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.86)",
                      boxShadow: muted ? "none" : "0 16px 38px rgba(15, 23, 42, 0.08)",
                      transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
                      opacity: muted ? 0.76 : 1,
                      "&:hover": {
                        transform: module.available ? "translateY(-4px)" : "none",
                        boxShadow: module.available ? "0 22px 54px rgba(15, 23, 42, 0.13)" : "none",
                        borderColor: module.available ? "primary.main" : "rgba(15, 23, 42, 0.08)",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        position: "absolute",
                        width: 170,
                        height: 170,
                        borderRadius: "50%",
                        right: -64,
                        top: -74,
                        bgcolor: module.available ? "rgba(37,99,235,0.10)" : "rgba(100,116,139,0.08)",
                      }}
                    />
                    <Stack sx={{ height: "100%", position: "relative" }} justifyContent="space-between" spacing={2.5}>
                      <Box>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                          <ModuleIcon module={module} muted={muted} />
                          <Stack spacing={0.7} alignItems="flex-end">
                            <Chip
                              size="small"
                              color={module.available ? "success" : "default"}
                              label={module.available ? "Disponible" : "Bientôt"}
                              sx={{ fontWeight: 800 }}
                            />
                            <Chip size="small" variant="outlined" label={module.category} />
                          </Stack>
                        </Stack>
                        <Typography variant="h5" sx={{ mt: 2.6, fontWeight: 950, letterSpacing: -0.2 }}>
                          {module.title}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1.1, color: "text.secondary", lineHeight: 1.65 }}>
                          {module.description}
                        </Typography>
                      </Box>
                      <Box>
                        <Divider sx={{ mb: 1.5 }} />
                        <Button
                          variant={module.available ? "contained" : "outlined"}
                          disabled={!module.available}
                          fullWidth
                          sx={{ borderRadius: 2.5, py: 1, fontWeight: 900 }}
                          onClick={(event) => {
                            event.stopPropagation();
                            openModule(module);
                          }}
                        >
                          {module.available ? "Ouvrir le module" : "Bientôt disponible"}
                        </Button>
                      </Box>
                    </Stack>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Stack>
      </Box>
      <AppFooter />
    </Box>
  );
}

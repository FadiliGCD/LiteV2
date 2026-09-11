import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AppFooter from "../components/AppFooter";
import AppHeader from "../components/AppHeader";
import { getSession } from "../auth/auth";
import { supabase } from "../lib/supabaseClient";

type ModuleKey =
  | "reception"
  | "production"
  | "stock"
  | "accounting"
  | "hr"
  | "settings";

type ModuleCard = {
  key: ModuleKey;
  title: string;
  description: string;
  shortName: string;
  path?: string;
  available: boolean;
};

type ProfileRow = {
  role: string | null;
  module_access: string[] | null;
};

const MODULES: ModuleCard[] = [
  {
    key: "reception",
    title: "Réception",
    description:
      "Gestion de la réception des marchandises, fournisseurs et contrôles d'arrivée.",
    shortName: "RC",
    available: false,
  },
  {
    key: "production",
    title: "Production",
    description:
      "Suivi des opérations de production, transformation et rendement.",
    shortName: "PR",
    available: false,
  },
  {
    key: "stock",
    title: "Gestion de stock",
    description:
      "Gestion des entrées, réservations, sorties et rapports de charge.",
    shortName: "GS",
    path: "/stock",
    available: true,
  },
  {
    key: "accounting",
    title: "Comptabilité",
    description:
      "Gestion financière, règlements, facturation et suivi comptable.",
    shortName: "CP",
    available: false,
  },
  {
    key: "hr",
    title: "HR",
    description:
      "Gestion des employés, présences, pointage, horaires et ressources humaines.",
    shortName: "HR",
    path: "/hr",
    available: true,
  },
  {
    key: "settings",
    title: "Paramètres",
    description:
      "Centre de sécurité superuser ",
    shortName: "ST",
    path: "/settings",
    available: true,
  },
];

function getVisibleModules(profile: ProfileRow | null) {
  if (!profile) return [];

  const role = String(profile.role ?? "").toLowerCase();

  if (role === "superuser") {
    return MODULES;
  }

  const access = Array.isArray(profile.module_access)
    ? profile.module_access
    : [];

  return MODULES.filter((module) => {
    if (module.key === "settings") return false;

    return access.includes(module.key);
  });
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
          .select("role, module_access")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw new Error(error.message);

        setProfile({
          role: String(data?.role ?? session?.role ?? "user"),
          module_access: Array.isArray(data?.module_access)
            ? data.module_access
            : [],
        });
      } catch {
        setProfile(null);
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const visibleModules = React.useMemo(() => {
    return getVisibleModules(profile);
  }, [profile]);

  const openModule = (module: ModuleCard) => {
    setMessage("");

    if (!module.available || !module.path) {
      setMessage(`${module.title} sera disponible dans une prochaine étape.`);
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
        bgcolor: "#f4f7fb",
        background:
          "radial-gradient(circle at top left, rgba(31,111,235,0.14), transparent 35%), #f4f7fb",
      }}
    >
      <AppHeader
        title="KATASAB Fish Portal"
        subtitle="Administration centrale"
      />

      <Box
        component="main"
        sx={{
          flex: 1,
          width: "100%",
          maxWidth: 1500,
          mx: "auto",
          px: { xs: 2, md: 4 },
          py: { xs: 4, md: 7 },
        }}
      >
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 900,
              fontSize: { xs: "2rem", md: "2.8rem" },
            }}
          >
            Sélectionnez un espace
          </Typography>

          <Typography
            variant="body1"
            sx={{
              color: "text.secondary",
              maxWidth: 760,
              lineHeight: 1.7,
            }}
          >
            Accédez aux différents services de l'entreprise. Les modules
            disponibles dépendent du rôle et des permissions de chaque
            utilisateur.
          </Typography>
        </Stack>

        {message ? (
          <Alert severity="info" onClose={() => setMessage("")} sx={{ mb: 3 }}>
            {message}
          </Alert>
        ) : null}

        {loadingProfile ? (
          <Paper
            variant="outlined"
            sx={{
              minHeight: 260,
              borderRadius: 4,
              display: "grid",
              placeItems: "center",
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
          <Alert severity="warning">
            Aucun module n'est disponible pour cet utilisateur.
          </Alert>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(3, minmax(0, 1fr))",
              },
              gap: 3,
            }}
          >
            {visibleModules.map((module) => (
              <Paper
                key={module.key}
                elevation={0}
                onClick={() => openModule(module)}
                sx={{
                  position: "relative",
                  overflow: "hidden",
                  minHeight: 240,
                  p: 3,
                  borderRadius: 4,
                  border: "1px solid",
                  borderColor: module.available ? "primary.light" : "divider",
                  cursor: "pointer",
                  bgcolor: "background.paper",
                  transition:
                    "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
                  "&:hover": {
                    transform: "translateY(-5px)",
                    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.12)",
                    borderColor: module.available
                      ? "primary.main"
                      : "text.disabled",
                  },
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    width: 150,
                    height: 150,
                    borderRadius: "50%",
                    right: -60,
                    top: -60,
                    bgcolor: module.available
                      ? "rgba(25,118,210,0.10)"
                      : "rgba(100,116,139,0.08)",
                  }}
                />

                <Stack
                  sx={{ height: "100%", position: "relative" }}
                  justifyContent="space-between"
                  spacing={3}
                >
                  <Box>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      spacing={2}
                    >
                      <Box
                        sx={{
                          width: 58,
                          height: 58,
                          borderRadius: 3,
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 900,
                          fontSize: 18,
                          color: module.available
                            ? "primary.contrastText"
                            : "text.secondary",
                          bgcolor: module.available
                            ? "primary.main"
                            : "action.hover",
                        }}
                      >
                        {module.shortName}
                      </Box>

                      <Chip
                        size="small"
                        color={module.available ? "success" : "default"}
                        label={module.available ? "Disponible" : "Bientôt"}
                      />
                    </Stack>

                    <Typography variant="h5" sx={{ mt: 3, fontWeight: 900 }}>
                      {module.title}
                    </Typography>

                    <Typography
                      variant="body2"
                      sx={{
                        mt: 1.2,
                        color: "text.secondary",
                        lineHeight: 1.7,
                      }}
                    >
                      {module.description}
                    </Typography>
                  </Box>

                  <Button
                    variant={module.available ? "contained" : "outlined"}
                    disabled={!module.available}
                    fullWidth
                    onClick={(event) => {
                      event.stopPropagation();
                      openModule(module);
                    }}
                  >
                    {module.available
                      ? "Ouvrir le module"
                      : "Bientôt disponible"}
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Box>
        )}
      </Box>

      <AppFooter />
    </Box>
  );
}
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
import { supabase } from "../lib/supabaseClient";

type HrAccessKey =
  | "pointage"
  | "employees"
  | "contracts"
  | "planning"
  | "payroll";

type HrSubModule = {
  key: HrAccessKey;
  title: string;
  description: string;
  shortName: string;
  path?: string;
  available: boolean;
};

type ProfileRow = {
  role: string | null;
  hr_access: string[] | null;
  can_manage_hr: boolean | null;
};

const HR_MODULES: HrSubModule[] = [
  {
    key: "pointage",
    title: "Pointage",
    description:
      "Journal de pointage des employés : entrées, sorties, pauses et heures.",
    shortName: "PT",
    path: "/hr/pointage",
    available: true,
  },
  {
    key: "employees",
    title: "Dossiers employés",
    description:
      "Gestion des informations employés, documents, postes et départements.",
    shortName: "EM",
    available: false,
  },
  {
    key: "contracts",
    title: "Contrats",
    description:
      "Suivi des contrats, documents RH et informations administratives.",
    shortName: "CT",
    available: false,
  },
  {
    key: "planning",
    title: "Planning",
    description:
      "Gestion des horaires, équipes, absences et organisation du travail.",
    shortName: "PL",
    available: false,
  },
  {
    key: "payroll",
    title: "Paie",
    description:
      "Préparation des heures, calculs RH et exports pour la paie.",
    shortName: "PY",
    available: false,
  },
];

function getVisibleHrModules(profile: ProfileRow | null) {
  if (!profile) return [];

  const role = String(profile.role ?? "").toLowerCase();

  if (role === "superuser" || profile.can_manage_hr === true) {
    return HR_MODULES;
  }

  const access = Array.isArray(profile.hr_access) ? profile.hr_access : [];

  return HR_MODULES.filter((module) => access.includes(module.key));
}

export default function HrPage() {
  const navigate = useNavigate();

  const [profile, setProfile] = React.useState<ProfileRow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      setLoading(true);

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
          .select("role, hr_access, can_manage_hr")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw new Error(error.message);

        if (mounted) {
          setProfile((data ?? null) as ProfileRow | null);
        }
      } catch {
        if (mounted) setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const visibleModules = React.useMemo(() => {
    return getVisibleHrModules(profile);
  }, [profile]);

  const openModule = (module: HrSubModule) => {
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
          "radial-gradient(circle at top left, rgba(124,58,237,0.12), transparent 35%), #f4f7fb",
      }}
    >
      <Paper
        square
        elevation={0}
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Box
          sx={{
            maxWidth: 1500,
            mx: "auto",
            px: { xs: 2, md: 4 },
            py: 1.5,
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            spacing={2}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                component="img"
                src="/logo.png"
                alt="Lite V2"
                sx={{
                  height: 44,
                  width: "auto",
                  objectFit: "contain",
                }}
              />

              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  HR Module
                </Typography>

                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Ressources humaines
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                variant="outlined"
                label={
                  String(profile?.role ?? "").toLowerCase() === "superuser" ||
                  profile?.can_manage_hr
                    ? "Accès HR complet"
                    : "Accès HR limité"
                }
              />

              <Button variant="outlined" onClick={() => navigate("/modules")}>
                Modules
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>

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
              fontWeight: 800,
              fontSize: { xs: "2rem", md: "2.8rem" },
            }}
          >
            Ressources humaines
          </Typography>

          <Typography
            variant="body1"
            sx={{
              color: "text.secondary",
              maxWidth: 780,
            }}
          >
            Sélectionnez un sous-module RH. L'accès dépend du rôle et des
            permissions de l'utilisateur.
          </Typography>
        </Stack>

        {message ? (
          <Alert severity="info" onClose={() => setMessage("")} sx={{ mb: 3 }}>
            {message}
          </Alert>
        ) : null}

        {loading ? (
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
                Chargement des accès HR...
              </Typography>
            </Stack>
          </Paper>
        ) : visibleModules.length === 0 ? (
          <Alert severity="warning">
            Aucun sous-module HR n'est disponible pour cet utilisateur.
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
                      ? "rgba(124,58,237,0.10)"
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

                    <Typography variant="h5" sx={{ mt: 3, fontWeight: 800 }}>
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
                    {module.available ? "Ouvrir" : "Coming soon"}
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
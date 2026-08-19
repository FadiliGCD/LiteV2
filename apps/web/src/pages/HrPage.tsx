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
  | "main_doeuvre"
  | "pointage"
  | "reductions_remunerations"
  | "paie_declarations";

type HrSection = {
  key: HrAccessKey;
  title: string;
  shortName: string;
  description: string;
  path?: string;
  available: boolean;
  items: Array<{
    title: string;
    children?: string[];
  }>;
};

type ProfileRow = {
  role: string | null;
  hr_access: string[] | null;
  can_manage_hr: boolean | null;
};

const HR_SECTIONS: HrSection[] = [
  {
    key: "main_doeuvre",
    title: "Main D'œuvre",
    shortName: "MO",
    description:
      "Gestion des ouvriers, informations personnelles, salaire de base et contrats.",
    path: "/hr/main-doeuvre",
    available: true,
    items: [
      {
        title: "Suivi des ouvriers",
        children: [
          "Informations personnelles",
          "Salaire de base",
          "Suivi de contrat",
        ],
      },
      {
        title: "Ajouter un ouvrier",
      },
    ],
  },
  {
    key: "pointage",
    title: "Pointage Journalier",
    shortName: "PT",
    description:
      "Pointage journalier par service, rapport quotidien et suivi précis des heures.",
    path: "/hr/pointage",
    available: true,
    items: [
      { title: "Réception" },
      { title: "Traitement" },
      { title: "Nettoyage" },
      { title: "Emballage" },
      { title: "Autres" },
      { title: "Rapport journalier" },
      { title: "Suivi précis de pointage" },
    ],
  },
  {
    key: "reductions_remunerations",
    title: "Réductions et Rémunérations",
    shortName: "RR",
    description:
      "Gestion du transport, logement, avances, primes et tenue de travail.",
    available: false,
    items: [
      { title: "Transport" },
      { title: "Logement" },
      { title: "Avance" },
      { title: "Prime" },
      {
        title: "Tenue de travail",
        children: ["Réduction de tenue", "Retour de tenue"],
      },
    ],
  },
  {
    key: "paie_declarations",
    title: "Paie & Déclarations",
    shortName: "PD",
    description:
      "Fiches de paie, fiche CNSS, bulletin de paie et déclarations RH.",
    available: false,
    items: [
      { title: "Fiche de paie" },
      { title: "Fiche de CNSS" },
      { title: "Bulletin de paie" },
    ],
  },
];

function getVisibleHrSections(profile: ProfileRow | null) {
  if (!profile) return [];

  const role = String(profile.role ?? "").toLowerCase();

  if (role === "superuser" || profile.can_manage_hr === true) {
    return HR_SECTIONS;
  }

  const access = Array.isArray(profile.hr_access) ? profile.hr_access : [];

  return HR_SECTIONS.filter((section) => access.includes(section.key));
}

function HrStructureCard({
  section,
  onOpen,
}: {
  section: HrSection;
  onOpen: (section: HrSection) => void;
}) {
  return (
    <Paper
      elevation={0}
      onClick={() => onOpen(section)}
      sx={{
        position: "relative",
        overflow: "hidden",
        minHeight: 380,
        p: 3,
        borderRadius: 4,
        border: "1px solid",
        borderColor: section.available ? "primary.light" : "divider",
        cursor: "pointer",
        bgcolor: "background.paper",
        transition:
          "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
        "&:hover": {
          transform: "translateY(-5px)",
          boxShadow: "0 18px 45px rgba(15, 23, 42, 0.12)",
          borderColor: section.available ? "primary.main" : "text.disabled",
        },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          width: 180,
          height: 180,
          borderRadius: "50%",
          right: -70,
          top: -70,
          bgcolor: section.available
            ? "rgba(25,118,210,0.10)"
            : "rgba(100,116,139,0.08)",
        }}
      />

      <Stack sx={{ height: "100%", position: "relative" }} spacing={2.5}>
        <Stack direction="row" justifyContent="space-between" spacing={2}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              maxWidth: "100%",
              bgcolor: "#fff200",
              color: "#111827",
              px: 1.6,
              py: 0.8,
              borderRadius: 2,
              boxShadow: "inset 0 -2px 0 rgba(15,23,42,0.18)",
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 900,
                fontSize: { xs: 16, md: 18 },
              }}
            >
              {section.title}
            </Typography>
          </Box>

          <Chip
            size="small"
            color={section.available ? "success" : "default"}
            label={section.available ? "Disponible" : "Bientôt"}
          />
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 58,
              height: 58,
              borderRadius: 3,
              display: "grid",
              placeItems: "center",
              fontWeight: 900,
              fontSize: 18,
              color: section.available
                ? "primary.contrastText"
                : "text.secondary",
              bgcolor: section.available ? "primary.main" : "action.hover",
              flexShrink: 0,
            }}
          >
            {section.shortName}
          </Box>

          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              lineHeight: 1.7,
            }}
          >
            {section.description}
          </Typography>
        </Stack>

        <Stack spacing={1.1} sx={{ flex: 1 }}>
          {section.items.map((item) => (
            <Box key={item.title}>
              <Box
                sx={{
                  bgcolor: "#eef6dd",
                  border: "1px solid",
                  borderColor: "rgba(15,23,42,0.08)",
                  borderLeft: "4px solid",
                  borderLeftColor: section.available
                    ? "primary.main"
                    : "text.disabled",
                  borderRadius: 2,
                  px: 1.6,
                  py: 1,
                  fontWeight: 800,
                  color: "#111827",
                }}
              >
                {item.title}
              </Box>

              {item.children?.length ? (
                <Stack spacing={0.7} sx={{ mt: 0.8, ml: 2 }}>
                  {item.children.map((child) => (
                    <Box
                      key={child}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <Box
                        sx={{
                          width: 26,
                          height: 1.5,
                          bgcolor: "divider",
                        }}
                      />

                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          color: "text.secondary",
                        }}
                      >
                        {child}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : null}
            </Box>
          ))}
        </Stack>

        <Button
          variant={section.available ? "contained" : "outlined"}
          disabled={!section.available}
          fullWidth
          onClick={(event) => {
            event.stopPropagation();
            onOpen(section);
          }}
        >
          {section.available ? "Ouvrir" : "Coming soon"}
        </Button>
      </Stack>
    </Paper>
  );
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

  const visibleSections = React.useMemo(() => {
    return getVisibleHrSections(profile);
  }, [profile]);

  const openSection = (section: HrSection) => {
    setMessage("");

    if (!section.available || !section.path) {
      setMessage(`${section.title} sera disponible dans une prochaine étape.`);
      return;
    }

    navigate(section.path);
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
            La Structure Complète Du Module RH
          </Typography>

          <Typography
            variant="body1"
            sx={{
              color: "text.secondary",
              maxWidth: 850,
            }}
          >
            Sélectionnez une branche du module RH. Les accès affichés dépendent
            du rôle et des permissions de chaque utilisateur.
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
        ) : visibleSections.length === 0 ? (
          <Alert severity="warning">
            Aucun sous-module HR n'est disponible pour cet utilisateur.
          </Alert>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "repeat(2, minmax(0, 1fr))",
              },
              gap: 3,
            }}
          >
            {visibleSections.map((section) => (
              <HrStructureCard
                key={section.key}
                section={section}
                onOpen={openSection}
              />
            ))}
          </Box>
        )}
      </Box>

      <AppFooter />
    </Box>
  );
}
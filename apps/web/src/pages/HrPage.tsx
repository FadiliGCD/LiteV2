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
  items: Array<{ title: string; children?: string[] }>;
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
      { title: "Ajouter un ouvrier" },
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
  if (role === "superuser" || profile.can_manage_hr === true) return HR_SECTIONS;
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
        minHeight: 360,
        p: 2.5,
        borderRadius: 4,
        border: "1px solid rgba(15, 23, 42, 0.08)",
        cursor: "pointer",
        bgcolor: "rgba(255,255,255,0.9)",
        boxShadow: "0 18px 45px rgba(15, 23, 42, 0.07)",
        transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
        "&:hover": {
          transform: "translateY(-5px)",
          boxShadow: "0 22px 55px rgba(15, 23, 42, 0.13)",
          borderColor: section.available ? "primary.main" : "divider",
        },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          width: 190,
          height: 190,
          borderRadius: "50%",
          right: -70,
          top: -75,
          bgcolor: section.available ? "rgba(14,165,233,0.13)" : "rgba(100,116,139,0.08)",
        }}
      />
      <Stack sx={{ height: "100%", position: "relative" }} spacing={2.2}>
        <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
          <Box
            sx={{
              width: 62,
              height: 62,
              borderRadius: 3,
              display: "grid",
              placeItems: "center",
              fontWeight: 950,
              fontSize: 18,
              color: section.available ? "primary.contrastText" : "text.secondary",
              bgcolor: section.available ? "primary.main" : "action.hover",
              boxShadow: section.available ? "0 14px 26px rgba(29, 78, 216, 0.22)" : "none",
              flexShrink: 0,
            }}
          >
            {section.shortName}
          </Box>
          <Chip
            size="small"
            color={section.available ? "success" : "default"}
            label={section.available ? "Disponible" : "Bientôt"}
            sx={{ fontWeight: 800 }}
          />
        </Stack>

        <Box>
          <Typography variant="h5" sx={{ fontWeight: 950, letterSpacing: -0.4 }}>
            {section.title}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: "text.secondary", lineHeight: 1.7 }}>
            {section.description}
          </Typography>
        </Box>

        <Stack spacing={0.9} sx={{ flex: 1 }}>
          {section.items.map((item) => (
            <Box key={item.title}>
              <Box
                sx={{
                  bgcolor: section.available ? "rgba(29,78,216,0.06)" : "rgba(100,116,139,0.07)",
                  border: "1px solid rgba(15,23,42,0.08)",
                  borderLeft: "4px solid",
                  borderLeftColor: section.available ? "primary.main" : "text.disabled",
                  borderRadius: 2,
                  px: 1.4,
                  py: 0.85,
                  fontWeight: 900,
                  color: "text.primary",
                }}
              >
                {item.title}
              </Box>
              {item.children?.length ? (
                <Stack spacing={0.55} sx={{ mt: 0.65, ml: 2 }}>
                  {item.children.map((child) => (
                    <Stack key={child} direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 22, height: 1.5, bgcolor: "divider" }} />
                      <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary" }}>
                        {child}
                      </Typography>
                    </Stack>
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
          sx={{ borderRadius: 2.4, fontWeight: 900 }}
        >
          {section.available ? "Ouvrir" : "Bientôt disponible"}
        </Button>
      </Stack>
    </Paper>
  );
}

function SummaryCard({ title, value, description }: { title: string; value: string | number; description: string }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        bgcolor: "rgba(255,255,255,0.78)",
        border: "1px solid rgba(15,23,42,0.08)",
      }}
    >
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
        {title}
      </Typography>
      <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 950 }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.5 }}>
        {description}
      </Typography>
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
        if (mounted) setProfile((data ?? null) as ProfileRow | null);
      } catch {
        if (mounted) setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleSections = React.useMemo(() => getVisibleHrSections(profile), [profile]);
  const availableCount = visibleSections.filter((section) => section.available).length;
  const role = String(profile?.role ?? "user");

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
        bgcolor: "#eef4fb",
        background:
          "radial-gradient(circle at top left, rgba(14,165,233,0.20), transparent 34%), radial-gradient(circle at bottom right, rgba(29,78,216,0.16), transparent 34%), #eef4fb",
      }}
    >
      <AppHeader
        title="Module RH"
        subtitle="Ressources humaines"
        actions={
          <Button variant="outlined" onClick={() => navigate("/modules")}>
            Modules
          </Button>
        }
      />

      <Box
        component="main"
        sx={{
          flex: 1,
          width: "100%",
          maxWidth: 1500,
          mx: "auto",
          px: { xs: 1.5, md: 3 },
          py: { xs: 2, md: 3 },
        }}
      >
        <Stack spacing={2.5}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 4 },
              borderRadius: 5,
              color: "white",
              overflow: "hidden",
              position: "relative",
              background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #0ea5e9 100%)",
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.16)",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                width: 310,
                height: 310,
                borderRadius: "50%",
                right: -120,
                top: -130,
                bgcolor: "rgba(255,255,255,0.11)",
              }}
            />
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "flex-end" }}
              spacing={3}
              sx={{ position: "relative" }}
            >
              <Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
                  <Chip
                    size="small"
                    label="Human Resources"
                    sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "white", fontWeight: 900 }}
                  />
                  <Chip
                    size="small"
                    label={role}
                    sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "white", fontWeight: 900 }}
                  />
                </Stack>
                <Typography variant="h3" sx={{ fontWeight: 950, fontSize: { xs: "2rem", md: "2.8rem" }, lineHeight: 1.05 }}>
                  La Structure Complète Du Module RH
                </Typography>
                <Typography variant="body1" sx={{ mt: 1.4, maxWidth: 850, opacity: 0.84, lineHeight: 1.8 }}>
                  Sélectionnez une branche du module RH. Les accès affichés dépendent du rôle et des permissions de chaque utilisateur.
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ width: { xs: "100%", md: "auto" } }}>
                <SummaryCard title="Accès visibles" value={visibleSections.length} description="Branches RH autorisées." />
                <SummaryCard title="Disponibles" value={availableCount} description="Branches prêtes à utiliser." />
              </Stack>
            </Stack>
          </Paper>

          {message ? (
            <Alert severity="info" onClose={() => setMessage("")}>
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
                bgcolor: "rgba(255,255,255,0.78)",
              }}
            >
              <Stack spacing={2} alignItems="center">
                <CircularProgress />
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Chargement des accès RH...
                </Typography>
              </Stack>
            </Paper>
          ) : visibleSections.length === 0 ? (
            <Alert severity="warning">Aucun sous-module RH n'est disponible pour cet utilisateur.</Alert>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
                gap: 2.5,
              }}
            >
              {visibleSections.map((section) => (
                <HrStructureCard key={section.key} section={section} onOpen={openSection} />
              ))}
            </Box>
          )}
        </Stack>
      </Box>

      <AppFooter />
    </Box>
  );
}

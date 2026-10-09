import * as React from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type {
  GridColDef,
  GridRowId,
  GridRowSelectionModel,
} from "@mui/x-data-grid";
import AppFooter from "../components/AppFooter";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type WorkerRow = {
  id: string;
  employee_code: string;
  prenom: string;
  nom: string;
  full_name: string;
  genre: string;
  date_naissance: string;
  cin: string;
  contact: string;
  date_embauche: string;
  cnss: string;
  rib: string;
  minima: number | null;
  taux_horaire: number | null;
  quanza_fixe: number | null;
  contrat_debut: string;
  contrat_fin: string;
  is_active: boolean;
  created_at: string;
};

type ProfileRow = {
  role: string | null;
  can_manage_hr: boolean | null;
  can_manage_employees: boolean | null;
};

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(",", ".").trim());
  return Number.isFinite(number) ? number : null;
}

function formatFullName(prenom: string, nom: string, fallback: string) {
  const joined = `${prenom ?? ""} ${nom ?? ""}`.trim();
  return joined || fallback || "Ouvrier sans nom";
}

function normalizeDate(value: unknown) {
  if (!value) return "";
  const d = dayjs(String(value));
  return d.isValid() ? d.format("YYYY-MM-DD") : "";
}

function dbToUi(row: any): WorkerRow {
  return {
    id: String(row.id),
    employee_code: String(row.employee_code ?? ""),
    prenom: String(row.prenom ?? ""),
    nom: String(row.nom ?? ""),
    full_name: String(row.full_name ?? ""),
    genre: String(row.genre ?? ""),
    date_naissance: normalizeDate(row.date_naissance),
    cin: String(row.cin ?? ""),
    contact: String(row.contact ?? ""),
    date_embauche: normalizeDate(row.date_embauche),
    cnss: String(row.cnss ?? ""),
    rib: String(row.rib ?? ""),
    minima: row.minima ?? null,
    taux_horaire: row.taux_horaire ?? 15,
    quanza_fixe: row.quanza_fixe ?? null,
    contrat_debut: normalizeDate(row.contrat_debut),
    contrat_fin: normalizeDate(row.contrat_fin),
    is_active: row.is_active !== false,
    created_at: String(row.created_at ?? ""),
  };
}

function uiToDb(row: WorkerRow) {
  return {
    id: row.id,
    employee_code: row.employee_code || null,
    prenom: row.prenom || null,
    nom: row.nom || null,
    full_name: formatFullName(row.prenom, row.nom, row.full_name),
    genre: row.genre || null,
    date_naissance: row.date_naissance || null,
    cin: row.cin || null,
    contact: row.contact || null,
    date_embauche: row.date_embauche || null,
    cnss: row.cnss || null,
    rib: row.rib || null,
    minima: row.minima,
    taux_horaire: row.taux_horaire,
    quanza_fixe: row.quanza_fixe,
    contrat_debut: row.contrat_debut || null,
    contrat_fin: row.contrat_fin || null,
    is_active: row.is_active,
  };
}

function emptyDraft(): Omit<WorkerRow, "id" | "created_at"> {
  return {
    employee_code: "",
    prenom: "",
    nom: "",
    full_name: "",
    genre: "",
    date_naissance: "",
    cin: "",
    contact: "",
    date_embauche: dayjs().format("YYYY-MM-DD"),
    cnss: "",
    rib: "",
    minima: null,
    taux_horaire: 15,
    quanza_fixe: null,
    contrat_debut: "",
    contrat_fin: "",
    is_active: true,
  };
}

function restDays(contractEnd: string) {
  if (!contractEnd) return "";
  const end = dayjs(contractEnd);
  if (!end.isValid()) return "";
  return end.diff(dayjs(), "day");
}

function StatCard({ title, value, description, tone = "default" }: { title: string; value: string | number; description: string; tone?: "default" | "warning" | "success" }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        bgcolor: "rgba(255,255,255,0.84)",
        border: "1px solid rgba(15,23,42,0.08)",
        borderLeft: "5px solid",
        borderLeftColor: tone === "warning" ? "warning.main" : tone === "success" ? "success.main" : "primary.main",
      }}
    >
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>
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

export default function MainDoeuvrePage() {
  const [tab, setTab] = React.useState(0);
  const [profile, setProfile] = React.useState<ProfileRow | null>(null);
  const [rows, setRows] = React.useState<WorkerRow[]>([]);
  const [lastSavedRows, setLastSavedRows] = React.useState<WorkerRow[]>([]);
  const [selectedRowIds, setSelectedRowIds] = React.useState<GridRowSelectionModel>({
    type: "include",
    ids: new Set<GridRowId>(),
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [info, setInfo] = React.useState("");
  const [error, setError] = React.useState("");
  const [openAdd, setOpenAdd] = React.useState(false);
  const [draft, setDraft] = React.useState(() => emptyDraft());

  const canEdit =
    String(profile?.role ?? "").toLowerCase() === "superuser" ||
    profile?.can_manage_hr === true ||
    profile?.can_manage_employees === true;

  const selectedIdsArray = React.useMemo(
    () => Array.from(selectedRowIds.ids ?? []),
    [selectedRowIds]
  );

  const hasUnsavedChanges = React.useMemo(() => {
    return JSON.stringify(rows) !== JSON.stringify(lastSavedRows);
  }, [rows, lastSavedRows]);

  const contractWarningCount = React.useMemo(() => {
    return rows.filter((row) => {
      const days = restDays(row.contrat_fin);
      return typeof days === "number" && days >= 0 && days <= 30;
    }).length;
  }, [rows]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Session introuvable.");

      const [profileResult, workersResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("role, can_manage_hr, can_manage_employees")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("pointage_employees")
          .select(
            "id, full_name, employee_code, prenom, nom, genre, date_naissance, cin, contact, date_embauche, cnss, rib, minima, taux_horaire, quanza_fixe, contrat_debut, contrat_fin, is_active, created_at"
          )
          .eq("is_active", true)
          .order("employee_code", { ascending: true }),
      ]);

      if (profileResult.error) throw new Error(profileResult.error.message);
      if (workersResult.error) throw new Error(workersResult.error.message);

      const uiRows = (workersResult.data ?? []).map(dbToUi);
      setProfile((profileResult.data ?? null) as ProfileRow | null);
      setRows(uiRows);
      setLastSavedRows(uiRows);
      setSelectedRowIds({ type: "include", ids: new Set() } as any);
    } catch (loadError: any) {
      setError(loadError?.message ?? "Impossible de charger Main D'œuvre.");
      setRows([]);
      setLastSavedRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const baseColumns = React.useMemo<GridColDef<WorkerRow>[]>(
    () => [
      { field: "employee_code", headerName: "Matricule", width: 120, editable: canEdit },
      { field: "prenom", headerName: "Prénom", width: 170, editable: canEdit },
      { field: "nom", headerName: "Nom", width: 190, editable: canEdit },
    ],
    [canEdit]
  );

  const personalColumns = React.useMemo<GridColDef<WorkerRow>[]>(
    () => [
      ...baseColumns,
      { field: "genre", headerName: "Genre", width: 100, editable: canEdit, type: "singleSelect", valueOptions: ["M", "F"] },
      { field: "date_naissance", headerName: "Date de naissance", width: 160, editable: canEdit },
      { field: "cin", headerName: "CIN", width: 150, editable: canEdit },
      { field: "contact", headerName: "Contact", width: 150, editable: canEdit },
      { field: "date_embauche", headerName: "Date d'embauche", width: 160, editable: canEdit },
      { field: "cnss", headerName: "CNSS", width: 150, editable: canEdit },
      { field: "rib", headerName: "N° RIB", width: 280, editable: canEdit },
    ],
    [baseColumns, canEdit]
  );

  const salaryColumns = React.useMemo<GridColDef<WorkerRow>[]>(
    () => [
      ...baseColumns,
      { field: "minima", headerName: "Minima", width: 140, editable: canEdit, type: "number", valueParser: (value) => toNumberOrNull(value) },
      { field: "taux_horaire", headerName: "Taux horaire", width: 150, editable: canEdit, type: "number", valueParser: (value) => toNumberOrNull(value) },
      { field: "quanza_fixe", headerName: "Quanza fixe", width: 160, editable: canEdit, type: "number", valueParser: (value) => toNumberOrNull(value) },
    ],
    [baseColumns, canEdit]
  );

  const contractColumns = React.useMemo<GridColDef<WorkerRow>[]>(
    () => [
      ...baseColumns,
      { field: "date_embauche", headerName: "Date d'embauche", width: 160, editable: canEdit },
      { field: "contrat_debut", headerName: "Début", width: 150, editable: canEdit },
      { field: "contrat_fin", headerName: "Fin", width: 150, editable: canEdit },
      {
        field: "reste_jour",
        headerName: "Jours restants",
        width: 150,
        editable: false,
        renderCell: (params) => {
          const value = restDays(params.row.contrat_fin);
          return value === "" ? "" : `${value} jour(s)`;
        },
      },
    ],
    [baseColumns, canEdit]
  );

  const processRowUpdate = (newRow: WorkerRow) => {
    const cleaned: WorkerRow = {
      ...newRow,
      full_name: formatFullName(newRow.prenom, newRow.nom, newRow.full_name),
      date_naissance: normalizeDate(newRow.date_naissance),
      date_embauche: normalizeDate(newRow.date_embauche),
      contrat_debut: normalizeDate(newRow.contrat_debut),
      contrat_fin: normalizeDate(newRow.contrat_fin),
      minima: toNumberOrNull(newRow.minima),
      taux_horaire: toNumberOrNull(newRow.taux_horaire),
      quanza_fixe: toNumberOrNull(newRow.quanza_fixe),
    };
    setRows((prev) => prev.map((row) => (row.id === cleaned.id ? cleaned : row)));
    return cleaned;
  };

  const saveChanges = async () => {
    if (!canEdit) return;
    setSaving(true);
    setInfo("");
    setError("");
    try {
      const payload = rows.map(uiToDb);
      const { error: upsertError } = await supabase
        .from("pointage_employees")
        .upsert(payload, { onConflict: "id" });

      if (upsertError) throw new Error(upsertError.message);
      await loadData();
      setInfo("Main D'œuvre sauvegardé.");
    } catch (saveError: any) {
      setError(saveError?.message ?? "Impossible de sauvegarder.");
    } finally {
      setSaving(false);
    }
  };

  const cancelChanges = () => {
    setRows(lastSavedRows);
    setInfo("Modifications annulées.");
    setError("");
  };

  const addWorker = async () => {
    if (!canEdit) return;
    setInfo("");
    setError("");

    if (!draft.employee_code.trim()) {
      setError("Matricule obligatoire.");
      return;
    }

    if (!draft.prenom.trim() || !draft.nom.trim()) {
      setError("Prénom et nom sont obligatoires.");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        ...draft,
        full_name: formatFullName(draft.prenom, draft.nom, draft.full_name),
        employee_code: draft.employee_code.trim(),
        prenom: draft.prenom.trim(),
        nom: draft.nom.trim(),
        created_by: user?.id ?? null,
      };

      const { error: insertError } = await supabase
        .from("pointage_employees")
        .insert(payload);

      if (insertError) throw new Error(insertError.message);

      setDraft(emptyDraft());
      setOpenAdd(false);
      await loadData();
      setInfo("Ouvrier ajouté.");
    } catch (addError: any) {
      setError(addError?.message ?? "Impossible d'ajouter l'ouvrier.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedWorkers = async () => {
    if (!canEdit) return;
    if (!selectedIdsArray.length) {
      setError("Sélectionnez au moins un ouvrier.");
      return;
    }

    const confirmed = window.confirm(`Supprimer ${selectedIdsArray.length} ouvrier(s) de la liste active ?`);
    if (!confirmed) return;

    setSaving(true);
    setInfo("");
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("pointage_employees")
        .update({ is_active: false })
        .in("id", selectedIdsArray.map(String));

      if (updateError) throw new Error(updateError.message);
      await loadData();
      setInfo("Ouvrier(s) supprimé(s) de la liste active.");
    } catch (deleteError: any) {
      setError(deleteError?.message ?? "Impossible de supprimer.");
    } finally {
      setSaving(false);
    }
  };

  const tableTitle =
    tab === 0
      ? "Informations personnelles"
      : tab === 1
      ? "Salaire de base"
      : "Suivi de contrat";

  const currentColumns = tab === 0 ? personalColumns : tab === 1 ? salaryColumns : contractColumns;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#eef4fb",
        background:
          "radial-gradient(circle at top left, rgba(14,165,233,0.18), transparent 34%), radial-gradient(circle at bottom right, rgba(29,78,216,0.14), transparent 32%), #eef4fb",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AppHeader
        title="Main D'œuvre"
        subtitle="Informations personnelles, salaire et contrats"
        actions={
          <>
            <Button component={Link} to="/hr" variant="outlined">
              HR
            </Button>
            <Button component={Link} to="/modules" variant="outlined">
              Modules
            </Button>
          </>
        }
      />

      <Box
        component="main"
        sx={{
          flex: 1,
          width: "100%",
          maxWidth: 1550,
          mx: "auto",
          px: { xs: 1.5, md: 3 },
          py: { xs: 2, md: 3 },
        }}
      >
        <Stack spacing={2.5}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 3 },
              borderRadius: 5,
              color: "white",
              background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #0ea5e9 100%)",
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.14)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <Box sx={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", right: -90, top: -100, bgcolor: "rgba(255,255,255,0.10)" }} />
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "flex-end" }}
              spacing={2}
              sx={{ position: "relative" }}
            >
              <Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
                  <Chip size="small" label="HR" sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "white", fontWeight: 900 }} />
                  <Chip
                    size="small"
                    label={canEdit ? "Modification autorisée" : "Lecture seule"}
                    sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "white", fontWeight: 900 }}
                  />
                  {saving ? <Chip size="small" label="Sauvegarde..." sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "white", fontWeight: 900 }} /> : null}
                </Stack>
                <Typography variant="h3" sx={{ fontWeight: 950, fontSize: { xs: "2rem", md: "2.65rem" }, lineHeight: 1.08 }}>
                  Suivi des ouvriers
                </Typography>
                <Typography variant="body1" sx={{ mt: 1.3, maxWidth: 820, opacity: 0.84, lineHeight: 1.8 }}>
                  Les données ajoutées ici alimentent les pages Informations personnelles, Salaire de base, Suivi de contrat et Pointage.
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
                  gap: 1.2,
                  width: { xs: "100%", md: 560 },
                }}
              >
                <StatCard title="Ouvriers actifs" value={rows.length} description="Liste active." tone="success" />
                <StatCard title="Sélectionnés" value={selectedIdsArray.length} description="Lignes cochées." />
                <StatCard title="Contrats ≤ 30j" value={contractWarningCount} description="À surveiller." tone="warning" />
              </Box>
            </Stack>
          </Paper>

          {error ? <Alert severity="warning">{error}</Alert> : null}
          {info ? <Alert severity="success">{info}</Alert> : null}

          <Paper
            elevation={0}
            sx={{
              borderRadius: 4,
              overflow: "hidden",
              bgcolor: "rgba(255,255,255,0.86)",
              border: "1px solid rgba(15,23,42,0.08)",
              boxShadow: "0 18px 45px rgba(15, 23, 42, 0.07)",
            }}
          >
            <Box sx={{ px: 2, pt: 2 }}>
              <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
                <Tab label="Informations personnelles" />
                <Tab label="Salaire de base" />
                <Tab label="Suivi de contrat" />
                <Tab label="Ajouter un ouvrier" />
              </Tabs>
            </Box>

            <Divider />

            {tab === 3 ? (
              <Box sx={{ p: 3 }}>
                <Stack spacing={2}>
                  <Typography variant="h6" sx={{ fontWeight: 950 }}>
                    Ajouter un ouvrier
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7 }}>
                    Ajoutez les détails de l'ouvrier une seule fois. Il apparaîtra ensuite dans les autres pages Main D'œuvre et dans Pointage.
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={() => setOpenAdd(true)}
                    disabled={!canEdit}
                    sx={{ width: { xs: "100%", sm: 240 }, borderRadius: 2.4, fontWeight: 900 }}
                  >
                    Ajouter un ouvrier
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Box sx={{ p: 2 }}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                  spacing={1.5}
                  sx={{ mb: 1.5 }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 950 }}>
                      {tableTitle}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      Tableau RH intégré dans Lite V2 avec recherche rapide.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip variant="outlined" label={`${rows.length} ouvrier(s)`} />
                    {hasUnsavedChanges ? <Chip color="warning" label="Non sauvegardé" /> : <Chip color="success" label="Sauvegardé" />}
                    <Button variant="outlined" onClick={loadData} disabled={loading}>
                      Actualiser
                    </Button>
                    <Button variant="outlined" color="error" onClick={deleteSelectedWorkers} disabled={!canEdit || !selectedIdsArray.length}>
                      Supprimer
                    </Button>
                    <Button variant="text" onClick={cancelChanges} disabled={!canEdit || !hasUnsavedChanges}>
                      Annuler
                    </Button>
                    <Button variant="contained" onClick={saveChanges} disabled={!canEdit || !hasUnsavedChanges || saving}>
                      Sauvegarder
                    </Button>
                  </Stack>
                </Stack>

                <Box sx={{ height: 650, width: "100%" }}>
                  {loading ? (
                    <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
                      <CircularProgress />
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Chargement de Main D'œuvre...
                      </Typography>
                    </Stack>
                  ) : (
                    <DataGrid
                      rows={rows}
                      columns={currentColumns}
                      getRowId={(row) => row.id}
                      initialState={{ density: "compact" }}
                      editMode="cell"
                      checkboxSelection
                      disableRowSelectionOnClick
                      rowSelectionModel={selectedRowIds}
                      onRowSelectionModelChange={(model) => setSelectedRowIds(model as any)}
                      slots={{ toolbar: GridToolbar }}
                      slotProps={{ toolbar: { showQuickFilter: true } as any }}
                      processRowUpdate={processRowUpdate}
                      onProcessRowUpdateError={(err) => setError(err instanceof Error ? err.message : "Modification impossible.")}
                      isCellEditable={() => canEdit}
                      sx={{
                        border: "none",
                        "& .MuiDataGrid-columnHeaders": { bgcolor: "rgba(15,23,42,0.04)" },
                        "& .MuiDataGrid-row:hover": { bgcolor: "rgba(29,78,216,0.04)" },
                      }}
                    />
                  )}
                </Box>
              </Box>
            )}
          </Paper>
        </Stack>
      </Box>

      <AppFooter />

      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="md" fullWidth>
        <DialogTitle>Ajouter un ouvrier</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Matricule"
                value={draft.employee_code}
                onChange={(e) => setDraft((p) => ({ ...p, employee_code: e.target.value }))}
                fullWidth
                required
              />
              <TextField
                label="Prénom"
                value={draft.prenom}
                onChange={(e) => setDraft((p) => ({ ...p, prenom: e.target.value }))}
                fullWidth
                required
              />
              <TextField
                label="Nom"
                value={draft.nom}
                onChange={(e) => setDraft((p) => ({ ...p, nom: e.target.value }))}
                fullWidth
                required
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                select
                label="Genre"
                value={draft.genre}
                onChange={(e) => setDraft((p) => ({ ...p, genre: e.target.value }))}
                fullWidth
              >
                <MenuItem value="">(vide)</MenuItem>
                <MenuItem value="M">M</MenuItem>
                <MenuItem value="F">F</MenuItem>
              </TextField>
              <TextField
                label="Date de naissance"
                type="date"
                value={draft.date_naissance}
                onChange={(e) => setDraft((p) => ({ ...p, date_naissance: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="CIN"
                value={draft.cin}
                onChange={(e) => setDraft((p) => ({ ...p, cin: e.target.value }))}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Contact"
                value={draft.contact}
                onChange={(e) => setDraft((p) => ({ ...p, contact: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Date d'embauche"
                type="date"
                value={draft.date_embauche}
                onChange={(e) => setDraft((p) => ({ ...p, date_embauche: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="CNSS"
                value={draft.cnss}
                onChange={(e) => setDraft((p) => ({ ...p, cnss: e.target.value }))}
                fullWidth
              />
            </Stack>

            <TextField
              label="N° RIB"
              value={draft.rib}
              onChange={(e) => setDraft((p) => ({ ...p, rib: e.target.value }))}
              fullWidth
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Minima"
                value={draft.minima ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, minima: toNumberOrNull(e.target.value) }))}
                fullWidth
              />
              <TextField
                label="Taux horaire"
                value={draft.taux_horaire ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, taux_horaire: toNumberOrNull(e.target.value) }))}
                fullWidth
              />
              <TextField
                label="Quanza fixe"
                value={draft.quanza_fixe ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, quanza_fixe: toNumberOrNull(e.target.value) }))}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Début du contrat"
                type="date"
                value={draft.contrat_debut}
                onChange={(e) => setDraft((p) => ({ ...p, contrat_debut: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Fin du contrat"
                type="date"
                value={draft.contrat_fin}
                onChange={(e) => setDraft((p) => ({ ...p, contrat_fin: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAdd(false)}>Annuler</Button>
          <Button variant="contained" onClick={addWorker} disabled={saving}>
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

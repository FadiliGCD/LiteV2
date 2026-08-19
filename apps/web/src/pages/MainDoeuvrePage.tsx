import * as React from "react";
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

export default function MainDoeuvrePage() {
  const [tab, setTab] = React.useState(0);

  const [profile, setProfile] = React.useState<ProfileRow | null>(null);
  const [rows, setRows] = React.useState<WorkerRow[]>([]);
  const [lastSavedRows, setLastSavedRows] = React.useState<WorkerRow[]>([]);

  const [selectedRowIds, setSelectedRowIds] =
    React.useState<GridRowSelectionModel>({
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

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError("");
    setInfo("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Session not found.");

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
      setError(loadError?.message ?? "Failed to load Main D'œuvre.");
      setRows([]);
      setLastSavedRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const baseColumns = React.useMemo<GridColDef<WorkerRow>[]>(
    () => [
      {
        field: "employee_code",
        headerName: "Matricule",
        width: 120,
        editable: canEdit,
      },
      {
        field: "prenom",
        headerName: "Prenom",
        width: 170,
        editable: canEdit,
      },
      {
        field: "nom",
        headerName: "Nom",
        width: 190,
        editable: canEdit,
      },
    ],
    [canEdit]
  );

  const personalColumns = React.useMemo<GridColDef<WorkerRow>[]>(
    () => [
      ...baseColumns,
      {
        field: "genre",
        headerName: "Genre",
        width: 100,
        editable: canEdit,
        type: "singleSelect",
        valueOptions: ["M", "F"],
      },
      {
        field: "date_naissance",
        headerName: "Date naissance",
        width: 150,
        editable: canEdit,
      },
      {
        field: "cin",
        headerName: "CIN",
        width: 150,
        editable: canEdit,
      },
      {
        field: "contact",
        headerName: "Contact",
        width: 150,
        editable: canEdit,
      },
      {
        field: "date_embauche",
        headerName: "Date d'embauche",
        width: 160,
        editable: canEdit,
      },
      {
        field: "cnss",
        headerName: "CNSS",
        width: 150,
        editable: canEdit,
      },
      {
        field: "rib",
        headerName: "N rib",
        width: 280,
        editable: canEdit,
      },
    ],
    [baseColumns, canEdit]
  );

  const salaryColumns = React.useMemo<GridColDef<WorkerRow>[]>(
    () => [
      ...baseColumns,
      {
        field: "minima",
        headerName: "Minima",
        width: 140,
        editable: canEdit,
        type: "number",
        valueParser: (value) => toNumberOrNull(value),
      },
      {
        field: "taux_horaire",
        headerName: "Taux Horaire",
        width: 150,
        editable: canEdit,
        type: "number",
        valueParser: (value) => toNumberOrNull(value),
      },
      {
        field: "quanza_fixe",
        headerName: "Quanza Fixe",
        width: 160,
        editable: canEdit,
        type: "number",
        valueParser: (value) => toNumberOrNull(value),
      },
    ],
    [baseColumns, canEdit]
  );

  const contractColumns = React.useMemo<GridColDef<WorkerRow>[]>(
    () => [
      ...baseColumns,
      {
        field: "date_embauche",
        headerName: "Date d'embauche",
        width: 160,
        editable: canEdit,
      },
      {
        field: "contrat_debut",
        headerName: "Début",
        width: 150,
        editable: canEdit,
      },
      {
        field: "contrat_fin",
        headerName: "Fin",
        width: 150,
        editable: canEdit,
      },
      {
        field: "reste_jour",
        headerName: "Reste Jour",
        width: 140,
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
      setError(saveError?.message ?? "Save failed.");
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
      setError("Prenom et Nom sont obligatoires.");
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
      setError(addError?.message ?? "Failed to add worker.");
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

    const confirmed = window.confirm(
      `Supprimer ${selectedIdsArray.length} ouvrier(s) de la liste active ?`
    );

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
      setError(deleteError?.message ?? "Delete failed.");
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

  const currentColumns =
    tab === 0 ? personalColumns : tab === 1 ? salaryColumns : contractColumns;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f4f7fb",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Paper
        square
        elevation={0}
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "rgba(255,255,255,0.95)",
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
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
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
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Main D'œuvre
                </Typography>

                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Informations personnelles, salaire et contrats
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" href="/hr">
                HR
              </Button>

              <Button variant="text" href="/modules">
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
          py: 4,
        }}
      >
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={2}
          >
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                Suivi des ouvriers
              </Typography>

              <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                Les données ajoutées ici alimentent les pages Informations
                personnelles, Salaire de base, Suivi de contrat et Pointage.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                color={canEdit ? "success" : "default"}
                label={canEdit ? "Modification autorisée" : "Lecture seule"}
              />

              {saving ? <Chip color="info" label="Sauvegarde..." /> : null}
            </Stack>
          </Stack>

          {error ? <Alert severity="warning">{error}</Alert> : null}
          {info ? <Alert severity="success">{info}</Alert> : null}

          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
            <Box
              sx={{
                px: 2,
                pt: 2,
                bgcolor: "background.paper",
              }}
            >
              <Tabs
                value={tab}
                onChange={(_, value) => setTab(value)}
                variant="scrollable"
                scrollButtons="auto"
              >
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
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Ajouter un ouvrier
                  </Typography>

                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Ajoutez les détails de l'ouvrier une seule fois. Il apparaîtra
                    ensuite dans les autres pages Main D'œuvre et dans Pointage.
                  </Typography>

                  <Button
                    variant="contained"
                    onClick={() => setOpenAdd(true)}
                    disabled={!canEdit}
                    sx={{ width: { xs: "100%", sm: 220 } }}
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
                  spacing={1}
                  sx={{ mb: 1.5 }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      {tableTitle}
                    </Typography>

                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      Style tableau similaire à l'ancien fichier Excel, intégré
                      dans Lite V2.
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip variant="outlined" label={`${rows.length} ouvrier(s)`} />

                    <Button
                      variant="outlined"
                      onClick={loadData}
                      disabled={loading}
                    >
                      Actualiser
                    </Button>

                    <Button
                      variant="outlined"
                      color="error"
                      onClick={deleteSelectedWorkers}
                      disabled={!canEdit || !selectedIdsArray.length}
                    >
                      Supprimer
                    </Button>

                    <Button
                      variant="text"
                      onClick={cancelChanges}
                      disabled={!canEdit || !hasUnsavedChanges}
                    >
                      Annuler
                    </Button>

                    <Button
                      variant="contained"
                      onClick={saveChanges}
                      disabled={!canEdit || !hasUnsavedChanges || saving}
                    >
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
                      onRowSelectionModelChange={(model) =>
                        setSelectedRowIds(model as any)
                      }
                      slots={{ toolbar: GridToolbar }}
                      slotProps={{ toolbar: { showQuickFilter: true } as any }}
                      processRowUpdate={processRowUpdate}
                      isCellEditable={() => canEdit}
                    />
                  )}
                </Box>
              </Box>
            )}
          </Paper>
        </Stack>
      </Box>

      <AppFooter />

      <Dialog
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Ajouter un ouvrier</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Matricule"
                value={draft.employee_code}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, employee_code: e.target.value }))
                }
                fullWidth
                required
              />

              <TextField
                label="Prenom"
                value={draft.prenom}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, prenom: e.target.value }))
                }
                fullWidth
                required
              />

              <TextField
                label="Nom"
                value={draft.nom}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, nom: e.target.value }))
                }
                fullWidth
                required
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                select
                label="Genre"
                value={draft.genre}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, genre: e.target.value }))
                }
                fullWidth
              >
                <MenuItem value="">(empty)</MenuItem>
                <MenuItem value="M">M</MenuItem>
                <MenuItem value="F">F</MenuItem>
              </TextField>

              <TextField
                label="Date naissance"
                type="date"
                value={draft.date_naissance}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, date_naissance: e.target.value }))
                }
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
                onChange={(e) =>
                  setDraft((p) => ({ ...p, contact: e.target.value }))
                }
                fullWidth
              />

              <TextField
                label="Date d'embauche"
                type="date"
                value={draft.date_embauche}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, date_embauche: e.target.value }))
                }
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
              label="N rib"
              value={draft.rib}
              onChange={(e) => setDraft((p) => ({ ...p, rib: e.target.value }))}
              fullWidth
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Minima"
                value={draft.minima ?? ""}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    minima: toNumberOrNull(e.target.value),
                  }))
                }
                fullWidth
              />

              <TextField
                label="Taux Horaire"
                value={draft.taux_horaire ?? ""}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    taux_horaire: toNumberOrNull(e.target.value),
                  }))
                }
                fullWidth
              />

              <TextField
                label="Quanza Fixe"
                value={draft.quanza_fixe ?? ""}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    quanza_fixe: toNumberOrNull(e.target.value),
                  }))
                }
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Début contrat"
                type="date"
                value={draft.contrat_debut}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, contrat_debut: e.target.value }))
                }
                InputLabelProps={{ shrink: true }}
                fullWidth
              />

              <TextField
                label="Fin contrat"
                type="date"
                value={draft.contrat_fin}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, contrat_fin: e.target.value }))
                }
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAdd(false)}>Cancel</Button>

          <Button variant="contained" onClick={addWorker} disabled={saving}>
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
import * as React from "react";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, GridToolbar, useGridApiRef } from "@mui/x-data-grid";
import type { GridColDef, GridCellParams, GridFilterModel } from "@mui/x-data-grid";

import type { Emballage, Produit, Qualite } from "@lite/shared";
import { PRODUIT_OPTIONS, QUALITE_OPTIONS, EMBALLAGE_OPTIONS, CALIBRE_BY_PRODUIT } from "@lite/shared";

import { supabase } from "../lib/supabaseClient";

/**
 * UI fields (requested order)
 */
type SortieRow = {
  id: string;

  Date_Chg: string; // YYYY-MM-DD
  Dossier: string;
  Client: string;
  Mat_Transport: string;

  Lot: string;
  Date_production: string; // YYYY-MM-DD
  Produit: Produit | "";
  Calibre: string;
  Qualite: Qualite | "";

  "%_Ctrl": number | null;
  Gr_mn: number | null;
  Gr_mx: number | null;

  Emballage: Emballage | "";
  PU: number | null;
  Colis: number | null;
  Quantite: number | null;
};

type FilterForm = {
  Date_from: string;
  Date_to: string;
  Dossier: string;
  Client: string;
  Mat_Transport: string;
  Lot: string;
  DateProd_from: string;
  DateProd_to: string;
  Produit: string;
  Calibre: string;
  Qualite: string;
  Emballage: string;
  Quantite_min: string;
  Quantite_max: string;
};

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace("%", "").trim());
  return Number.isFinite(n) ? n : null;
}

function emptyFilterForm(): FilterForm {
  return {
    Date_from: "",
    Date_to: "",
    Dossier: "",
    Client: "",
    Mat_Transport: "",
    Lot: "",
    DateProd_from: "",
    DateProd_to: "",
    Produit: "",
    Calibre: "",
    Qualite: "",
    Emballage: "",
    Quantite_min: "",
    Quantite_max: "",
  };
}

/**
 * DB row shape (snake_case in Supabase)
 */
type SortieDbRow = {
  id: string;
  date_chg: string | null;
  dossier: string | null;
  client: string | null;
  mat_transport: string | null;

  lot: string | null;
  date_production: string | null;
  produit: string | null;
  calibre: string | null;
  qualite: string | null;

  pct_ctrl: number | null;
  gr_mn: number | null;
  gr_mx: number | null;

  emballage: string | null;
  pu: number | null;
  colis: number | null;
  quantite: number | null;
};

function dbToUi(r: SortieDbRow): SortieRow {
  return {
    id: r.id,
    Date_Chg: r.date_chg ?? "",
    Dossier: r.dossier ?? "",
    Client: r.client ?? "",
    Mat_Transport: r.mat_transport ?? "",

    Lot: r.lot ?? "",
    Date_production: r.date_production ?? "",
    Produit: (r.produit as any) ?? "",
    Calibre: r.calibre ?? "nan",
    Qualite: (r.qualite as any) ?? "nan",

    "%_Ctrl": r.pct_ctrl ?? null,
    Gr_mn: r.gr_mn ?? null,
    Gr_mx: r.gr_mx ?? null,

    Emballage: (r.emballage as any) ?? "",
    PU: r.pu ?? null,
    Colis: r.colis ?? null,
    Quantite: r.quantite ?? null,
  };
}

function uiToDb(r: SortieRow) {
  return {
    date_chg: r.Date_Chg || null,
    dossier: r.Dossier || null,
    client: r.Client || null,
    mat_transport: r.Mat_Transport || null,

    lot: r.Lot || null,
    date_production: r.Date_production || null,
    produit: r.Produit || null,
    calibre: r.Calibre || null,
    qualite: r.Qualite || null,

    pct_ctrl: r["%_Ctrl"],
    gr_mn: r.Gr_mn,
    gr_mx: r.Gr_mx,

    emballage: r.Emballage || null,
    pu: r.PU,
    colis: r.Colis,
    quantite: r.Quantite,
  };
}

export default function SortiePage() {
  const apiRef = useGridApiRef();

  const [rows, setRows] = React.useState<SortieRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [filterModel, setFilterModel] = React.useState<GridFilterModel>({ items: [] });

  const [info, setInfo] = React.useState<string>("");
  const [errorMessages, setErrorMessages] = React.useState<string[]>([]);

  // Filter dialog
  const [openFilter, setOpenFilter] = React.useState(false);
  const [filterForm, setFilterForm] = React.useState<FilterForm>(() => emptyFilterForm());

  const fetchRows = React.useCallback(async () => {
    setLoading(true);
    setInfo("");
    setErrorMessages([]);

    const { data, error } = await supabase
      .from("sortie")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessages([error.message]);
      setLoading(false);
      return;
    }

    const ui = (data as SortieDbRow[]).map(dbToUi);
    setRows(ui);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // ✅ single-click edit
  const handleCellClick = React.useCallback(
    (params: GridCellParams) => {
      apiRef.current?.startCellEditMode({ id: params.id, field: params.field });
    },
    [apiRef]
  );

  const columns = React.useMemo<GridColDef<SortieRow>[]>(() => {
    const numericCol = (field: keyof SortieRow, headerName: string, width: number): GridColDef<SortieRow> => ({
      field: field as string,
      headerName,
      width,
      editable: true,
      type: "number",
      valueParser: (value) => toNumberOrNull(value),
      valueSetter: (value, row) => ({ ...row, [field]: toNumberOrNull(value) } as SortieRow),
    });

    return [
      { field: "Date_Chg", headerName: "Date Chg", width: 130, editable: true },
      { field: "Dossier", headerName: "Dossier", width: 140, editable: true },
      { field: "Client", headerName: "Client", width: 180, editable: true },
      { field: "Mat_Transport", headerName: "Mat Transport", width: 160, editable: true },

      { field: "Lot", headerName: "Lot", width: 140, editable: true },
      { field: "Date_production", headerName: "Date Production", width: 150, editable: true },
      {
        field: "Produit",
        headerName: "Produit",
        width: 170,
        editable: true,
        type: "singleSelect",
        valueOptions: PRODUIT_OPTIONS,
      },
      {
        field: "Calibre",
        headerName: "Caliber",
        width: 140,
        editable: true,
        type: "singleSelect",
        valueOptions: (params) => {
          const produit = params?.row?.Produit;
          if (!produit) return ["nan"];
          return ["nan", ...CALIBRE_BY_PRODUIT[produit]];
        },
      },
      {
        field: "Qualite",
        headerName: "Qualité",
        width: 110,
        editable: true,
        type: "singleSelect",
        valueOptions: QUALITE_OPTIONS,
      },

      {
        ...numericCol("%_Ctrl", "%Ctrl", 95),
        valueFormatter: (value) => (value == null || value === "" ? "" : `${value}%`),
      },
      numericCol("Gr_mn", "Gr Mn", 95),
      numericCol("Gr_mx", "Gr Mx", 95),
      {
        field: "Emballage",
        headerName: "Emballage",
        width: 120,
        editable: true,
        type: "singleSelect",
        valueOptions: EMBALLAGE_OPTIONS,
      },
      numericCol("PU", "Pu", 90),
      numericCol("Colis", "Colis", 90),
      numericCol("Quantite", "Quantite", 110),
    ];
  }, []);

  // =========================
  // Filter dialog -> converts to filterModel
  // =========================
  const hasAnyMultiFilter = (f: FilterForm) =>
    Object.values(f).some((v) => String(v ?? "").trim() !== "");

  const buildFilterModelFromForm = (f: FilterForm): GridFilterModel => {
    const items: any[] = [];

    if (f.Date_from.trim()) items.push({ field: "Date_Chg", operator: ">=", value: f.Date_from.trim() });
    if (f.Date_to.trim()) items.push({ field: "Date_Chg", operator: "<=", value: f.Date_to.trim() });

    if (f.Dossier.trim()) items.push({ field: "Dossier", operator: "contains", value: f.Dossier.trim() });
    if (f.Client.trim()) items.push({ field: "Client", operator: "contains", value: f.Client.trim() });
    if (f.Mat_Transport.trim())
      items.push({ field: "Mat_Transport", operator: "contains", value: f.Mat_Transport.trim() });

    if (f.Lot.trim()) items.push({ field: "Lot", operator: "contains", value: f.Lot.trim() });

    if (f.DateProd_from.trim())
      items.push({ field: "Date_production", operator: ">=", value: f.DateProd_from.trim() });
    if (f.DateProd_to.trim())
      items.push({ field: "Date_production", operator: "<=", value: f.DateProd_to.trim() });

    if (f.Produit.trim()) items.push({ field: "Produit", operator: "equals", value: f.Produit.trim() });
    if (f.Calibre.trim()) items.push({ field: "Calibre", operator: "contains", value: f.Calibre.trim() });
    if (f.Qualite.trim()) items.push({ field: "Qualite", operator: "equals", value: f.Qualite.trim() });
    if (f.Emballage.trim()) items.push({ field: "Emballage", operator: "equals", value: f.Emballage.trim() });

    if (f.Quantite_min.trim()) items.push({ field: "Quantite", operator: ">=", value: f.Quantite_min.trim() });
    if (f.Quantite_max.trim()) items.push({ field: "Quantite", operator: "<=", value: f.Quantite_max.trim() });

    return { items };
  };

  const openFilterDialog = () => setOpenFilter(true);

  const applyFilter = () => {
    if (!hasAnyMultiFilter(filterForm)) {
      setFilterModel({ items: [] });
      setOpenFilter(false);
      setInfo("Filter cleared.");
      return;
    }
    setFilterModel(buildFilterModelFromForm(filterForm));
    setOpenFilter(false);
    setInfo("Filter applied.");
  };

  const clearFilter = () => {
    setFilterForm(emptyFilterForm());
    setFilterModel({ items: [] });
    setInfo("Filter cleared.");
  };

  // =========================
  // DB persistence (auto-save)
  // =========================
  const persistRow = async (row: SortieRow) => {
    const payload = uiToDb(row);

    const { error } = await supabase.from("sortie").update(payload).eq("id", row.id);
    if (error) {
      setErrorMessages([error.message]);
      throw error;
    }
  };

  const handleRefresh = async () => {
    await fetchRows();
    setInfo("Refreshed from database.");
  };

  const FilterRow = ({ children }: { children: React.ReactNode }) => (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
      {children}
    </Stack>
  );

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h5">Sortie</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Shared database mode (Supabase)
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip variant="outlined" label={`Rows: ${rows.length}`} />
          {loading ? <Chip color="info" label="Loading..." /> : <Chip color="success" label="Live" />}
        </Stack>
      </Stack>

      <Paper sx={{ p: 1.2, borderRadius: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Button variant="outlined" onClick={handleRefresh} disabled={loading}>
            Refresh
          </Button>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <Button variant="outlined" onClick={openFilterDialog}>
            Filter
          </Button>
          <Button variant="text" onClick={clearFilter}>
            Clear Filter
          </Button>

          <Box sx={{ flexGrow: 1 }} />

          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Changes are saved automatically.
          </Typography>
        </Stack>
      </Paper>

      {info ? <Alert severity="success">{info}</Alert> : null}

      {errorMessages.length ? (
        <Alert severity="warning">
          <Stack spacing={0.5}>
            {errorMessages.slice(0, 12).map((m, i) => (
              <div key={i}>{m}</div>
            ))}
          </Stack>
        </Alert>
      ) : null}

      <Paper sx={{ p: 1.2, borderRadius: 3 }}>
        <Box sx={{ height: 680, width: "100%" }}>
          <DataGrid
            apiRef={apiRef}
            rows={rows}
            columns={columns}
            getRowId={(r) => r.id}
            loading={loading}
            initialState={{ density: "compact" }}
            editMode="cell"
            disableRowSelectionOnClick
            filterModel={filterModel}
            onFilterModelChange={(m) => setFilterModel(m)}
            slots={{ toolbar: GridToolbar }}
            slotProps={{ toolbar: { showQuickFilter: false } as any }}
            onCellClick={handleCellClick}
            processRowUpdate={async (newRow: SortieRow) => {
              const cleaned: SortieRow = {
                ...newRow,
                Calibre: newRow.Calibre?.trim() ? newRow.Calibre : "nan",
                Date_Chg: newRow.Date_Chg?.trim()
                  ? newRow.Date_Chg
                  : dayjs().format("YYYY-MM-DD"),
              };

              // optimistic UI
              setRows((prev) => prev.map((r) => (r.id === cleaned.id ? cleaned : r)));

              // persist to DB
              await persistRow(cleaned);

              setInfo("Saved.");
              return cleaned;
            }}
            isCellEditable={() => true}
          />
        </Box>
      </Paper>

      {/* FILTER dialog */}
      <Dialog open={openFilter} onClose={() => setOpenFilter(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Filter Sortie</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          <FilterRow>
            <TextField
              label="Date Chg from"
              type="date"
              value={filterForm.Date_from}
              onChange={(e) => setFilterForm((p) => ({ ...p, Date_from: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Date Chg to"
              type="date"
              value={filterForm.Date_to}
              onChange={(e) => setFilterForm((p) => ({ ...p, Date_to: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Dossier contains"
              value={filterForm.Dossier}
              onChange={(e) => setFilterForm((p) => ({ ...p, Dossier: e.target.value }))}
              fullWidth
            />
          </FilterRow>

          <FilterRow>
            <TextField
              label="Client contains"
              value={filterForm.Client}
              onChange={(e) => setFilterForm((p) => ({ ...p, Client: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Mat Transport contains"
              value={filterForm.Mat_Transport}
              onChange={(e) => setFilterForm((p) => ({ ...p, Mat_Transport: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Lot contains"
              value={filterForm.Lot}
              onChange={(e) => setFilterForm((p) => ({ ...p, Lot: e.target.value }))}
              fullWidth
            />
          </FilterRow>

          <FilterRow>
            <TextField
              label="Date Production from"
              type="date"
              value={filterForm.DateProd_from}
              onChange={(e) => setFilterForm((p) => ({ ...p, DateProd_from: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Date Production to"
              type="date"
              value={filterForm.DateProd_to}
              onChange={(e) => setFilterForm((p) => ({ ...p, DateProd_to: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Produit</InputLabel>
              <Select
                label="Produit"
                value={filterForm.Produit}
                onChange={(e) => setFilterForm((p) => ({ ...p, Produit: String(e.target.value) }))}
              >
                <MenuItem value="">(any)</MenuItem>
                {PRODUIT_OPTIONS.map((o) => (
                  <MenuItem key={o} value={o}>
                    {o}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </FilterRow>

          <FilterRow>
            <TextField
              label="Calibre contains"
              value={filterForm.Calibre}
              onChange={(e) => setFilterForm((p) => ({ ...p, Calibre: e.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Qualité</InputLabel>
              <Select
                label="Qualité"
                value={filterForm.Qualite}
                onChange={(e) => setFilterForm((p) => ({ ...p, Qualite: String(e.target.value) }))}
              >
                <MenuItem value="">(any)</MenuItem>
                {QUALITE_OPTIONS.map((o) => (
                  <MenuItem key={o} value={o}>
                    {o}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Emballage</InputLabel>
              <Select
                label="Emballage"
                value={filterForm.Emballage}
                onChange={(e) => setFilterForm((p) => ({ ...p, Emballage: String(e.target.value) }))}
              >
                <MenuItem value="">(any)</MenuItem>
                {EMBALLAGE_OPTIONS.map((o) => (
                  <MenuItem key={o} value={o}>
                    {o}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </FilterRow>

          <FilterRow>
            <TextField
              label="Quantite min"
              type="number"
              value={filterForm.Quantite_min}
              onChange={(e) => setFilterForm((p) => ({ ...p, Quantite_min: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Quantite max"
              type="number"
              value={filterForm.Quantite_max}
              onChange={(e) => setFilterForm((p) => ({ ...p, Quantite_max: e.target.value }))}
              fullWidth
            />
          </FilterRow>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenFilter(false)}>Cancel</Button>
          <Button onClick={() => setFilterForm(emptyFilterForm())}>Reset</Button>
          <Button variant="contained" onClick={applyFilter}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

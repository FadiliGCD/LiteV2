import * as React from "react";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import {
  Box,
  Button,
  Stack,
  Typography,
  Chip,
  Alert,
  Divider,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { DataGrid, useGridApiRef } from "@mui/x-data-grid";
import type {
  GridColDef,
  GridRowId,
  GridRowSelectionModel,
  GridCellParams,
} from "@mui/x-data-grid";

import type { Emballage, CodePrp, Produit, Qualite } from "@lite/shared";
import {
  CODE_PRP_OPTIONS,
  PRODUIT_OPTIONS,
  QUALITE_OPTIONS,
  EMBALLAGE_OPTIONS,
  CALIBRE_BY_PRODUIT,
} from "@lite/shared";

type Role = "superuser" | "user";

type EntreeRow = {
  id: string;

  Lot: string;
  Code_Prp: CodePrp | "";
  Date_production: string; // ISO YYYY-MM-DD
  Produit: Produit | "";
  Calibre: string; // includes "nan"
  Qualite: Qualite | "";

  "%_Ctrl": number | null; // store 0-100
  Gr_mn: number | null;
  Gr_mx: number | null;

  Emballage: Emballage | "";
  PU: number | null;
  Colis: number | null;
  Quantite: number | null;
};

const STORAGE_KEY = "lite-v2.entree.rows.v2"; // bump key because column name changed

const XLSX_HEADERS: Array<keyof Omit<EntreeRow, "id">> = [
  "Lot",
  "Code_Prp",
  "Date_production",
  "Produit",
  "Calibre",
  "Qualite",
  "%_Ctrl",
  "Gr_mn",
  "Gr_mx",
  "Emballage",
  "PU",
  "Colis",
  "Quantite",
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayISO() {
  return dayjs().format("YYYY-MM-DD");
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace("%", "").trim());
  return Number.isFinite(n) ? n : null;
}

function toStringSafe(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function stableStringify(obj: unknown) {
  return JSON.stringify(obj);
}

function newEmptyRow(): EntreeRow {
  return {
    id: makeId(),
    Lot: "",
    Code_Prp: "",
    Date_production: todayISO(),
    Produit: "",
    Calibre: "nan",
    Qualite: "nan",
    "%_Ctrl": null,
    Gr_mn: null,
    Gr_mx: null,
    Emballage: "",
    PU: null,
    Colis: null,
    Quantite: null,
  };
}

function loadRowsFromStorage(): EntreeRow[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((x) => x && typeof x.id === "string") as EntreeRow[];
  } catch {
    return null;
  }
}

function saveRowsToStorage(rows: EntreeRow[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function normalizeDateToISO(input: unknown): string {
  if (input === null || input === undefined || input === "") return "";

  if (input instanceof Date) return dayjs(input).format("YYYY-MM-DD");

  if (typeof input === "number") {
    const d = XLSX.SSF.parse_date_code(input);
    if (d) return dayjs(new Date(d.y, d.m - 1, d.d)).format("YYYY-MM-DD");
  }

  const s = String(input).trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) {
    const dd = dmY[1].padStart(2, "0");
    const mm = dmY[2].padStart(2, "0");
    return `${dmY[3]}-${mm}-${dd}`;
  }

  const d = dayjs(s);
  return d.isValid() ? d.format("YYYY-MM-DD") : "";
}

function getAny(obj: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    if (k in obj) return obj[k];
  }
  return "";
}

function mapObjectToRow(obj: Record<string, unknown>): EntreeRow {
  const r = newEmptyRow();

  // Support both Code_Prp and old Code_Prd in the XLSX
  r.Lot = toStringSafe(getAny(obj, ["Lot"]));
  r.Code_Prp = (toStringSafe(getAny(obj, ["Code_Prp", "Code_Prd"])).trim() as any) || "";
  r.Date_production = normalizeDateToISO(getAny(obj, ["Date_production", "Date production"]));
  r.Produit = (toStringSafe(getAny(obj, ["Produit"])).trim() as any) || "";

  const calibre = toStringSafe(getAny(obj, ["Calibre"])).trim();
  r.Calibre = calibre ? calibre : "nan";

  r.Qualite = (toStringSafe(getAny(obj, ["Qualite"])).trim() as any) || "nan";

  r["%_Ctrl"] = toNumberOrNull(getAny(obj, ["%_Ctrl", "% Ctrl", "%Ctrl"]));
  r.Gr_mn = toNumberOrNull(getAny(obj, ["Gr_mn", "Gr mn", "Gr_mn "])); // tolerate spacing
  r.Gr_mx = toNumberOrNull(getAny(obj, ["Gr_mx", "Gr mx", "Gr_mx "]));
  r.Emballage = (toStringSafe(getAny(obj, ["Emballage"])).trim() as any) || "";

  r.PU = toNumberOrNull(getAny(obj, ["PU"]));
  r.Colis = toNumberOrNull(getAny(obj, ["Colis"]));
  r.Quantite = toNumberOrNull(getAny(obj, ["Quantite"]));

  return r;
}

export default function EntreePage({ role = "superuser" }: { role?: Role }) {
  const canEditRole = role === "superuser";
  const apiRef = useGridApiRef();

  const [rows, setRows] = React.useState<EntreeRow[]>(() => [newEmptyRow()]);
  const [lastSavedRows, setLastSavedRows] = React.useState<EntreeRow[]>(() => [newEmptyRow()]);
  const [selectedRowIds, setSelectedRowIds] = React.useState<GridRowSelectionModel>({
    type: "include",
    ids: new Set<GridRowId>(),
  });

  const [errorMessages, setErrorMessages] = React.useState<string[]>([]);
  const [info, setInfo] = React.useState<string>("");

  // New Entry dialog
  const [openNew, setOpenNew] = React.useState(false);
  const [draft, setDraft] = React.useState<EntreeRow>(() => newEmptyRow());

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const stored = loadRowsFromStorage();
    const initial = stored && stored.length ? stored : [newEmptyRow()];
    setRows(initial);
    setLastSavedRows(initial);
  }, []);

  const hasUnsavedChanges = React.useMemo(
    () => stableStringify(rows) !== stableStringify(lastSavedRows),
    [rows, lastSavedRows]
  );

  const draftCalibreOptions = React.useMemo(() => {
    if (!draft.Produit) return ["nan"];
    return ["nan", ...CALIBRE_BY_PRODUIT[draft.Produit]];
  }, [draft.Produit]);

  const columns = React.useMemo<GridColDef<EntreeRow>[]>(() => {
    const numericCol = (field: keyof EntreeRow, headerName: string, width: number): GridColDef<EntreeRow> => ({
      field: field as string,
      headerName,
      width,
      editable: true,
      type: "number",
      valueParser: (value) => toNumberOrNull(value),
      valueSetter: (value, row) => ({ ...row, [field]: toNumberOrNull(value) } as EntreeRow),
    });

    return [
      { field: "Lot", headerName: "Lot", width: 140, editable: true },

      {
        field: "Code_Prp",
        headerName: "Code_Prp",
        width: 140,
        editable: true,
        type: "singleSelect",
        valueOptions: CODE_PRP_OPTIONS,
      },

      {
        field: "Date_production",
        headerName: "Date production",
        width: 150,
        editable: true,
        type: "date",
        valueGetter: (value) => (value ? new Date(String(value)) : null),
        valueSetter: (value, row) => {
          const d = value instanceof Date ? value : null;
          const iso = d ? dayjs(d).format("YYYY-MM-DD") : "";
          return { ...row, Date_production: iso };
        },
      },

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
        headerName: "Calibre",
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
        headerName: "Qualite",
        width: 110,
        editable: true,
        type: "singleSelect",
        valueOptions: QUALITE_OPTIONS,
      },

      // ✅ show percentage display
      {
        ...numericCol("%_Ctrl", "% Ctrl", 95),
        valueFormatter: (value) => (value == null || value === "" ? "" : `${value}%`),

      },

      numericCol("Gr_mn", "Gr mn", 95),
      numericCol("Gr_mx", "Gr mx", 95),

      {
        field: "Emballage",
        headerName: "Emballage",
        width: 120,
        editable: true,
        type: "singleSelect",
        valueOptions: EMBALLAGE_OPTIONS,
      },

      numericCol("PU", "PU", 90),
      numericCol("Colis", "Colis", 90),
      numericCol("Quantite", "Quantite", 110),
    ];
  }, []);

  // ✅ Single-click edit (no more double-click + confusion)
  const handleCellClick = React.useCallback(
    (params: GridCellParams) => {
      if (!canEditRole) return;
      if (params.field === "__check__") return;
      // start edit mode on single click
      apiRef.current?.startCellEditMode({ id: params.id, field: params.field });

    },
    [apiRef, canEditRole]
  );

  // New Entry dialog actions
  const openNewEntry = () => {
    setInfo("");
    setErrorMessages([]);
    setDraft(newEmptyRow());
    setOpenNew(true);
  };

  const saveNewEntry = () => {
    // ✅ No restrictions: save anything
    const row: EntreeRow = {
      ...draft,
      id: makeId(),
      Calibre: draft.Calibre?.toString().trim() ? draft.Calibre : "nan",
    };
    setRows((prev) => [row, ...prev]);
    setOpenNew(false);
    setInfo("New entry added to grid (not saved yet).");
  };

  const handleSave = () => {
    // ✅ No validation restrictions
    setLastSavedRows(rows);
    saveRowsToStorage(rows);
    setErrorMessages([]);
    setInfo("Saved (localStorage).");
  };

  const handleCancel = () => {
    setRows(lastSavedRows);
    setErrorMessages([]);
    setInfo("Restored last saved snapshot.");
  };

  const handleClearLocal = () => {
    localStorage.removeItem(STORAGE_KEY);
    const fresh = [newEmptyRow()];
    setRows(fresh);
    setLastSavedRows(fresh);
    setErrorMessages([]);
    setInfo("Cleared local data.");
  };

  // XLSX Export / Import
  const handleExportXLSX = () => {
    const aoa: any[][] = [];
    aoa.push(XLSX_HEADERS.map(String));

    rows.forEach((r) => {
      aoa.push(
        XLSX_HEADERS.map((k) => {
          const v = (r as any)[k];
          return v === null || v === undefined ? "" : v;
        })
      );
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Entree");
    const filename = `entree_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const handleClickImport = () => fileInputRef.current?.click();

  const importFromXLSX = async (file: File) => {
    setInfo("");
    setErrorMessages([]);

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const sheetName = wb.SheetNames[0];

    if (!sheetName) {
      setErrorMessages(["XLSX has no sheets."]);
      return;
    }

    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: "",
      raw: true,
    });

    if (!json.length) {
      setErrorMessages(["XLSX sheet has no rows."]);
      return;
    }

    const imported = json.map(mapObjectToRow);

    setRows(imported);
    setInfo(`Imported ${imported.length} rows from XLSX (not saved yet).`);
  };

  const processRowUpdate = (newRow: EntreeRow) => {
    const cleaned: EntreeRow = {
      ...newRow,
      Calibre: newRow.Calibre?.toString().trim() ? newRow.Calibre : "nan",
    };
    setRows((prev) => prev.map((r) => (r.id === cleaned.id ? cleaned : r)));
    return cleaned;
  };

  return (
    <Stack spacing={2}>
      {/* Header */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h5">Entreé</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Incoming stock
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          {hasUnsavedChanges ? (
            <Chip color="warning" label="Unsaved changes" />
          ) : (
            <Chip color="success" label="Saved" />
          )}
          <Chip variant="outlined" label={`Rows: ${rows.length}`} />
        </Stack>
      </Stack>

      {/* Action bar */}
      <Paper sx={{ p: 1.2, borderRadius: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Button variant="contained" onClick={openNewEntry} disabled={!canEditRole}>
            New Entry
          </Button>
          <Button variant="outlined" onClick={handleSave} disabled={!canEditRole || !hasUnsavedChanges}>
            Save
          </Button>
          <Button variant="text" onClick={handleCancel} disabled={!canEditRole || !hasUnsavedChanges}>
            Cancel
          </Button>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <Button variant="outlined" onClick={handleExportXLSX}>
            Export XLSX
          </Button>
          <Button variant="outlined" onClick={handleClickImport}>
            Import XLSX
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) importFromXLSX(file);
            }}
          />

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Role:{" "}
              <Box
                component="span"
                sx={{
                  fontWeight: 700,
                  color: role === "superuser" ? "error.main" : "text.primary",
                 }}
                 > 
                {role}
              </Box>
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <Button variant="text" color="error" onClick={handleClearLocal} disabled={!canEditRole}>
            Clear Local Data
          </Button>
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

      {/* Grid container */}
      <Paper sx={{ p: 1.2, borderRadius: 3 }}>
        <Box sx={{ height: 620, width: "100%" }}>
          <DataGrid
            apiRef={apiRef}
            rows={rows}
            columns={columns}
            getRowId={(r) => r.id}
            initialState={{ density: "compact" }}

            // ✅ selection is via checkbox ONLY
            checkboxSelection
            disableRowSelectionOnClick
            rowSelectionModel={selectedRowIds}
            onRowSelectionModelChange={(m) => setSelectedRowIds(m as any)}

            // ✅ single click edit
            onCellClick={handleCellClick}
            editMode="cell"

            processRowUpdate={processRowUpdate}

            // ✅ allow editing any cell (no “selected row” restriction)
            isCellEditable={() => canEditRole}
          />
        </Box>
      </Paper>

      {/* New Entry dialog */}
      <Dialog open={openNew} onClose={() => setOpenNew(false)} maxWidth="md" fullWidth>
        <DialogTitle>New Entry</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Lot"
                value={draft.Lot}
                onChange={(e) => setDraft((p) => ({ ...p, Lot: e.target.value }))}
                fullWidth
              />

              <FormControl fullWidth>
                <InputLabel>Code_Prp</InputLabel>
                <Select
                  label="Code_Prp"
                  value={draft.Code_Prp}
                  onChange={(e) => setDraft((p) => ({ ...p, Code_Prp: e.target.value as any }))}
                >
                  <MenuItem value="">(empty)</MenuItem>
                  {CODE_PRP_OPTIONS.map((o) => (
                    <MenuItem key={o} value={o}>
                      {o}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Date production"
                type="date"
                value={draft.Date_production || ""}
                onChange={(e) => setDraft((p) => ({ ...p, Date_production: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Produit</InputLabel>
                <Select
                  label="Produit"
                  value={draft.Produit}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      Produit: e.target.value as any,
                    }))
                  }
                >
                  <MenuItem value="">(empty)</MenuItem>
                  {PRODUIT_OPTIONS.map((o) => (
                    <MenuItem key={o} value={o}>
                      {o}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Calibre</InputLabel>
                <Select
                  label="Calibre"
                  value={draft.Calibre}
                  onChange={(e) => setDraft((p) => ({ ...p, Calibre: e.target.value as string }))}
                >
                  {draftCalibreOptions.map((o) => (
                    <MenuItem key={o} value={o}>
                      {o}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Qualite</InputLabel>
                <Select
                  label="Qualite"
                  value={draft.Qualite}
                  onChange={(e) => setDraft((p) => ({ ...p, Qualite: e.target.value as any }))}
                >
                  {QUALITE_OPTIONS.map((o) => (
                    <MenuItem key={o} value={o}>
                      {o}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="% Ctrl"
                value={draft["%_Ctrl"] ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, "%_Ctrl": toNumberOrNull(e.target.value) }))}
                fullWidth
                helperText='Enter like: 10 or 10%'
              />
              <TextField
                label="Gr mn"
                value={draft.Gr_mn ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, Gr_mn: toNumberOrNull(e.target.value) }))}
                fullWidth
              />
              <TextField
                label="Gr mx"
                value={draft.Gr_mx ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, Gr_mx: toNumberOrNull(e.target.value) }))}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Emballage</InputLabel>
                <Select
                  label="Emballage"
                  value={draft.Emballage}
                  onChange={(e) => setDraft((p) => ({ ...p, Emballage: e.target.value as any }))}
                >
                  <MenuItem value="">(empty)</MenuItem>
                  {EMBALLAGE_OPTIONS.map((o) => (
                    <MenuItem key={o} value={o}>
                      {o}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="PU"
                value={draft.PU ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, PU: toNumberOrNull(e.target.value) }))}
                fullWidth
              />
              <TextField
                label="Colis"
                value={draft.Colis ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, Colis: toNumberOrNull(e.target.value) }))}
                fullWidth
              />
              <TextField
                label="Quantite"
                value={draft.Quantite ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, Quantite: toNumberOrNull(e.target.value) }))}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenNew(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveNewEntry}>
            Save Entry
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

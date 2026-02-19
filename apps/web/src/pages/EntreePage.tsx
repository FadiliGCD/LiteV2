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
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";
import { DataGrid, GridToolbar, useGridApiRef } from "@mui/x-data-grid";
import type {
  GridColDef,
  GridRowId,
  GridRowSelectionModel,
  GridCellParams,
  GridFilterModel,
} from "@mui/x-data-grid";

import type { Emballage, CodePrp, Produit, Qualite } from "@lite/shared";
import {
  CODE_PRP_OPTIONS,
  PRODUIT_OPTIONS,
  QUALITE_OPTIONS,
  EMBALLAGE_OPTIONS,
  CALIBRE_BY_PRODUIT,
} from "@lite/shared";

import { supabase } from "../lib/supabaseClient";

type Role = "superuser" | "user";

type EntreeRow = {
  id: string;

  Lot: string;
  Code_Prp: CodePrp | "";
  Date_production: string; // ISO YYYY-MM-DD
  Produit: Produit | "";
  Calibre: string; // includes "nan"
  Qualite: Qualite | "";

  "%_Ctrl": number | null;
  Gr_mn: number | null;
  Gr_mx: number | null;

  Emballage: Emballage | "";
  PU: number | null;
  Colis: number | null;
  Quantite: number | null;
};

type ParkingItem = {
  entreeRowId: string;
  Lot: string;
  Code_Prp: string;
  Produit: string;
  Calibre: string;
  Qualite: string;
  reservedQty: number;
};

type FilterForm = {
  Lot: string;
  Code_Prp: string;
  Date_from: string;
  Date_to: string;
  Produit: string;
  Calibre: string;
  Qualite: string;
  Emballage: string;
  Quantite_min: string;
  Quantite_max: string;
};

const CLIENTS = ["Client Atlas", "Client Marina", "Client Sahara"];

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function todayISO() {
  return dayjs().format("YYYY-MM-DD");
}
function stableStringify(obj: unknown) {
  return JSON.stringify(obj);
}
function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace("%", "").trim());
  return Number.isFinite(n) ? n : null;
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

function emptyFilterForm(): FilterForm {
  return {
    Lot: "",
    Code_Prp: "",
    Date_from: "",
    Date_to: "",
    Produit: "",
    Calibre: "",
    Qualite: "",
    Emballage: "",
    Quantite_min: "",
    Quantite_max: "",
  };
}

// -----------------------------
// Supabase mapping
// -----------------------------
type EntreeDbRow = {
  id: string;
  lot: string | null;
  code_prp: string | null;
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

function dbToUi(r: EntreeDbRow): EntreeRow {
  return {
    id: String(r.id),
    Lot: String(r.lot ?? ""),
    Code_Prp: (String(r.code_prp ?? "") as any) || "",
    Date_production: r.date_production ? String(r.date_production) : "",
    Produit: (String(r.produit ?? "") as any) || "",
    Calibre: String(r.calibre ?? "nan"),
    Qualite: (String(r.qualite ?? "nan") as any) || "nan",
    "%_Ctrl": r.pct_ctrl ?? null,
    Gr_mn: r.gr_mn ?? null,
    Gr_mx: r.gr_mx ?? null,
    Emballage: (String(r.emballage ?? "") as any) || "",
    PU: r.pu ?? null,
    Colis: r.colis ?? null,
    Quantite: r.quantite ?? null,
  };
}

function uiToDb(r: EntreeRow) {
  return {
    id: r.id,
    lot: r.Lot || null,
    code_prp: (r.Code_Prp as any) || null,
    date_production: r.Date_production || null,
    produit: (r.Produit as any) || null,
    calibre: r.Calibre || null,
    qualite: (r.Qualite as any) || null,
    pct_ctrl: r["%_Ctrl"],
    gr_mn: r.Gr_mn,
    gr_mx: r.Gr_mx,
    emballage: (r.Emballage as any) || null,
    pu: r.PU,
    colis: r.Colis,
    quantite: r.Quantite,
  };
}

// -----------------------------
// XLSX helpers (same as yours)
// -----------------------------
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
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, "0")}-${dmY[1].padStart(2, "0")}`;
  const d = dayjs(s);
  return d.isValid() ? d.format("YYYY-MM-DD") : "";
}
function getAny(obj: Record<string, unknown>, keys: string[]) {
  for (const k of keys) if (k in obj) return obj[k];
  return "";
}
function mapObjectToRow(obj: Record<string, unknown>): EntreeRow {
  const r = newEmptyRow();
  r.Lot = String(getAny(obj, ["Lot"]) ?? "");
  r.Code_Prp = (String(getAny(obj, ["Code_Prp", "Code_Prd"]) ?? "").trim() as any) || "";
  r.Date_production = normalizeDateToISO(getAny(obj, ["Date_production", "Date production"]));
  r.Produit = (String(getAny(obj, ["Produit"]) ?? "").trim() as any) || "";
  const calibre = String(getAny(obj, ["Calibre"]) ?? "").trim();
  r.Calibre = calibre ? calibre : "nan";
  r.Qualite = (String(getAny(obj, ["Qualite"]) ?? "").trim() as any) || "nan";
  r["%_Ctrl"] = toNumberOrNull(getAny(obj, ["%_Ctrl", "% Ctrl", "%Ctrl"]));
  r.Gr_mn = toNumberOrNull(getAny(obj, ["Gr_mn", "Gr mn"]));
  r.Gr_mx = toNumberOrNull(getAny(obj, ["Gr_mx", "Gr mx"]));
  r.Emballage = (String(getAny(obj, ["Emballage"]) ?? "").trim() as any) || "";
  r.PU = toNumberOrNull(getAny(obj, ["PU"]));
  r.Colis = toNumberOrNull(getAny(obj, ["Colis"]));
  r.Quantite = toNumberOrNull(getAny(obj, ["Quantite"]));
  return r;
}

// -----------------------------
// Page
// -----------------------------
export default function EntreePage({ role = "superuser" }: { role?: Role }) {
  const canEditRole = role === "superuser";
  const apiRef = useGridApiRef();

  const [loading, setLoading] = React.useState(true);

  const [rows, setRows] = React.useState<EntreeRow[]>([]);
  const [lastSavedRows, setLastSavedRows] = React.useState<EntreeRow[]>([]);
  const [deletedIds, setDeletedIds] = React.useState<Set<string>>(new Set());

  const [selectedRowIds, setSelectedRowIds] = React.useState<GridRowSelectionModel>({
    type: "include",
    ids: new Set<GridRowId>(),
  });

  const [filterModel, setFilterModel] = React.useState<GridFilterModel>({ items: [] });
  const [errorMessages, setErrorMessages] = React.useState<string[]>([]);
  const [info, setInfo] = React.useState<string>("");

  // Filter dialog
  const [openFilter, setOpenFilter] = React.useState(false);
  const [filterForm, setFilterForm] = React.useState<FilterForm>(() => emptyFilterForm());

  // New Entry dialog
  const [openNew, setOpenNew] = React.useState(false);
  const [draft, setDraft] = React.useState<EntreeRow>(() => newEmptyRow());

  // Park dialog
  const [openPark, setOpenPark] = React.useState(false);
  const [parkReservationId, setParkReservationId] = React.useState<string>("");
  const [parkClient, setParkClient] = React.useState<string>("");
  const [parkRows, setParkRows] = React.useState<Array<{ row: EntreeRow; maxQty: number; reserveQty: number }>>([]);

  // Delete rows dialog
  const [openDeleteRows, setOpenDeleteRows] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const hasUnsavedChanges = React.useMemo(() => {
    if (deletedIds.size) return true;
    return stableStringify(rows) !== stableStringify(lastSavedRows);
  }, [rows, lastSavedRows, deletedIds]);

  const selectedIdsArray = React.useMemo(() => Array.from(selectedRowIds.ids ?? []), [selectedRowIds]);

  const loadFromDb = React.useCallback(async () => {
    setLoading(true);
    setInfo("");
    setErrorMessages([]);
    try {
      const { data, error } = await supabase
        .from("entree")
        .select("id, lot, code_prp, date_production, produit, calibre, qualite, pct_ctrl, gr_mn, gr_mx, emballage, pu, colis, quantite")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      const ui = (data as any[]).map((r) => dbToUi(r as any));
      const finalRows = ui.length ? ui : [newEmptyRow()];
      setRows(finalRows);
      setLastSavedRows(finalRows);
      setDeletedIds(new Set());
      setLoading(false);
    } catch (e: any) {
      setErrorMessages([e?.message ?? "Failed to load Entree"]);
      setRows([newEmptyRow()]);
      setLastSavedRows([newEmptyRow()]);
      setDeletedIds(new Set());
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  // ✅ single-click edit
  const handleCellClick = React.useCallback(
    (params: GridCellParams) => {
      if (!canEditRole) return;
      apiRef.current?.startCellEditMode({ id: params.id, field: params.field });
    },
    [apiRef, canEditRole]
  );

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

  // New Entry
  const openNewEntry = () => {
    setInfo("");
    setErrorMessages([]);
    setDraft(newEmptyRow());
    setOpenNew(true);
  };
  const saveNewEntry = () => {
    const row: EntreeRow = {
      ...draft,
      id: makeId(),
      Calibre: draft.Calibre?.trim() ? draft.Calibre : "nan",
    };
    setRows((prev) => [row, ...prev]);
    setOpenNew(false);
    setInfo("New entry added to grid (not saved yet).");
  };

  // Save/Cancel (DB)
  const handleSave = async () => {
    try {
      setInfo("");
      setErrorMessages([]);

      // delete removed rows
      if (deletedIds.size) {
        const ids = Array.from(deletedIds);
        const { error: delErr } = await supabase.from("entree").delete().in("id", ids);
        if (delErr) throw new Error(delErr.message);
      }

      // upsert current rows
      const payload = rows.map((r) => uiToDb(r));
      const { error: upErr } = await supabase.from("entree").upsert(payload, { onConflict: "id" });
      if (upErr) throw new Error(upErr.message);

      setDeletedIds(new Set());
      setLastSavedRows(rows);
      setInfo("Saved to database.");
    } catch (e: any) {
      setErrorMessages([e?.message ?? "Save failed."]);
    }
  };

  const handleCancel = () => {
    setRows(lastSavedRows);
    setDeletedIds(new Set());
    setInfo("Restored last saved snapshot.");
    setErrorMessages([]);
  };

  const handleRefresh = async () => {
    await loadFromDb();
    setInfo("Refreshed from database.");
  };

  // XLSX Import/Export
  const handleExportXLSX = () => {
    const headers = [
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
    const aoa: any[][] = [headers];

    rows.forEach((r) => {
      aoa.push([
        r.Lot,
        r.Code_Prp,
        r.Date_production,
        r.Produit,
        r.Calibre,
        r.Qualite,
        r["%_Ctrl"],
        r.Gr_mn,
        r.Gr_mx,
        r.Emballage,
        r.PU,
        r.Colis,
        r.Quantite,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Entree");
    XLSX.writeFile(wb, `entree_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);
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
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
    if (!json.length) {
      setErrorMessages(["XLSX sheet has no rows."]);
      return;
    }

    const imported = json.map(mapObjectToRow);
    setRows(imported);
    setDeletedIds(new Set());
    setInfo(`Imported ${imported.length} rows (not saved yet).`);
  };

  // =========================
  // Multi-column filter dialog
  // =========================
  const hasAnyMultiFilter = (f: FilterForm) => Object.values(f).some((v) => String(v ?? "").trim() !== "");

  const buildFilterModelFromForm = (f: FilterForm): GridFilterModel => {
    const items: any[] = [];

    if (f.Lot.trim()) items.push({ field: "Lot", operator: "contains", value: f.Lot.trim() });
    if (f.Code_Prp.trim()) items.push({ field: "Code_Prp", operator: "equals", value: f.Code_Prp.trim() });

    if (f.Produit.trim()) items.push({ field: "Produit", operator: "equals", value: f.Produit.trim() });
    if (f.Calibre.trim()) items.push({ field: "Calibre", operator: "contains", value: f.Calibre.trim() });
    if (f.Qualite.trim()) items.push({ field: "Qualite", operator: "equals", value: f.Qualite.trim() });
    if (f.Emballage.trim()) items.push({ field: "Emballage", operator: "equals", value: f.Emballage.trim() });

    if (f.Date_from.trim()) items.push({ field: "Date_production", operator: ">=", value: f.Date_from.trim() });
    if (f.Date_to.trim()) items.push({ field: "Date_production", operator: "<=", value: f.Date_to.trim() });

    if (f.Quantite_min.trim()) items.push({ field: "Quantite", operator: ">=", value: f.Quantite_min.trim() });
    if (f.Quantite_max.trim()) items.push({ field: "Quantite", operator: "<=", value: f.Quantite_max.trim() });

    return { items };
  };

  const applyFilterFormToRows = (all: EntreeRow[], f: FilterForm): EntreeRow[] => {
    const lot = f.Lot.trim().toLowerCase();
    const code = f.Code_Prp.trim();
    const produit = f.Produit.trim();
    const calibre = f.Calibre.trim().toLowerCase();
    const qualite = f.Qualite.trim();
    const emballage = f.Emballage.trim();

    const dFrom = f.Date_from.trim() ? dayjs(f.Date_from.trim()) : null;
    const dTo = f.Date_to.trim() ? dayjs(f.Date_to.trim()) : null;

    const qMin = f.Quantite_min.trim() ? Number(f.Quantite_min.trim()) : null;
    const qMax = f.Quantite_max.trim() ? Number(f.Quantite_max.trim()) : null;

    return all.filter((r) => {
      if (lot && !String(r.Lot ?? "").toLowerCase().includes(lot)) return false;
      if (code && String(r.Code_Prp ?? "") !== code) return false;
      if (produit && String(r.Produit ?? "") !== produit) return false;
      if (calibre && !String(r.Calibre ?? "").toLowerCase().includes(calibre)) return false;
      if (qualite && String(r.Qualite ?? "") !== qualite) return false;
      if (emballage && String(r.Emballage ?? "") !== emballage) return false;

      if (dFrom || dTo) {
        const d = r.Date_production ? dayjs(r.Date_production) : null;
        if (!d || !d.isValid()) return false;
        if (dFrom && d.isBefore(dFrom, "day")) return false;
        if (dTo && d.isAfter(dTo, "day")) return false;
      }

      const qty = Number(r.Quantite ?? 0);
      if (qMin != null && Number.isFinite(qMin) && qty < qMin) return false;
      if (qMax != null && Number.isFinite(qMax) && qty > qMax) return false;

      return true;
    });
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
  // Delete selected rows
  // =========================
  const openDeleteSelected = () => {
    if (!selectedIdsArray.length) {
      setErrorMessages(["Select at least one row (checkbox) to delete."]);
      return;
    }
    setErrorMessages([]);
    setInfo("");
    setOpenDeleteRows(true);
  };

  const confirmDeleteSelected = () => {
    const idsToDelete = new Set(selectedIdsArray.map(String));

    // mark for DB delete (only if row existed in lastSavedRows/DB)
    setDeletedIds((prev) => {
      const next = new Set(prev);
      for (const id of idsToDelete) next.add(String(id));
      return next;
    });

    const updated = rows.filter((r) => !idsToDelete.has(String(r.id)));
    const finalRows = updated.length ? updated : [newEmptyRow()];

    setRows(finalRows);
    setSelectedRowIds({ type: "include", ids: new Set() } as any);
    setOpenDeleteRows(false);
    setInfo(`Deleted ${selectedIdsArray.length} row(s) (not saved yet).`);
  };

  // =========================
  // Park -> Supabase parking tables + update entree quantities in DB
  // =========================
  const openParkDialog = () => {
    setInfo("");
    setErrorMessages([]);

    if (!hasAnyMultiFilter(filterForm)) {
      setErrorMessages(["Please click Filter and filter the Entreé table first, then click Park."]);
      return;
    }

    const targets = applyFilterFormToRows(rows, filterForm);
    if (!targets.length) {
      setErrorMessages(["No rows match your filter. Adjust the filter and try again."]);
      return;
    }

    const prepared = targets.map((r) => {
      const maxQty = Number(r.Quantite ?? 0);
      return {
        row: r,
        maxQty,
        reserveQty: maxQty > 0 ? Math.min(1, maxQty) : 0,
      };
    });

    setParkRows(prepared);
    setParkReservationId("");
    setParkClient("");
    setOpenPark(true);
  };

  const confirmPark = async () => {
    try {
      const rid = Number(parkReservationId);
      if (!Number.isFinite(rid) || rid <= 0) {
        setErrorMessages(["Reservation ID must be a positive number."]);
        return;
      }
      if (!parkClient) {
        setErrorMessages(["Please choose a client."]);
        return;
      }

      for (const it of parkRows) {
        if (it.reserveQty < 0) {
          setErrorMessages(["Reserved quantity cannot be negative."]);
          return;
        }
        if (it.reserveQty > it.maxQty) {
          setErrorMessages(["You cannot reserve more than available Quantite."]);
          return;
        }
      }

      const anyReserved = parkRows.some((x) => x.reserveQty > 0);
      if (!anyReserved) {
        setErrorMessages(["Reserve at least 1 quantity on at least one row."]);
        return;
      }

      // check unique reservation id
      const { data: exists, error: exErr } = await supabase
        .from("parking_reservations")
        .select("reservation_id")
        .eq("reservation_id", rid)
        .maybeSingle();
      if (exErr) throw new Error(exErr.message);
      if (exists) {
        setErrorMessages([`Reservation ID ${rid} already exists. Choose another.`]);
        return;
      }

      // insert reservation
      const { error: insResErr } = await supabase.from("parking_reservations").insert({
        reservation_id: rid,
        client: parkClient,
      });
      if (insResErr) throw new Error(insResErr.message);

      // insert items
      const items: ParkingItem[] = parkRows
        .filter((p) => p.reserveQty > 0)
        .map((p) => ({
          entreeRowId: p.row.id,
          Lot: p.row.Lot,
          Code_Prp: String(p.row.Code_Prp ?? ""),
          Produit: String(p.row.Produit ?? ""),
          Calibre: String(p.row.Calibre ?? ""),
          Qualite: String(p.row.Qualite ?? ""),
          reservedQty: p.reserveQty,
        }));

      const itemPayload = items.map((it) => ({
        reservation_id: rid,
        entree_id: it.entreeRowId || null,
        lot: it.Lot || null,
        code_prp: it.Code_Prp || null,
        produit: it.Produit || null,
        calibre: it.Calibre || null,
        qualite: it.Qualite || null,
        reserved_qty: it.reservedQty,
      }));

      const { error: insItemsErr } = await supabase.from("parking_items").insert(itemPayload);
      if (insItemsErr) throw new Error(insItemsErr.message);

      // update entree quantities in DB + local grid
      const updatedRows = rows.map((r) => {
        const match = parkRows.find((p) => p.row.id === r.id);
        if (!match) return r;
        const current = Number(r.Quantite ?? 0);
        const reserved = Number(match.reserveQty ?? 0);
        return { ...r, Quantite: Math.max(0, current - reserved) };
      });

      // push updated quantities to DB (only for affected rows)
      const affected = parkRows.filter((p) => p.reserveQty > 0).map((p) => p.row.id);
      const affectedMap = new Map(updatedRows.map((r) => [r.id, r]));
      const updates = affected.map((id) => {
        const r = affectedMap.get(id)!;
        return { id: r.id, quantite: r.Quantite };
      });

      const { error: updErr } = await supabase.from("entree").upsert(updates, { onConflict: "id" });
      if (updErr) throw new Error(updErr.message);

      setRows(updatedRows);
      setLastSavedRows(updatedRows); // because DB is already updated
      setOpenPark(false);
      setErrorMessages([]);
      setInfo(`Parked reservation #${rid} for ${parkClient}. Quantities updated.`);
    } catch (e: any) {
      setErrorMessages([e?.message ?? "Park failed."]);
    }
  };

  // Helper UI row
  const FilterRow = ({ children }: { children: React.ReactNode }) => (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
      {children}
    </Stack>
  );

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h5">Entreé</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Shared database mode (Supabase)
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          {hasUnsavedChanges ? <Chip color="warning" label="Unsaved changes" /> : <Chip color="success" label="Saved" />}
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

          <Button variant="contained" onClick={openNewEntry} disabled={!canEditRole}>
            New Entry
          </Button>

          <Button variant="outlined" onClick={handleSave} disabled={!canEditRole || !hasUnsavedChanges}>
            Save
          </Button>
          <Button variant="text" onClick={handleCancel} disabled={!canEditRole}>
            Cancel
          </Button>

          <Button variant="outlined" color="error" onClick={openDeleteSelected} disabled={!canEditRole}>
            Delete Row(s)
          </Button>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <Button variant="outlined" onClick={openFilterDialog}>
            Filter
          </Button>
          <Button variant="text" onClick={clearFilter}>
            Clear Filter
          </Button>

          <Button variant="contained" color="secondary" onClick={openParkDialog} disabled={!canEditRole}>
            Park
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
        <Box sx={{ height: 640, width: "100%" }}>
          <DataGrid
            apiRef={apiRef}
            rows={rows}
            columns={columns}
            getRowId={(r) => r.id}
            initialState={{ density: "compact" }}
            editMode="cell"
            checkboxSelection
            disableRowSelectionOnClick
            rowSelectionModel={selectedRowIds}
            onRowSelectionModelChange={(m) => setSelectedRowIds(m as any)}
            filterModel={filterModel}
            onFilterModelChange={(m) => setFilterModel(m)}
            loading={loading}
            slots={{ toolbar: GridToolbar }}
            slotProps={{ toolbar: { showQuickFilter: false } as any }}
            onCellClick={handleCellClick}
            processRowUpdate={(newRow: EntreeRow) => {
              const cleaned: EntreeRow = {
                ...newRow,
                Calibre: newRow.Calibre?.trim() ? newRow.Calibre : "nan",
              };
              setRows((prev) => prev.map((r) => (r.id === cleaned.id ? cleaned : r)));
              return cleaned;
            }}
            isCellEditable={() => canEditRole}
          />
        </Box>
      </Paper>

      {/* DELETE dialog */}
      <Dialog open={openDeleteRows} onClose={() => setOpenDeleteRows(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete selected rows</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete <b>{selectedIdsArray.length}</b> row(s)?
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
            This will remove them from the grid. Click <b>Save</b> to persist to DB.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDeleteRows(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDeleteSelected}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* FILTER dialog */}
      <Dialog open={openFilter} onClose={() => setOpenFilter(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Filter Entreé</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          <FilterRow>
            <TextField
              label="Lot contains"
              value={filterForm.Lot}
              onChange={(e) => setFilterForm((p) => ({ ...p, Lot: e.target.value }))}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Code_Prp</InputLabel>
              <Select
                label="Code_Prp"
                value={filterForm.Code_Prp}
                onChange={(e) => setFilterForm((p) => ({ ...p, Code_Prp: String(e.target.value) }))}
              >
                <MenuItem value="">(any)</MenuItem>
                {CODE_PRP_OPTIONS.map((o) => (
                  <MenuItem key={o} value={o}>
                    {o}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

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
              <InputLabel>Qualite</InputLabel>
              <Select
                label="Qualite"
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
              label="Date from"
              type="date"
              value={filterForm.Date_from}
              onChange={(e) => setFilterForm((p) => ({ ...p, Date_from: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Date to"
              type="date"
              value={filterForm.Date_to}
              onChange={(e) => setFilterForm((p) => ({ ...p, Date_to: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

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

      {/* New Entry dialog */}
      <Dialog open={openNew} onClose={() => setOpenNew(false)} maxWidth="md" fullWidth>
        <DialogTitle>New Entry</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField label="Lot" value={draft.Lot} onChange={(e) => setDraft((p) => ({ ...p, Lot: e.target.value }))} fullWidth />
              <FormControl fullWidth>
                <InputLabel>Code_Prp</InputLabel>
                <Select label="Code_Prp" value={draft.Code_Prp} onChange={(e) => setDraft((p) => ({ ...p, Code_Prp: e.target.value as any }))}>
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
                <Select label="Produit" value={draft.Produit} onChange={(e) => setDraft((p) => ({ ...p, Produit: e.target.value as any }))}>
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
                <Select label="Calibre" value={draft.Calibre} onChange={(e) => setDraft((p) => ({ ...p, Calibre: e.target.value as string }))}>
                  <MenuItem value="nan">nan</MenuItem>
                  {draft.Produit ? CALIBRE_BY_PRODUIT[draft.Produit].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>) : null}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Qualite</InputLabel>
                <Select label="Qualite" value={draft.Qualite} onChange={(e) => setDraft((p) => ({ ...p, Qualite: e.target.value as any }))}>
                  {QUALITE_OPTIONS.map((o) => (
                    <MenuItem key={o} value={o}>
                      {o}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField label="% Ctrl" value={draft["%_Ctrl"] ?? ""} onChange={(e) => setDraft((p) => ({ ...p, "%_Ctrl": toNumberOrNull(e.target.value) }))} fullWidth />
              <TextField label="Gr mn" value={draft.Gr_mn ?? ""} onChange={(e) => setDraft((p) => ({ ...p, Gr_mn: toNumberOrNull(e.target.value) }))} fullWidth />
              <TextField label="Gr mx" value={draft.Gr_mx ?? ""} onChange={(e) => setDraft((p) => ({ ...p, Gr_mx: toNumberOrNull(e.target.value) }))} fullWidth />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Emballage</InputLabel>
                <Select label="Emballage" value={draft.Emballage} onChange={(e) => setDraft((p) => ({ ...p, Emballage: e.target.value as any }))}>
                  <MenuItem value="">(empty)</MenuItem>
                  {EMBALLAGE_OPTIONS.map((o) => (
                    <MenuItem key={o} value={o}>
                      {o}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField label="PU" value={draft.PU ?? ""} onChange={(e) => setDraft((p) => ({ ...p, PU: toNumberOrNull(e.target.value) }))} fullWidth />
              <TextField label="Colis" value={draft.Colis ?? ""} onChange={(e) => setDraft((p) => ({ ...p, Colis: toNumberOrNull(e.target.value) }))} fullWidth />
              <TextField label="Quantite" value={draft.Quantite ?? ""} onChange={(e) => setDraft((p) => ({ ...p, Quantite: toNumberOrNull(e.target.value) }))} fullWidth />
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

      {/* Park dialog */}
      <Dialog open={openPark} onClose={() => setOpenPark(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Park Reservation</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField label="Reservation ID (number)" value={parkReservationId} onChange={(e) => setParkReservationId(e.target.value)} fullWidth />

              <FormControl fullWidth>
                <InputLabel>Client</InputLabel>
                <Select label="Client" value={parkClient} onChange={(e) => setParkClient(e.target.value)}>
                  <MenuItem value="">(choose)</MenuItem>
                  {CLIENTS.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Paper variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Lot</TableCell>
                    <TableCell>Produit</TableCell>
                    <TableCell>Calibre</TableCell>
                    <TableCell align="right">Available</TableCell>
                    <TableCell align="right">Reserve</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parkRows.map((p, idx) => (
                    <TableRow key={p.row.id}>
                      <TableCell>{p.row.Lot}</TableCell>
                      <TableCell>{p.row.Produit}</TableCell>
                      <TableCell>{p.row.Calibre}</TableCell>
                      <TableCell align="right">{p.maxQty}</TableCell>
                      <TableCell align="right" sx={{ width: 180 }}>
                        <TextField
                          value={p.reserveQty}
                          type="number"
                          inputProps={{ min: 0, max: p.maxQty }}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setParkRows((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, reserveQty: Number.isFinite(v) ? v : 0 } : x
                              )
                            );
                          }}
                          fullWidth
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenPark(false)}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={confirmPark}>
            Confirm Park
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

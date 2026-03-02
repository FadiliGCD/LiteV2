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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  TextField,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";

import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

// -----------------------------
// Types (UI)
// -----------------------------
type ParkingItem = {
  id?: string;
  entreeRowId: string;
  Lot: string;
  Code_Prp: string;
  Produit: string;
  Calibre: string;
  Qualite: string;
  reservedQty: number;
};

type ParkingReservation = {
  reservationId: number;
  client: string;
  createdAt: string;
  items: ParkingItem[];
};

// minimal Entree row type (only fields we need)
type EntreeRow = {
  id: string;
  Lot?: string;
  Code_Prp?: string;
  Date_production?: string;
  Produit?: string;
  Calibre?: string;
  Qualite?: string;
  "%_Ctrl"?: number | null;
  Gr_mn?: number | null;
  Gr_mx?: number | null;
  Emballage?: string;
  PU?: number | null;
  Colis?: number | null;
  Quantite?: number | null;
};

type SortieInsert = {
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

// example clients for now
const CLIENTS = ["Client Atlas", "Client Marina", "Client Sahara"];

// -----------------------------
// Utilities
// -----------------------------
function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
function sumQty(items: ParkingItem[]) {
  return items.reduce((acc, it) => acc + Number(it.reservedQty ?? 0), 0);
}
function safeNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function todayISO() {
  return dayjs().format("YYYY-MM-DD");
}
function normalizeEntreeId(id: unknown) {
  return String(id ?? "").trim();
}
function groupSumByEntreeId(items: ParkingItem[]) {
  const m = new Map<string, number>();
  for (const it of items) {
    const id = normalizeEntreeId(it.entreeRowId);
    if (!id) continue;
    const prev = m.get(id) ?? 0;
    m.set(id, prev + safeNum(it.reservedQty, 0));
  }
  return m;
}

// reserved_colis ≈ (entree.Colis / entree.Quantite) * reservedQty
function calcReservedColis(entree: EntreeRow | undefined, reservedQty: number) {
  const colis = safeNum(entree?.Colis, 0);
  const quantite = safeNum(entree?.Quantite, 0);
  if (colis <= 0 || quantite <= 0 || reservedQty <= 0) return 0;
  return (colis / quantite) * reservedQty;
}

// Split a TOTAL sell qty across items (top to bottom)
function distributeSell(items: ParkingItem[], totalSell: number) {
  let remaining = Math.max(0, totalSell);
  return items.map((it) => {
    const max = safeNum(it.reservedQty, 0);
    const sellQty = Math.min(max, remaining);
    remaining -= sellQty;
    return { item: it, sellQty };
  });
}

// -----------------------------
// Supabase helpers
// -----------------------------
async function fetchParking(): Promise<ParkingReservation[]> {
  const { data: res, error: resErr } = await supabase
    .from("parking_reservations")
    .select("reservation_id, client, created_at")
    .order("created_at", { ascending: false });

  if (resErr) throw new Error(resErr.message);

  const reservationIds = (res ?? []).map((r: any) => Number(r.reservation_id));
  if (!reservationIds.length) return [];

  const { data: items, error: itemsErr } = await supabase
    .from("parking_items")
    .select("id, reservation_id, entree_id, lot, code_prp, produit, calibre, qualite, reserved_qty")
    .in("reservation_id", reservationIds);

  if (itemsErr) throw new Error(itemsErr.message);

  const itemsByRes = new Map<number, ParkingItem[]>();
  for (const it of items ?? []) {
    const rid = Number((it as any).reservation_id);
    const arr = itemsByRes.get(rid) ?? [];
    arr.push({
      id: String((it as any).id),
      entreeRowId: String((it as any).entree_id ?? ""),
      Lot: String((it as any).lot ?? ""),
      Code_Prp: String((it as any).code_prp ?? ""),
      Produit: String((it as any).produit ?? ""),
      Calibre: String((it as any).calibre ?? "nan"),
      Qualite: String((it as any).qualite ?? "nan"),
      reservedQty: safeNum((it as any).reserved_qty, 0),
    });
    itemsByRes.set(rid, arr);
  }

  return (res ?? []).map((r: any) => ({
    reservationId: Number(r.reservation_id),
    client: String(r.client ?? ""),
    createdAt: String(r.created_at ?? ""),
    items: itemsByRes.get(Number(r.reservation_id)) ?? [],
  }));
}

async function reservationIdExists(reservationId: number) {
  const { data, error } = await supabase
    .from("parking_reservations")
    .select("reservation_id")
    .eq("reservation_id", reservationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return !!data;
}

async function updateReservationId(oldId: number, newId: number) {
  const { error: u1 } = await supabase
    .from("parking_reservations")
    .update({ reservation_id: newId })
    .eq("reservation_id", oldId);
  if (u1) throw new Error(u1.message);

  const { error: u2 } = await supabase
    .from("parking_items")
    .update({ reservation_id: newId })
    .eq("reservation_id", oldId);
  if (u2) throw new Error(u2.message);
}

async function updateReservationClient(reservationId: number, client: string) {
  const { error } = await supabase
    .from("parking_reservations")
    .update({ client })
    .eq("reservation_id", reservationId);
  if (error) throw new Error(error.message);
}

async function replaceReservationItems(reservationId: number, items: ParkingItem[]) {
  const { error: delErr } = await supabase
    .from("parking_items")
    .delete()
    .eq("reservation_id", reservationId);
  if (delErr) throw new Error(delErr.message);

  const payload = items.map((it) => ({
    reservation_id: reservationId,
    entree_id: normalizeEntreeId(it.entreeRowId) || null,
    lot: it.Lot || null,
    code_prp: it.Code_Prp || null,
    produit: it.Produit || null,
    calibre: it.Calibre || null,
    qualite: it.Qualite || null,
    reserved_qty: safeNum(it.reservedQty, 0),
  }));

  const { error: insErr } = await supabase.from("parking_items").insert(payload);
  if (insErr) throw new Error(insErr.message);
}

async function deleteReservation(reservationId: number) {
  await supabase.from("parking_items").delete().eq("reservation_id", reservationId);
  const { error } = await supabase.from("parking_reservations").delete().eq("reservation_id", reservationId);
  if (error) throw new Error(error.message);
}

async function fetchEntreeByIds(ids: string[]): Promise<Map<string, EntreeRow>> {
  const clean = Array.from(new Set(ids.map((x) => String(x).trim()).filter(Boolean)));
  if (!clean.length) return new Map();

  const { data, error } = await supabase
    .from("entree")
    .select("id, lot, code_prp, date_production, produit, calibre, qualite, pct_ctrl, gr_mn, gr_mx, emballage, pu, colis, quantite")
    .in("id", clean);

  if (error) throw new Error(error.message);

  const m = new Map<string, EntreeRow>();
  for (const r of data ?? []) {
    m.set(String((r as any).id), {
      id: String((r as any).id),
      Lot: String((r as any).lot ?? ""),
      Code_Prp: String((r as any).code_prp ?? ""),
      Date_production: (r as any).date_production ? String((r as any).date_production) : "",
      Produit: String((r as any).produit ?? ""),
      Calibre: String((r as any).calibre ?? "nan"),
      Qualite: String((r as any).qualite ?? "nan"),
      "%_Ctrl": (r as any).pct_ctrl ?? null,
      Gr_mn: (r as any).gr_mn ?? null,
      Gr_mx: (r as any).gr_mx ?? null,
      Emballage: String((r as any).emballage ?? ""),
      PU: (r as any).pu ?? null,
      Colis: (r as any).colis ?? null,
      Quantite: (r as any).quantite ?? null,
    });
  }
  return m;
}

async function applyEntreeQuantiteDeltas(deltas: Map<string, number>) {
  const ids = Array.from(deltas.keys());
  if (!ids.length) return;

  const entreeMap = await fetchEntreeByIds(ids);

  for (const [id, delta] of deltas.entries()) {
    if (delta <= 0) continue;
    const current = safeNum(entreeMap.get(id)?.Quantite, 0);
    if (current < delta) {
      throw new Error(`Not enough stock in Entree for row ${id}. Needed +${delta}, available ${current}.`);
    }
  }

  const updates = [];
  for (const [id, delta] of deltas.entries()) {
    const row = entreeMap.get(id);
    const current = safeNum(row?.Quantite, 0);
    const next = current - delta;
    updates.push({ id, quantite: Math.max(0, next) });
  }

  const { error } = await supabase.from("entree").upsert(updates, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

// -----------------------------
// Page
// -----------------------------
export default function ParkingPage() {
  const nav = useNavigate();

  const [reservations, setReservations] = React.useState<ParkingReservation[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [info, setInfo] = React.useState<string>("");
  const [error, setError] = React.useState<string>("");

  // cached entree rows for totals + data view
  const [entreeCache, setEntreeCache] = React.useState<Map<string, EntreeRow>>(new Map());

  // delete confirm
  const [openDelete, setOpenDelete] = React.useState(false);

  // modify dialog
  const [openModify, setOpenModify] = React.useState(false);
  const [editReservationId, setEditReservationId] = React.useState<string>("");
  const [editClient, setEditClient] = React.useState<string>("");
  const [editItems, setEditItems] = React.useState<ParkingItem[]>([]);

  // DATA dialog
  const [openData, setOpenData] = React.useState(false);

  // SELL dialog (full vs partial)
  const [openSell, setOpenSell] = React.useState(false);
  const [sellMode, setSellMode] = React.useState<"full" | "partial">("full");
  const [sellTotal, setSellTotal] = React.useState<string>("");
  const [sellItems, setSellItems] = React.useState<Array<{ item: ParkingItem; sellQty: number }>>([]);

  const selected = React.useMemo(
    () => reservations.find((r) => r.reservationId === selectedId) ?? null,
    [reservations, selectedId]
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await fetchParking();
      setReservations(list);

      const ids = Array.from(
        new Set(
          list
            .flatMap((r) => r.items ?? [])
            .map((it) => normalizeEntreeId(it.entreeRowId))
            .filter(Boolean)
        )
      );

      const map = await fetchEntreeByIds(ids);
      setEntreeCache(map);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load parking.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (selectedId == null) return;
    const exists = reservations.some((r) => r.reservationId === selectedId);
    if (!exists) setSelectedId(null);
  }, [reservations, selectedId]);

  const columns = React.useMemo<GridColDef[]>(() => {
    return [
      { field: "reservationId", headerName: "Reservation ID", width: 140 },
      { field: "client", headerName: "Client", width: 220 },
      { field: "createdAt", headerName: "Created At", width: 220 },
      { field: "totalColis", headerName: "Total Colis", width: 120, type: "number" },
      { field: "totalQty", headerName: "Total Qty", width: 110, type: "number" },
    ];
  }, []);

  const gridRows = React.useMemo(() => {
    return reservations.map((r) => {
      const totalColis = (r.items ?? []).reduce((acc, it) => {
        const e = entreeCache.get(normalizeEntreeId(it.entreeRowId));
        return acc + calcReservedColis(e, safeNum(it.reservedQty, 0));
      }, 0);

      return {
        id: r.reservationId,
        reservationId: r.reservationId,
        client: r.client,
        createdAt: fmtDate(r.createdAt),
        totalColis: Number(totalColis.toFixed(2)),
        totalQty: sumQty(r.items ?? []),
      };
    });
  }, [reservations, entreeCache]);

  const refresh = async () => {
    setInfo("");
    setError("");
    await load();
    setInfo("Refreshed.");
  };

  // -----------------------------
  // Data dialog
  // -----------------------------
  const openDataDialog = async () => {
    if (!selected) return;
    setError("");
    setInfo("");

    const ids = Array.from(
      new Set((selected.items ?? []).map((x) => normalizeEntreeId(x.entreeRowId)).filter(Boolean))
    );

    const missing = ids.filter((id) => !entreeCache.has(id));
    if (missing.length) {
      try {
        const add = await fetchEntreeByIds(missing);
        setEntreeCache((prev) => {
          const next = new Map(prev);
          for (const [k, v] of add.entries()) next.set(k, v);
          return next;
        });
      } catch (e: any) {
        setError(e?.message ?? "Failed to load Entree details for Data view.");
      }
    }

    setOpenData(true);
  };

  // -----------------------------
  // Modify dialog logic
  // -----------------------------
  const openModifyDialog = () => {
    if (!selected) return;
    setInfo("");
    setError("");

    setEditReservationId(String(selected.reservationId));
    setEditClient(selected.client ?? "");
    setEditItems(
      (selected.items ?? []).map((it) => ({
        ...it,
        entreeRowId: String(it.entreeRowId ?? ""),
        Lot: String(it.Lot ?? ""),
        Code_Prp: String(it.Code_Prp ?? ""),
        Produit: String(it.Produit ?? ""),
        Calibre: String(it.Calibre ?? ""),
        Qualite: String(it.Qualite ?? ""),
        reservedQty: safeNum(it.reservedQty, 0),
      }))
    );

    setOpenModify(true);
  };

  const validateEdit = () => {
    const newId = Number(editReservationId);
    if (!Number.isFinite(newId) || newId <= 0) return "Reservation ID must be a positive number.";
    if (!editClient) return "Please choose a client.";
    if (!editItems.length) return "Reservation must contain at least 1 item.";

    for (const it of editItems) {
      const q = safeNum(it.reservedQty, 0);
      if (q < 0) return "Reserved Qty cannot be negative.";
    }
    const anyPositive = editItems.some((it) => safeNum(it.reservedQty, 0) > 0);
    if (!anyPositive) return "At least one item must have Reserved Qty > 0.";

    return "";
  };

  const confirmModify = async () => {
    if (!selected) return;

    const msg = validateEdit();
    if (msg) {
      setError(msg);
      return;
    }

    try {
      setError("");
      setInfo("");

      const newId = Number(editReservationId);
      const oldId = selected.reservationId;

      const cleanedItems: ParkingItem[] = editItems.map((it) => ({
        entreeRowId: normalizeEntreeId(it.entreeRowId),
        Lot: String(it.Lot ?? ""),
        Code_Prp: String(it.Code_Prp ?? ""),
        Produit: String(it.Produit ?? ""),
        Calibre: String(it.Calibre ?? ""),
        Qualite: String(it.Qualite ?? ""),
        reservedQty: safeNum(it.reservedQty, 0),
      }));

      const before = groupSumByEntreeId(selected.items ?? []);
      const after = groupSumByEntreeId(cleanedItems);

      const deltas = new Map<string, number>();
      const keys = new Set<string>([...before.keys(), ...after.keys()]);
      for (const id of keys) {
        const b = before.get(id) ?? 0;
        const a = after.get(id) ?? 0;
        const delta = a - b;
        if (delta !== 0) deltas.set(id, delta);
      }

      await applyEntreeQuantiteDeltas(deltas);

      if (newId !== oldId) {
        const exists = await reservationIdExists(newId);
        if (exists) {
          setError(`Reservation ID ${newId} already exists. Choose another.`);
          return;
        }
        await updateReservationId(oldId, newId);
      }

      await updateReservationClient(newId, editClient);
      await replaceReservationItems(newId, cleanedItems);

      setOpenModify(false);
      setSelectedId(newId);
      await load();
      setInfo(`Reservation updated (#${newId}). Entree quantities synced.`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to update reservation.");
    }
  };

  // -----------------------------
  // Delete dialog
  // -----------------------------
  const openDeleteDialog = () => {
    setInfo("");
    setError("");
    setOpenDelete(true);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    try {
      setError("");
      setInfo("");

      const before = groupSumByEntreeId(selected.items ?? []);
      const deltas = new Map<string, number>();
      for (const [id, qty] of before.entries()) {
        if (qty !== 0) deltas.set(id, -qty);
      }
      await applyEntreeQuantiteDeltas(deltas);

      await deleteReservation(selected.reservationId);

      setSelectedId(null);
      setOpenDelete(false);
      await load();
      setInfo(`Deleted reservation #${selected.reservationId}. Entree quantities restored.`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete reservation.");
    }
  };

  // ✅ Send -> Rapport de charge
  const handleSend = () => {
    if (!selected) return;
    setError("");
    setInfo("");
    nav(`/rapport-charge?rid=${selected.reservationId}`);
  };

  // -----------------------------
  // SELL (Full vs Partial)
  // -----------------------------
  const openSellDialog = () => {
    if (!selected) return;
    setError("");
    setInfo("");

    const totalReserved = sumQty(selected.items ?? []);

    setSellMode("full");
    setSellTotal(String(totalReserved));
    setSellItems(distributeSell(selected.items ?? [], totalReserved));

    setOpenSell(true);
  };

  const onSellModeChange = (mode: "full" | "partial") => {
    if (!selected) return;
    const totalReserved = sumQty(selected.items ?? []);

    setSellMode(mode);

    if (mode === "full") {
      setSellTotal(String(totalReserved));
      setSellItems(distributeSell(selected.items ?? [], totalReserved));
    } else {
      setSellTotal(String(totalReserved));
      setSellItems(distributeSell(selected.items ?? [], totalReserved));
    }
  };

  const onSellTotalChange = (val: string) => {
    if (!selected) return;
    const totalReserved = sumQty(selected.items ?? []);
    const n = safeNum(val, 0);
    const clamped = Math.max(0, Math.min(totalReserved, n));

    setSellTotal(String(val));
    setSellItems(distributeSell(selected.items ?? [], clamped));
  };

  const confirmSell = async () => {
    if (!selected) return;

    try {
      setError("");
      setInfo("");

      const totalReserved = sumQty(selected.items ?? []);
      const wantSellTotal =
        sellMode === "full"
          ? totalReserved
          : Math.max(0, Math.min(totalReserved, safeNum(sellTotal, 0)));

      if (wantSellTotal <= 0) {
        setError("Enter a sell quantity greater than 0.");
        return;
      }

      const entreeIds = sellItems
        .filter((x) => safeNum(x.sellQty, 0) > 0)
        .map((x) => String(x.item.entreeRowId ?? "").trim())
        .filter(Boolean);

      const entreeMap = await fetchEntreeByIds(entreeIds);

      const payload: SortieInsert[] = sellItems
        .filter((x) => safeNum(x.sellQty, 0) > 0)
        .map((x) => {
          const it = x.item;
          const e = entreeMap.get(String(it.entreeRowId));

          return {
            date_chg: todayISO(),
            dossier: "",
            client: selected.client ?? "",
            mat_transport: "",

            lot: String(e?.Lot ?? it.Lot ?? "") || null,
            date_production: String(e?.Date_production ?? "") || null,
            produit: String(e?.Produit ?? it.Produit ?? "") || null,
            calibre: String(e?.Calibre ?? it.Calibre ?? "nan") || null,
            qualite: String(e?.Qualite ?? it.Qualite ?? "nan") || null,

            pct_ctrl: (e?.["%_Ctrl"] ?? null) as any,
            gr_mn: (e?.Gr_mn ?? null) as any,
            gr_mx: (e?.Gr_mx ?? null) as any,

            emballage: String(e?.Emballage ?? "") || null,
            pu: (e?.PU ?? null) as any,
            colis: (e?.Colis ?? null) as any,
            quantite: safeNum(x.sellQty, 0),
          };
        });

      const { error: insErr } = await supabase.from("sortie").insert(payload);
      if (insErr) throw new Error(insErr.message);

      for (const x of sellItems) {
        const it = x.item;
        const sold = safeNum(x.sellQty, 0);
        if (sold <= 0) continue;

        const max = safeNum(it.reservedQty, 0);
        const remaining = Math.max(0, max - sold);

        if (!it.id) continue;

        if (remaining === 0) {
          const { error: delItemErr } = await supabase.from("parking_items").delete().eq("id", it.id);
          if (delItemErr) throw new Error(delItemErr.message);
        } else {
          const { error: updItemErr } = await supabase
            .from("parking_items")
            .update({ reserved_qty: remaining })
            .eq("id", it.id);
          if (updItemErr) throw new Error(updItemErr.message);
        }
      }

      const { data: left, error: leftErr } = await supabase
        .from("parking_items")
        .select("id")
        .eq("reservation_id", selected.reservationId)
        .limit(1);

      if (leftErr) throw new Error(leftErr.message);

      if (!left || left.length === 0) {
        const { error: delResErr } = await supabase
          .from("parking_reservations")
          .delete()
          .eq("reservation_id", selected.reservationId);
        if (delResErr) throw new Error(delResErr.message);
      }

      setOpenSell(false);
      setSelectedId(null);
      await load();

      setInfo(`Sold ${wantSellTotal} from reservation #${selected.reservationId}. Added ${payload.length} item(s) to Sortie.`);
    } catch (e: any) {
      setError(e?.message ?? "Sell failed.");
    }
  };

  // -----------------------------
  // Modify dialog item helpers
  // -----------------------------
  const updateItem = (idx: number, patch: Partial<ParkingItem>) => {
    setEditItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeItem = (idx: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h5">Parking</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Shared database mode (Supabase). Select a reservation to enable actions.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip variant="outlined" label={`Reservations: ${reservations.length}`} />
          {selected ? <Chip color="info" label={`Selected: #${selected.reservationId}`} /> : <Chip label="No selection" />}
          {loading ? <Chip color="info" label="Loading..." /> : <Chip color="success" label="Live" />}
        </Stack>
      </Stack>

      <Paper sx={{ p: 1.2, borderRadius: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Button variant="outlined" onClick={refresh} disabled={loading}>
            Refresh
          </Button>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <Button variant="outlined" onClick={openDataDialog} disabled={!selected}>
            Data
          </Button>

          <Button variant="contained" onClick={openModifyDialog} disabled={!selected}>
            Modify
          </Button>

          <Button variant="outlined" color="error" onClick={openDeleteDialog} disabled={!selected}>
            Delete
          </Button>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <Button variant="contained" color="secondary" onClick={handleSend} disabled={!selected}>
            Send
          </Button>

          <Button variant="contained" color="success" onClick={openSellDialog} disabled={!selected}>
            Sell
          </Button>
        </Stack>
      </Paper>

      {info ? <Alert severity="success">{info}</Alert> : null}
      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Paper sx={{ p: 1.2, borderRadius: 3 }}>
        <Box sx={{ height: 420, width: "100%" }}>
          <DataGrid
            rows={gridRows}
            columns={columns}
            getRowId={(r) => r.id}
            disableRowSelectionOnClick={false}
            hideFooterSelectedRowCount
            initialState={{ density: "compact" }}
            loading={loading}
            onRowClick={(params) => {
              setSelectedId(Number(params.row.reservationId));
              setInfo("");
              setError("");
            }}
          />
        </Box>
      </Paper>

      {/* SELL dialog */}
      <Dialog open={openSell} onClose={() => setOpenSell(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Sell Reservation</DialogTitle>
        <DialogContent>
          {!selected ? (
            <Typography variant="body2">No reservation selected.</Typography>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <Chip label={`Reservation #${selected.reservationId}`} />
                <Chip label={`Client: ${selected.client}`} />
                <Chip label={`Total Reserved Qty: ${sumQty(selected.items ?? [])}`} />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Sell Mode</InputLabel>
                  <Select label="Sell Mode" value={sellMode} onChange={(e) => onSellModeChange(e.target.value as any)}>
                    <MenuItem value="full">Sell Full Quantity</MenuItem>
                    <MenuItem value="partial">Sell Partial Quantity</MenuItem>
                  </Select>
                </FormControl>

                {sellMode === "partial" ? (
                  <TextField
                    label="Sell quantity (total)"
                    type="number"
                    value={sellTotal}
                    onChange={(e) => onSellTotalChange(e.target.value)}
                    inputProps={{ min: 0, max: sumQty(selected.items ?? []) }}
                    fullWidth
                  />
                ) : (
                  <TextField label="Sell quantity (total)" value={sumQty(selected.items ?? [])} fullWidth disabled />
                )}
              </Stack>

              <Paper variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Lot</TableCell>
                      <TableCell>Produit</TableCell>
                      <TableCell>Calibre</TableCell>
                      <TableCell align="right">Reserved</TableCell>
                      <TableCell align="right">Sell Qty</TableCell>
                      <TableCell align="right">Remaining</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sellItems.map((x, idx) => {
                      const reserved = safeNum(x.item.reservedQty, 0);
                      const sellQty = safeNum(x.sellQty, 0);
                      const remaining = Math.max(0, reserved - sellQty);
                      return (
                        <TableRow key={(x.item.id ?? "") + idx}>
                          <TableCell>{x.item.Lot}</TableCell>
                          <TableCell>{x.item.Produit}</TableCell>
                          <TableCell>{x.item.Calibre}</TableCell>
                          <TableCell align="right">{reserved}</TableCell>
                          <TableCell align="right">{sellQty}</TableCell>
                          <TableCell align="right">{remaining}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Paper>

              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Partial sell automatically distributes the sell quantity across items from top to bottom.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenSell(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={confirmSell} disabled={!selected}>
            Confirm Sell
          </Button>
        </DialogActions>
      </Dialog>

      {/* DATA dialog */}
      <Dialog open={openData} onClose={() => setOpenData(false)} maxWidth="xl" fullWidth>
        <DialogTitle>Reservation Data</DialogTitle>
        <DialogContent>
          {!selected ? (
            <Typography variant="body2">No reservation selected.</Typography>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <Chip label={`Reservation #${selected.reservationId}`} />
                <Chip label={`Client: ${selected.client}`} />
                <Chip label={`Created: ${fmtDate(selected.createdAt)}`} />
              </Stack>

              <Paper variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Lot</TableCell>
                      <TableCell>Date production</TableCell>
                      <TableCell>Produit</TableCell>
                      <TableCell>Calibre</TableCell>
                      <TableCell>Qualite</TableCell>
                      <TableCell align="right">% Ctrl</TableCell>
                      <TableCell align="right">Gr mn</TableCell>
                      <TableCell align="right">Gr mx</TableCell>
                      <TableCell>Emballage</TableCell>
                      <TableCell align="right">PU</TableCell>
                      <TableCell align="right">Colis</TableCell>
                      <TableCell align="right">Reserved Qty</TableCell>
                      <TableCell align="right">Reserved Colis</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selected.items ?? []).map((it, idx) => {
                      const e = entreeCache.get(normalizeEntreeId(it.entreeRowId));
                      const reservedColis = calcReservedColis(e, safeNum(it.reservedQty, 0));
                      return (
                        <TableRow key={(it.id ?? "") + idx}>
                          <TableCell>{String(e?.Lot ?? it.Lot ?? "")}</TableCell>
                          <TableCell>{String(e?.Date_production ?? "")}</TableCell>
                          <TableCell>{String(e?.Produit ?? it.Produit ?? "")}</TableCell>
                          <TableCell>{String(e?.Calibre ?? it.Calibre ?? "nan")}</TableCell>
                          <TableCell>{String(e?.Qualite ?? it.Qualite ?? "nan")}</TableCell>
                          <TableCell align="right">{e?.["%_Ctrl"] == null ? "" : `${e["%_Ctrl"]}%`}</TableCell>
                          <TableCell align="right">{e?.Gr_mn ?? ""}</TableCell>
                          <TableCell align="right">{e?.Gr_mx ?? ""}</TableCell>
                          <TableCell>{String(e?.Emballage ?? "")}</TableCell>
                          <TableCell align="right">{e?.PU ?? ""}</TableCell>
                          <TableCell align="right">{e?.Colis ?? ""}</TableCell>
                          <TableCell align="right">{safeNum(it.reservedQty, 0)}</TableCell>
                          <TableCell align="right">{Number(reservedColis.toFixed(2))}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Paper>

              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Total Colis is estimated proportionally: (Entree.Colis / Entree.Quantite) × ReservedQty.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenData(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* DELETE dialog */}
      <Dialog open={openDelete} onClose={() => setOpenDelete(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete reservation</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete reservation <b>{selected ? `#${selected.reservationId}` : ""}</b>?
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
            This will RESTORE quantities back to Entreé.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDelete(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete} disabled={!selected}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODIFY dialog */}
      <Dialog open={openModify} onClose={() => setOpenModify(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Modify reservation</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Reservation ID (number)"
                value={editReservationId}
                onChange={(e) => setEditReservationId(e.target.value)}
                fullWidth
              />

              <FormControl fullWidth>
                <InputLabel>Client</InputLabel>
                <Select label="Client" value={editClient} onChange={(e) => setEditClient(String(e.target.value))}>
                  <MenuItem value="">(choose)</MenuItem>
                  {CLIENTS.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Paper variant="outlined" sx={{ borderRadius: 2, p: 1 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Reservation Items
              </Typography>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 160 }}>Lot</TableCell>
                    <TableCell sx={{ width: 150 }}>Code_Prp</TableCell>
                    <TableCell sx={{ width: 180 }}>Produit</TableCell>
                    <TableCell sx={{ width: 140 }}>Calibre</TableCell>
                    <TableCell sx={{ width: 120 }}>Qualite</TableCell>
                    <TableCell sx={{ width: 150 }} align="right">
                      Reserved Qty
                    </TableCell>
                    <TableCell sx={{ width: 110 }} align="right">
                      Action
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {editItems.map((it, idx) => (
                    <TableRow key={`${it.entreeRowId}-${idx}`}>
                      <TableCell>
                        <TextField value={it.Lot} onChange={(e) => updateItem(idx, { Lot: e.target.value })} size="small" fullWidth />
                      </TableCell>

                      <TableCell>
                        <TextField value={it.Code_Prp} onChange={(e) => updateItem(idx, { Code_Prp: e.target.value })} size="small" fullWidth />
                      </TableCell>

                      <TableCell>
                        <TextField value={it.Produit} onChange={(e) => updateItem(idx, { Produit: e.target.value })} size="small" fullWidth />
                      </TableCell>

                      <TableCell>
                        <TextField value={it.Calibre} onChange={(e) => updateItem(idx, { Calibre: e.target.value })} size="small" fullWidth />
                      </TableCell>

                      <TableCell>
                        <TextField value={it.Qualite} onChange={(e) => updateItem(idx, { Qualite: e.target.value })} size="small" fullWidth />
                      </TableCell>

                      <TableCell align="right">
                        <TextField
                          value={it.reservedQty}
                          onChange={(e) => updateItem(idx, { reservedQty: safeNum(e.target.value, 0) })}
                          type="number"
                          inputProps={{ min: 0 }}
                          size="small"
                          fullWidth
                        />
                      </TableCell>

                      <TableCell align="right">
                        <Button variant="text" color="error" onClick={() => removeItem(idx)}>
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {!editItems.length ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          No items. (At least 1 item is required to save.)
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>

              <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
                Note: Modify syncs Entreé quantities (reserve more / release back).
              </Typography>
            </Paper>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenModify(false)}>Cancel</Button>
          <Button variant="contained" onClick={confirmModify} disabled={!selected}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
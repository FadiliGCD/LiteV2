import * as React from "react";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from "@mui/material";
import { supabase } from "../lib/supabaseClient";

type EntreeDbRow = {
  id: string;
  lot: string | null;
  code_prp: string | null;
  produit: string | null;
  calibre: string | null;
  qualite: string | null;
  emballage: string | null;
  quantite: number | null;
  colis: number | null;
  pu: number | null;
  created_at?: string | null;
};

type ParkingReservationDbRow = {
  reservation_id: number;
  client: string | null;
  created_at: string | null;
};

type ParkingItemDbRow = {
  id: string;
  reservation_id: number;
  entree_id: string | null;
  lot: string | null;
  code_prp: string | null;
  produit: string | null;
  calibre: string | null;
  qualite: string | null;
  reserved_qty: number | null;
};

type SortieDbRow = {
  id: string;
  date_chg: string | null;
  client: string | null;
  lot: string | null;
  produit: string | null;
  calibre: string | null;
  qualite: string | null;
  quantite: number | null;
  colis: number | null;
  created_at: string | null;
};

type ProductSummary = {
  product: string;
  available: number;
  parked: number;
  physical: number;
  entreeLines: number;
};

type PivotRow = {
  id: string;
  type: "detail" | "product-total" | "prp-total" | "grand-total";
  prp: string;
  product: string;
  emballage: string;
  calibre: string;
  qualite: string;
  available: number;
  parked: number;
  physical: number;
};

type ReservationSummary = {
  reservationId: number;
  client: string;
  createdAt: string;
  totalQty: number;
  itemCount: number;
};

type DashboardAlert = {
  id: string;
  severity: "warning" | "error" | "info";
  title: string;
  description: string;
};

function safeNum(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = dayjs(value);
  return date.isValid() ? date.format("DD/MM/YYYY HH:mm") : String(value);
}

function normalizeValue(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeProduct(value: unknown) {
  return normalizeValue(value, "Produit non défini");
}

function sortText(a: string, b: string) {
  return a.localeCompare(b, "fr", { sensitivity: "base" });
}

function SummaryCard({ title, value, description, accent, tone = "light" }: {
  title: string;
  value: number;
  description: string;
  accent: string;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <Paper
      variant={dark ? undefined : "outlined"}
      elevation={dark ? 0 : undefined}
      sx={{
        p: 2.4,
        borderRadius: 3.5,
        minHeight: 142,
        position: "relative",
        overflow: "hidden",
        bgcolor: dark ? "#0f172a" : "background.paper",
        color: dark ? "white" : "text.primary",
        borderColor: dark ? "transparent" : "rgba(15,23,42,0.1)",
        boxShadow: dark ? "0 18px 42px rgba(15,23,42,0.2)" : "none",
      }}
    >
      <Box sx={{ position: "absolute", inset: "0 auto 0 0", width: 6, bgcolor: accent }} />
      <Stack spacing={1} sx={{ pl: 1 }}>
        <Typography variant="body2" sx={{ color: dark ? "rgba(255,255,255,0.72)" : "text.secondary", fontWeight: 800 }}>
          {title}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 950, lineHeight: 1.12 }}>{formatNumber(value)}</Typography>
        <Typography variant="caption" sx={{ color: dark ? "rgba(255,255,255,0.68)" : "text.secondary", lineHeight: 1.55 }}>
          {description}
        </Typography>
      </Stack>
    </Paper>
  );
}

function SectionCard({ title, subtitle, action, children }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3.5, bgcolor: "background.paper", borderColor: "rgba(15,23,42,0.08)", minWidth: 0 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1.5} sx={{ mb: 1.5 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 950 }}>{title}</Typography>
          {subtitle ? <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.3 }}>{subtitle}</Typography> : null}
        </Box>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

function StockCircleChart({ available, parked }: { available: number; parked: number }) {
  const theme = useTheme();
  const physical = available + parked;
  const availablePercent = physical > 0 ? (available / physical) * 100 : 0;
  const parkedPercent = physical > 0 ? (parked / physical) * 100 : 0;
  const size = 246;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const availableLength = circumference * (availablePercent / 100);
  const parkedLength = circumference * (parkedPercent / 100);

  return (
    <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ height: "100%" }}>
      <Box sx={{ width: size, height: size, position: "relative" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Current stock composition">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={theme.palette.action.hover} strokeWidth={strokeWidth} />
          {physical > 0 ? (
            <>
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={theme.palette.primary.main} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={`${availableLength} ${circumference - availableLength}`} strokeDashoffset={0} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={theme.palette.warning.main} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={`${parkedLength} ${circumference - parkedLength}`} strokeDashoffset={-availableLength} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
            </>
          ) : null}
        </svg>
        <Stack alignItems="center" justifyContent="center" sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>Stock physique</Typography>
          <Typography variant="h4" sx={{ fontWeight: 950 }}>{formatNumber(physical)}</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>Quantité totale</Typography>
        </Stack>
      </Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
        <LegendDot color="primary.main" title="Disponible" detail={`${formatNumber(available)} · ${availablePercent.toFixed(1)}%`} />
        <LegendDot color="warning.main" title="Parking" detail={`${formatNumber(parked)} · ${parkedPercent.toFixed(1)}%`} />
      </Stack>
    </Stack>
  );
}

function LegendDot({ color, title, detail }: { color: string; title: string; detail: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: color }} />
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 800 }}>{title}</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>{detail}</Typography>
      </Box>
    </Stack>
  );
}

function StockPivotTable({ rows }: { rows: PivotRow[] }) {
  return (
    <SectionCard title="Stock détaillé" subtitle="Vue groupée par PRP, produit, emballage, calibre et qualité." action={<Chip size="small" variant="outlined" label={`${rows.length} lignes`} />}>
      <TableContainer sx={{ maxHeight: 520, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {["PRP", "Produit", "Emballage", "Calibre", "Qualité", "Disponible", "Parking", "Stock physique"].map((h, idx) => (
                <TableCell key={h} align={idx >= 5 ? "right" : "left"} sx={{ fontWeight: 950, bgcolor: "primary.main", color: "primary.contrastText" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length ? rows.map((row) => {
              const isProductTotal = row.type === "product-total";
              const isPrpTotal = row.type === "prp-total";
              const isGrandTotal = row.type === "grand-total";
              const isTotal = isProductTotal || isPrpTotal || isGrandTotal;
              return (
                <TableRow key={row.id} hover={row.type === "detail"} sx={{ bgcolor: isGrandTotal ? "action.selected" : isPrpTotal ? "primary.50" : isProductTotal ? "grey.100" : "background.paper", "& td": { fontWeight: isTotal ? 900 : 500, borderBottom: isGrandTotal ? "2px solid" : undefined, borderColor: isGrandTotal ? "text.primary" : undefined } }}>
                  <TableCell>{isGrandTotal ? "Total général" : row.prp}</TableCell>
                  <TableCell>{isProductTotal ? `Total ${row.product}` : isPrpTotal || isGrandTotal ? "" : row.product}</TableCell>
                  <TableCell>{isTotal ? "" : row.emballage}</TableCell>
                  <TableCell>{isTotal ? "" : row.calibre}</TableCell>
                  <TableCell>{isTotal ? "" : row.qualite}</TableCell>
                  <TableCell align="right">{formatNumber(row.available)}</TableCell>
                  <TableCell align="right">{formatNumber(row.parked)}</TableCell>
                  <TableCell align="right">{formatNumber(row.physical)}</TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography variant="body2" sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>Aucun stock disponible.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </SectionCard>
  );
}

export default function DashboardPage() {
  const theme = useTheme();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [entreeRows, setEntreeRows] = React.useState<EntreeDbRow[]>([]);
  const [parkingReservations, setParkingReservations] = React.useState<ParkingReservationDbRow[]>([]);
  const [parkingItems, setParkingItems] = React.useState<ParkingItemDbRow[]>([]);
  const [sortieRows, setSortieRows] = React.useState<SortieDbRow[]>([]);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  const loadDashboard = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [entreeResult, reservationsResult, parkingItemsResult, sortieResult] = await Promise.all([
        supabase.from("entree").select("id, lot, code_prp, produit, calibre, qualite, emballage, quantite, colis, pu, created_at").order("created_at", { ascending: false }),
        supabase.from("parking_reservations").select("reservation_id, client, created_at").order("created_at", { ascending: false }),
        supabase.from("parking_items").select("id, reservation_id, entree_id, lot, code_prp, produit, calibre, qualite, reserved_qty"),
        supabase.from("sortie").select("id, date_chg, client, lot, produit, calibre, qualite, quantite, colis, created_at").order("created_at", { ascending: false }),
      ]);
      if (entreeResult.error) throw new Error(entreeResult.error.message);
      if (reservationsResult.error) throw new Error(reservationsResult.error.message);
      if (parkingItemsResult.error) throw new Error(parkingItemsResult.error.message);
      if (sortieResult.error) throw new Error(sortieResult.error.message);
      setEntreeRows((entreeResult.data ?? []) as EntreeDbRow[]);
      setParkingReservations((reservationsResult.data ?? []) as ParkingReservationDbRow[]);
      setParkingItems((parkingItemsResult.data ?? []) as ParkingItemDbRow[]);
      setSortieRows((sortieResult.data ?? []) as SortieDbRow[]);
      setLastUpdated(new Date());
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const availableStock = React.useMemo(() => entreeRows.reduce((total, row) => total + safeNum(row.quantite, 0), 0), [entreeRows]);
  const parkedStock = React.useMemo(() => parkingItems.reduce((total, row) => total + safeNum(row.reserved_qty, 0), 0), [parkingItems]);
  const physicalStock = availableStock + parkedStock;
  const exitedStock = React.useMemo(() => sortieRows.reduce((total, row) => total + safeNum(row.quantite, 0), 0), [sortieRows]);
  const totalColis = React.useMemo(() => entreeRows.reduce((total, row) => total + safeNum(row.colis, 0), 0), [entreeRows]);

  const productSummaries = React.useMemo<ProductSummary[]>(() => {
    const map = new Map<string, ProductSummary>();
    for (const row of entreeRows) {
      const product = normalizeProduct(row.produit);
      const current = map.get(product) ?? { product, available: 0, parked: 0, physical: 0, entreeLines: 0 };
      current.available += safeNum(row.quantite, 0);
      current.entreeLines += 1;
      map.set(product, current);
    }
    for (const item of parkingItems) {
      const product = normalizeProduct(item.produit);
      const current = map.get(product) ?? { product, available: 0, parked: 0, physical: 0, entreeLines: 0 };
      current.parked += safeNum(item.reserved_qty, 0);
      map.set(product, current);
    }
    return Array.from(map.values()).map((row) => ({ ...row, physical: row.available + row.parked })).sort((a, b) => b.physical - a.physical);
  }, [entreeRows, parkingItems]);

  const pivotRows = React.useMemo<PivotRow[]>(() => {
    type DetailKey = { prp: string; product: string; emballage: string; calibre: string; qualite: string; available: number; parked: number };
    const entreeById = new Map<string, EntreeDbRow>();
    for (const row of entreeRows) entreeById.set(String(row.id), row);
    const detailMap = new Map<string, DetailKey>();
    const addToMap = (item: DetailKey) => {
      const key = [item.prp, item.product, item.emballage, item.calibre, item.qualite].join("||");
      const current = detailMap.get(key) ?? { ...item, available: 0, parked: 0 };
      current.available += item.available;
      current.parked += item.parked;
      detailMap.set(key, current);
    };
    for (const row of entreeRows) {
      addToMap({
        prp: normalizeValue(row.code_prp, "PRP non défini"),
        product: normalizeProduct(row.produit),
        emballage: normalizeValue(row.emballage, "Emballage non défini"),
        calibre: normalizeValue(row.calibre, "Calibre non défini"),
        qualite: normalizeValue(row.qualite, "Qualité non définie"),
        available: safeNum(row.quantite, 0),
        parked: 0,
      });
    }
    for (const item of parkingItems) {
      const source = item.entree_id ? entreeById.get(String(item.entree_id)) : null;
      addToMap({
        prp: normalizeValue(item.code_prp ?? source?.code_prp, "PRP non défini"),
        product: normalizeProduct(item.produit ?? source?.produit),
        emballage: normalizeValue(source?.emballage, "Emballage non défini"),
        calibre: normalizeValue(item.calibre ?? source?.calibre, "Calibre non défini"),
        qualite: normalizeValue(item.qualite ?? source?.qualite, "Qualité non définie"),
        available: 0,
        parked: safeNum(item.reserved_qty, 0),
      });
    }
    const details = Array.from(detailMap.values()).sort((a, b) => sortText(a.prp, b.prp) || sortText(a.product, b.product) || sortText(a.emballage, b.emballage) || sortText(a.calibre, b.calibre) || sortText(a.qualite, b.qualite));
    const output: PivotRow[] = [];
    let currentPrp = "";
    let currentProduct = "";
    let productAvailable = 0;
    let productParked = 0;
    let prpAvailable = 0;
    let prpParked = 0;
    let grandAvailable = 0;
    let grandParked = 0;
    const pushProductTotal = () => {
      if (!currentProduct) return;
      output.push({ id: `product-total-${currentPrp}-${currentProduct}-${output.length}`, type: "product-total", prp: "", product: currentProduct, emballage: "", calibre: "", qualite: "", available: productAvailable, parked: productParked, physical: productAvailable + productParked });
      productAvailable = 0;
      productParked = 0;
    };
    const pushPrpTotal = () => {
      if (!currentPrp) return;
      output.push({ id: `prp-total-${currentPrp}-${output.length}`, type: "prp-total", prp: `Total ${currentPrp}`, product: "", emballage: "", calibre: "", qualite: "", available: prpAvailable, parked: prpParked, physical: prpAvailable + prpParked });
      prpAvailable = 0;
      prpParked = 0;
    };
    for (const detail of details) {
      const isNewPrp = detail.prp !== currentPrp;
      const isNewProduct = detail.product !== currentProduct || isNewPrp;
      if (currentProduct && isNewProduct) pushProductTotal();
      if (currentPrp && isNewPrp) pushPrpTotal();
      if (isNewPrp) currentPrp = detail.prp;
      if (isNewProduct) currentProduct = detail.product;
      const available = detail.available;
      const parked = detail.parked;
      output.push({ id: `detail-${detail.prp}-${detail.product}-${detail.emballage}-${detail.calibre}-${detail.qualite}`, type: "detail", prp: detail.prp, product: detail.product, emballage: detail.emballage, calibre: detail.calibre, qualite: detail.qualite, available, parked, physical: available + parked });
      productAvailable += available;
      productParked += parked;
      prpAvailable += available;
      prpParked += parked;
      grandAvailable += available;
      grandParked += parked;
    }
    pushProductTotal();
    pushPrpTotal();
    if (details.length) output.push({ id: "grand-total", type: "grand-total", prp: "Total général", product: "", emballage: "", calibre: "", qualite: "", available: grandAvailable, parked: grandParked, physical: grandAvailable + grandParked });
    return output;
  }, [entreeRows, parkingItems]);

  const reservationSummaries = React.useMemo<ReservationSummary[]>(() => {
    const itemMap = new Map<number, { totalQty: number; itemCount: number }>();
    for (const item of parkingItems) {
      const reservationId = Number(item.reservation_id);
      const current = itemMap.get(reservationId) ?? { totalQty: 0, itemCount: 0 };
      current.totalQty += safeNum(item.reserved_qty, 0);
      current.itemCount += 1;
      itemMap.set(reservationId, current);
    }
    return parkingReservations.map((reservation) => {
      const totals = itemMap.get(Number(reservation.reservation_id));
      return {
        reservationId: Number(reservation.reservation_id),
        client: String(reservation.client ?? "Client non défini"),
        createdAt: String(reservation.created_at ?? ""),
        totalQty: totals?.totalQty ?? 0,
        itemCount: totals?.itemCount ?? 0,
      };
    });
  }, [parkingReservations, parkingItems]);

  const alerts = React.useMemo<DashboardAlert[]>(() => {
    const list: DashboardAlert[] = [];
    const zeroStockLines = entreeRows.filter((row) => safeNum(row.quantite, 0) === 0).length;
    const negativeStockLines = entreeRows.filter((row) => safeNum(row.quantite, 0) < 0).length;
    const missingProductLines = entreeRows.filter((row) => !String(row.produit ?? "").trim()).length;
    const missingQuantityLines = entreeRows.filter((row) => row.quantite === null || row.quantite === undefined).length;
    const emptyReservations = reservationSummaries.filter((reservation) => reservation.itemCount === 0).length;
    if (negativeStockLines > 0) list.push({ id: "negative-stock", severity: "error", title: "Quantité négative détectée", description: `${negativeStockLines} ligne(s) d'entrée ont une quantité négative.` });
    if (zeroStockLines > 0) list.push({ id: "zero-stock", severity: "warning", title: "Lignes sans stock disponible", description: `${zeroStockLines} ligne(s) d'entrée ont une quantité égale à zéro.` });
    if (emptyReservations > 0) list.push({ id: "empty-reservations", severity: "warning", title: "Réservations vides", description: `${emptyReservations} réservation(s) ne contiennent aucun article.` });
    if (missingProductLines > 0) list.push({ id: "missing-products", severity: "info", title: "Produit non renseigné", description: `${missingProductLines} ligne(s) d'entrée n'ont pas de produit renseigné.` });
    if (missingQuantityLines > 0) list.push({ id: "missing-quantity", severity: "info", title: "Quantité non renseignée", description: `${missingQuantityLines} ligne(s) d'entrée n'ont pas de quantité renseignée.` });
    return list;
  }, [entreeRows, reservationSummaries]);

  const latestReservations = reservationSummaries.slice(0, 6);
  const latestSorties = sortieRows.slice(0, 6);
  const topProducts = productSummaries.slice(0, 8);

  return (
    <Stack spacing={2.5}>
      <Paper elevation={0} sx={{ p: { xs: 2, md: 2.7 }, borderRadius: 4, color: "white", background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #0ea5e9 100%)", overflow: "hidden", position: "relative" }}>
        <Box sx={{ position: "absolute", width: 220, height: 220, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.1)", right: -70, top: -80 }} />
        <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between" spacing={2} sx={{ position: "relative" }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 950, lineHeight: 1.1 }}>Vue d’ensemble du stock</Typography>
            <Typography variant="body2" sx={{ mt: 0.8, color: "rgba(255,255,255,0.76)", maxWidth: 760, lineHeight: 1.65 }}>
              Suivi opérationnel des entrées, réservations parking, sorties et stock physique total.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip label={lastUpdated ? `Dernière mise à jour : ${dayjs(lastUpdated).format("HH:mm:ss")}` : "Pas encore actualisé"} sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "white", fontWeight: 800 }} />
            <Button variant="contained" onClick={loadDashboard} disabled={loading} sx={{ bgcolor: "white", color: "primary.main", fontWeight: 950, "&:hover": { bgcolor: "grey.100" } }}>
              {loading ? "Chargement..." : "Actualiser"}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error ? <Alert severity="error">Impossible de charger le tableau de bord : {error}</Alert> : null}

      {loading && entreeRows.length === 0 ? (
        <Paper variant="outlined" sx={{ minHeight: 420, borderRadius: 3.5, display: "grid", placeItems: "center" }}>
          <Stack alignItems="center" spacing={2}>
            <CircularProgress />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>Chargement des données du stock...</Typography>
          </Stack>
        </Paper>
      ) : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
            <SummaryCard title="Stock disponible" value={availableStock} description="Quantité actuellement disponible dans Entrée." accent={theme.palette.primary.main} tone="dark" />
            <SummaryCard title="Stock en parking" value={parkedStock} description="Quantité réservée pour les clients." accent={theme.palette.warning.main} />
            <SummaryCard title="Stock physique" value={physicalStock} description="Stock disponible plus stock réservé." accent={theme.palette.success.main} />
            <SummaryCard title="Sorties enregistrées" value={exitedStock} description="Quantité déjà sortie depuis le module Sortie." accent={theme.palette.secondary.main} />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "0.95fr 1.05fr" }, gap: 2 }}>
            <SectionCard title="Composition du stock" subtitle="Répartition entre disponible et réservé." action={<Chip size="small" variant="outlined" label={`Colis entrée: ${formatNumber(totalColis)}`} />}>
              <StockCircleChart available={availableStock} parked={parkedStock} />
            </SectionCard>
            <SectionCard title="Alertes opérationnelles" subtitle="Points à vérifier dans les données stock." action={<Chip size="small" color={alerts.length ? "warning" : "success"} label={alerts.length ? `${alerts.length} alerte(s)` : "Aucune alerte"} />}>
              <Stack spacing={1.1}>
                {alerts.length ? alerts.map((alert) => (
                  <Alert key={alert.id} severity={alert.severity} sx={{ borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 900 }}>{alert.title}</Typography>
                    <Typography variant="caption">{alert.description}</Typography>
                  </Alert>
                )) : (
                  <Alert severity="success" sx={{ borderRadius: 2 }}>Aucune alerte détectée dans les données chargées.</Alert>
                )}
              </Stack>
            </SectionCard>
          </Box>

          <SectionCard title="Produits principaux" subtitle="Classement par stock physique total." action={<Chip size="small" variant="outlined" label={`${productSummaries.length} produit(s)`} />}>
            <TableContainer sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 950 }}>Produit</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 950 }}>Disponible</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 950 }}>Parking</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 950 }}>Stock physique</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 950 }}>Lignes entrée</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topProducts.length ? topProducts.map((row) => (
                    <TableRow key={row.product} hover>
                      <TableCell>{row.product}</TableCell>
                      <TableCell align="right">{formatNumber(row.available)}</TableCell>
                      <TableCell align="right">{formatNumber(row.parked)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900 }}>{formatNumber(row.physical)}</TableCell>
                      <TableCell align="right">{row.entreeLines}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={5}><Typography variant="body2" sx={{ py: 3, textAlign: "center", color: "text.secondary" }}>Aucun produit chargé.</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
            <SectionCard title="Dernières réservations Parking" subtitle="Réservations les plus récentes." action={<Chip size="small" variant="outlined" label={`${parkingReservations.length} réservation(s)`} />}>
              <TableContainer sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                <Table size="small">
                  <TableHead><TableRow><TableCell sx={{ fontWeight: 950 }}>Réservation</TableCell><TableCell sx={{ fontWeight: 950 }}>Client</TableCell><TableCell align="right" sx={{ fontWeight: 950 }}>Qté</TableCell><TableCell sx={{ fontWeight: 950 }}>Créée</TableCell></TableRow></TableHead>
                  <TableBody>
                    {latestReservations.length ? latestReservations.map((row) => (
                      <TableRow key={row.reservationId} hover>
                        <TableCell>#{row.reservationId}</TableCell>
                        <TableCell>{row.client}</TableCell>
                        <TableCell align="right">{formatNumber(row.totalQty)}</TableCell>
                        <TableCell>{formatDate(row.createdAt)}</TableCell>
                      </TableRow>
                    )) : <TableRow><TableCell colSpan={4}><Typography variant="body2" sx={{ py: 3, textAlign: "center", color: "text.secondary" }}>Aucune réservation.</Typography></TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </SectionCard>

            <SectionCard title="Dernières sorties" subtitle="Sorties de stock les plus récentes." action={<Chip size="small" variant="outlined" label={`${sortieRows.length} sortie(s)`} />}>
              <TableContainer sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                <Table size="small">
                  <TableHead><TableRow><TableCell sx={{ fontWeight: 950 }}>Date</TableCell><TableCell sx={{ fontWeight: 950 }}>Client</TableCell><TableCell sx={{ fontWeight: 950 }}>Produit</TableCell><TableCell align="right" sx={{ fontWeight: 950 }}>Qté</TableCell></TableRow></TableHead>
                  <TableBody>
                    {latestSorties.length ? latestSorties.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{formatDate(row.date_chg ?? row.created_at)}</TableCell>
                        <TableCell>{row.client || "—"}</TableCell>
                        <TableCell>{normalizeProduct(row.produit)}</TableCell>
                        <TableCell align="right">{formatNumber(safeNum(row.quantite, 0))}</TableCell>
                      </TableRow>
                    )) : <TableRow><TableCell colSpan={4}><Typography variant="body2" sx={{ py: 3, textAlign: "center", color: "text.secondary" }}>Aucune sortie.</Typography></TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </SectionCard>
          </Box>

          <StockPivotTable rows={pivotRows} />
        </>
      )}
    </Stack>
  );
}

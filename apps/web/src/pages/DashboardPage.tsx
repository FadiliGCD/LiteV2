import * as React from "react";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
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

// --------------------------------------------------
// Database types
// --------------------------------------------------
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

// --------------------------------------------------
// Helpers
// --------------------------------------------------
function safeNum(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = dayjs(value);

  if (!date.isValid()) return String(value);

  return date.format("DD/MM/YYYY HH:mm");
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

// --------------------------------------------------
// Summary card
// --------------------------------------------------
function SummaryCard({
  title,
  value,
  description,
  accent,
}: {
  title: string;
  value: number;
  description: string;
  accent: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 3,
        position: "relative",
        overflow: "hidden",
        minHeight: 150,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 6,
          height: "100%",
          bgcolor: accent,
        }}
      />

      <Stack spacing={1} sx={{ pl: 1 }}>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            fontWeight: 700,
          }}
        >
          {title}
        </Typography>

        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            lineHeight: 1.2,
          }}
        >
          {formatNumber(value)}
        </Typography>

        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            lineHeight: 1.5,
          }}
        >
          {description}
        </Typography>
      </Stack>
    </Paper>
  );
}

// --------------------------------------------------
// Circular stock chart
// --------------------------------------------------
function StockCircleChart({
  available,
  parked,
}: {
  available: number;
  parked: number;
}) {
  const theme = useTheme();

  const physical = available + parked;

  const availablePercent = physical > 0 ? (available / physical) * 100 : 0;
  const parkedPercent = physical > 0 ? (parked / physical) * 100 : 0;

  const size = 250;
  const strokeWidth = 25;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const availableLength = circumference * (availablePercent / 100);
  const parkedLength = circumference * (parkedPercent / 100);

  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={2}
      sx={{ height: "100%" }}
    >
      <Box
        sx={{
          width: size,
          height: size,
          position: "relative",
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label="Current stock composition"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={theme.palette.action.hover}
            strokeWidth={strokeWidth}
          />

          {physical > 0 ? (
            <>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={theme.palette.primary.main}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${availableLength} ${
                  circumference - availableLength
                }`}
                strokeDashoffset={0}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />

              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={theme.palette.warning.main}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${parkedLength} ${
                  circumference - parkedLength
                }`}
                strokeDashoffset={-availableLength}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            </>
          ) : null}
        </svg>

        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
          }}
        >
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Stock physique
          </Typography>

          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            {formatNumber(physical)}
          </Typography>

          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Quantité totale
          </Typography>
        </Stack>
      </Box>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        justifyContent="center"
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              bgcolor: "primary.main",
            }}
          />

          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Disponible
            </Typography>

            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {formatNumber(available)} · {availablePercent.toFixed(1)}%
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              bgcolor: "warning.main",
            }}
          />

          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Parking
            </Typography>

            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {formatNumber(parked)} · {parkedPercent.toFixed(1)}%
            </Typography>
          </Box>
        </Stack>
      </Stack>
    </Stack>
  );
}

// --------------------------------------------------
// Pivot table
// --------------------------------------------------
function StockPivotTable({ rows }: { rows: PivotRow[] }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, minWidth: 0 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={1}
        sx={{ mb: 1 }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Stock détaillé
          </Typography>

          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Vue groupée par PRP, produit, emballage, calibre et qualité.
          </Typography>
        </Box>

        <Chip
          size="small"
          variant="outlined"
          label="Style tableau croisé"
        />
      </Stack>

      <Divider />

      <TableContainer sx={{ maxHeight: 520 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  fontWeight: 900,
                  bgcolor: "success.dark",
                  color: "success.contrastText",
                }}
              >
                PRP
              </TableCell>

              <TableCell
                sx={{
                  fontWeight: 900,
                  bgcolor: "success.dark",
                  color: "success.contrastText",
                }}
              >
                Produit
              </TableCell>

              <TableCell
                sx={{
                  fontWeight: 900,
                  bgcolor: "success.dark",
                  color: "success.contrastText",
                }}
              >
                Emballage
              </TableCell>

              <TableCell
                sx={{
                  fontWeight: 900,
                  bgcolor: "success.dark",
                  color: "success.contrastText",
                }}
              >
                Calibre
              </TableCell>

              <TableCell
                sx={{
                  fontWeight: 900,
                  bgcolor: "success.dark",
                  color: "success.contrastText",
                }}
              >
                Qualité
              </TableCell>

              <TableCell
                align="right"
                sx={{
                  fontWeight: 900,
                  bgcolor: "success.dark",
                  color: "success.contrastText",
                }}
              >
                Disponible
              </TableCell>

              <TableCell
                align="right"
                sx={{
                  fontWeight: 900,
                  bgcolor: "success.dark",
                  color: "success.contrastText",
                }}
              >
                Parking
              </TableCell>

              <TableCell
                align="right"
                sx={{
                  fontWeight: 900,
                  bgcolor: "success.dark",
                  color: "success.contrastText",
                }}
              >
                Stock physique
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.length ? (
              rows.map((row) => {
                const isProductTotal = row.type === "product-total";
                const isPrpTotal = row.type === "prp-total";
                const isGrandTotal = row.type === "grand-total";
                const isTotal = isProductTotal || isPrpTotal || isGrandTotal;

                return (
                  <TableRow
                    key={row.id}
                    hover={row.type === "detail"}
                    sx={{
                      bgcolor: isGrandTotal
                        ? "action.selected"
                        : isPrpTotal
                        ? "success.light"
                        : isProductTotal
                        ? "grey.100"
                        : "background.paper",
                      "& td": {
                        fontWeight: isTotal ? 900 : 500,
                        borderBottom: isGrandTotal
                          ? "2px solid"
                          : isPrpTotal
                          ? "1px solid"
                          : undefined,
                        borderColor: isGrandTotal
                          ? "text.primary"
                          : isPrpTotal
                          ? "success.main"
                          : undefined,
                      },
                    }}
                  >
                    <TableCell>
                      {isGrandTotal ? "Total général" : row.prp}
                    </TableCell>

                    <TableCell>
                      {isProductTotal
                        ? `Total ${row.product}`
                        : isPrpTotal || isGrandTotal
                        ? ""
                        : row.product}
                    </TableCell>

                    <TableCell>
                      {isTotal ? "" : row.emballage}
                    </TableCell>

                    <TableCell>
                      {isTotal ? "" : row.calibre}
                    </TableCell>

                    <TableCell>
                      {isTotal ? "" : row.qualite}
                    </TableCell>

                    <TableCell align="right">
                      {formatNumber(row.available)}
                    </TableCell>

                    <TableCell align="right">
                      {formatNumber(row.parked)}
                    </TableCell>

                    <TableCell align="right">
                      {formatNumber(row.physical)}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography
                    variant="body2"
                    sx={{
                      py: 4,
                      textAlign: "center",
                      color: "text.secondary",
                    }}
                  >
                    Aucun stock disponible.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

// --------------------------------------------------
// Dashboard page
// --------------------------------------------------
export default function DashboardPage() {
  const theme = useTheme();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [entreeRows, setEntreeRows] = React.useState<EntreeDbRow[]>([]);

  const [parkingReservations, setParkingReservations] = React.useState<
    ParkingReservationDbRow[]
  >([]);

  const [parkingItems, setParkingItems] = React.useState<ParkingItemDbRow[]>(
    []
  );

  const [sortieRows, setSortieRows] = React.useState<SortieDbRow[]>([]);

  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  const loadDashboard = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        entreeResult,
        reservationsResult,
        parkingItemsResult,
        sortieResult,
      ] = await Promise.all([
        supabase
          .from("entree")
          .select(
            "id, lot, code_prp, produit, calibre, qualite, emballage, quantite, colis, pu, created_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("parking_reservations")
          .select("reservation_id, client, created_at")
          .order("created_at", { ascending: false }),

        supabase
          .from("parking_items")
          .select(
            "id, reservation_id, entree_id, lot, code_prp, produit, calibre, qualite, reserved_qty"
          ),

        supabase
          .from("sortie")
          .select(
            "id, date_chg, client, lot, produit, calibre, qualite, quantite, colis, created_at"
          )
          .order("created_at", { ascending: false }),
      ]);

      if (entreeResult.error) {
        throw new Error(entreeResult.error.message);
      }

      if (reservationsResult.error) {
        throw new Error(reservationsResult.error.message);
      }

      if (parkingItemsResult.error) {
        throw new Error(parkingItemsResult.error.message);
      }

      if (sortieResult.error) {
        throw new Error(sortieResult.error.message);
      }

      setEntreeRows((entreeResult.data ?? []) as EntreeDbRow[]);

      setParkingReservations(
        (reservationsResult.data ?? []) as ParkingReservationDbRow[]
      );

      setParkingItems((parkingItemsResult.data ?? []) as ParkingItemDbRow[]);

      setSortieRows((sortieResult.data ?? []) as SortieDbRow[]);

      setLastUpdated(new Date());
    } catch (loadError: unknown) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load dashboard data.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // --------------------------------------------------
  // Main totals
  // --------------------------------------------------
  const availableStock = React.useMemo(() => {
    return entreeRows.reduce(
      (total, row) => total + safeNum(row.quantite, 0),
      0
    );
  }, [entreeRows]);

  const parkedStock = React.useMemo(() => {
    return parkingItems.reduce(
      (total, row) => total + safeNum(row.reserved_qty, 0),
      0
    );
  }, [parkingItems]);

  const physicalStock = availableStock + parkedStock;

  const exitedStock = React.useMemo(() => {
    return sortieRows.reduce(
      (total, row) => total + safeNum(row.quantite, 0),
      0
    );
  }, [sortieRows]);

  // --------------------------------------------------
  // Product summaries
  // --------------------------------------------------
  const productSummaries = React.useMemo<ProductSummary[]>(() => {
    const map = new Map<string, ProductSummary>();

    for (const row of entreeRows) {
      const product = normalizeProduct(row.produit);

      const current = map.get(product) ?? {
        product,
        available: 0,
        parked: 0,
        physical: 0,
        entreeLines: 0,
      };

      current.available += safeNum(row.quantite, 0);
      current.entreeLines += 1;

      map.set(product, current);
    }

    for (const item of parkingItems) {
      const product = normalizeProduct(item.produit);

      const current = map.get(product) ?? {
        product,
        available: 0,
        parked: 0,
        physical: 0,
        entreeLines: 0,
      };

      current.parked += safeNum(item.reserved_qty, 0);

      map.set(product, current);
    }

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        physical: row.available + row.parked,
      }))
      .sort((a, b) => b.physical - a.physical);
  }, [entreeRows, parkingItems]);

  // --------------------------------------------------
  // Excel-style stock pivot rows
  // --------------------------------------------------
  const pivotRows = React.useMemo<PivotRow[]>(() => {
    type DetailKey = {
      prp: string;
      product: string;
      emballage: string;
      calibre: string;
      qualite: string;
      available: number;
      parked: number;
    };

    const entreeById = new Map<string, EntreeDbRow>();

    for (const row of entreeRows) {
      entreeById.set(String(row.id), row);
    }

    const detailMap = new Map<string, DetailKey>();

    const addToMap = ({
      prp,
      product,
      emballage,
      calibre,
      qualite,
      available,
      parked,
    }: DetailKey) => {
      const key = [prp, product, emballage, calibre, qualite].join("||");

      const current = detailMap.get(key) ?? {
        prp,
        product,
        emballage,
        calibre,
        qualite,
        available: 0,
        parked: 0,
      };

      current.available += available;
      current.parked += parked;

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
        prp: normalizeValue(
          item.code_prp ?? source?.code_prp,
          "PRP non défini"
        ),
        product: normalizeProduct(item.produit ?? source?.produit),
        emballage: normalizeValue(
          source?.emballage,
          "Emballage non défini"
        ),
        calibre: normalizeValue(item.calibre ?? source?.calibre, "Calibre non défini"),
        qualite: normalizeValue(item.qualite ?? source?.qualite, "Qualité non définie"),
        available: 0,
        parked: safeNum(item.reserved_qty, 0),
      });
    }

    const details = Array.from(detailMap.values()).sort((a, b) => {
      return (
        sortText(a.prp, b.prp) ||
        sortText(a.product, b.product) ||
        sortText(a.emballage, b.emballage) ||
        sortText(a.calibre, b.calibre) ||
        sortText(a.qualite, b.qualite)
      );
    });

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

      output.push({
        id: `product-total-${currentPrp}-${currentProduct}-${output.length}`,
        type: "product-total",
        prp: "",
        product: currentProduct,
        emballage: "",
        calibre: "",
        qualite: "",
        available: productAvailable,
        parked: productParked,
        physical: productAvailable + productParked,
      });

      productAvailable = 0;
      productParked = 0;
    };

    const pushPrpTotal = () => {
      if (!currentPrp) return;

      output.push({
        id: `prp-total-${currentPrp}-${output.length}`,
        type: "prp-total",
        prp: `Total ${currentPrp}`,
        product: "",
        emballage: "",
        calibre: "",
        qualite: "",
        available: prpAvailable,
        parked: prpParked,
        physical: prpAvailable + prpParked,
      });

      prpAvailable = 0;
      prpParked = 0;
    };

    for (const detail of details) {
      const isNewPrp = detail.prp !== currentPrp;
      const isNewProduct = detail.product !== currentProduct || isNewPrp;

      if (currentProduct && isNewProduct) {
        pushProductTotal();
      }

      if (currentPrp && isNewPrp) {
        pushPrpTotal();
      }

      if (isNewPrp) {
        currentPrp = detail.prp;
      }

      if (isNewProduct) {
        currentProduct = detail.product;
      }

      const available = detail.available;
      const parked = detail.parked;
      const physical = available + parked;

      output.push({
        id: `detail-${detail.prp}-${detail.product}-${detail.emballage}-${detail.calibre}-${detail.qualite}`,
        type: "detail",
        prp: detail.prp,
        product: detail.product,
        emballage: detail.emballage,
        calibre: detail.calibre,
        qualite: detail.qualite,
        available,
        parked,
        physical,
      });

      productAvailable += available;
      productParked += parked;

      prpAvailable += available;
      prpParked += parked;

      grandAvailable += available;
      grandParked += parked;
    }

    pushProductTotal();
    pushPrpTotal();

    if (details.length) {
      output.push({
        id: "grand-total",
        type: "grand-total",
        prp: "Total général",
        product: "",
        emballage: "",
        calibre: "",
        qualite: "",
        available: grandAvailable,
        parked: grandParked,
        physical: grandAvailable + grandParked,
      });
    }

    return output;
  }, [entreeRows, parkingItems]);

  // --------------------------------------------------
  // Reservations summary
  // --------------------------------------------------
  const reservationSummaries = React.useMemo<ReservationSummary[]>((() => {
    const itemMap = new Map<number, { totalQty: number; itemCount: number }>();

    for (const item of parkingItems) {
      const reservationId = Number(item.reservation_id);

      const current = itemMap.get(reservationId) ?? {
        totalQty: 0,
        itemCount: 0,
      };

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
  }) as () => ReservationSummary[], [parkingReservations, parkingItems]);

  // --------------------------------------------------
  // Alerts
  // --------------------------------------------------
  const alerts = React.useMemo<DashboardAlert[]>(() => {
    const list: DashboardAlert[] = [];

    const zeroStockLines = entreeRows.filter(
      (row) => safeNum(row.quantite, 0) === 0
    ).length;

    const negativeStockLines = entreeRows.filter(
      (row) => safeNum(row.quantite, 0) < 0
    ).length;

    const missingProductLines = entreeRows.filter(
      (row) => !String(row.produit ?? "").trim()
    ).length;

    const missingQuantityLines = entreeRows.filter(
      (row) => row.quantite === null || row.quantite === undefined
    ).length;

    const emptyReservations = reservationSummaries.filter(
      (reservation) => reservation.itemCount === 0
    ).length;

    if (negativeStockLines > 0) {
      list.push({
        id: "negative-stock",
        severity: "error",
        title: "Quantité négative détectée",
        description: `${negativeStockLines} ligne(s) d'entrée ont une quantité négative.`,
      });
    }

    if (zeroStockLines > 0) {
      list.push({
        id: "zero-stock",
        severity: "warning",
        title: "Lignes sans stock disponible",
        description: `${zeroStockLines} ligne(s) d'entrée ont une quantité égale à zéro.`,
      });
    }

    if (emptyReservations > 0) {
      list.push({
        id: "empty-reservations",
        severity: "warning",
        title: "Réservations vides",
        description: `${emptyReservations} réservation(s) ne contiennent aucun article.`,
      });
    }

    if (missingProductLines > 0) {
      list.push({
        id: "missing-products",
        severity: "info",
        title: "Produit non renseigné",
        description: `${missingProductLines} ligne(s) d'entrée n'ont pas de produit renseigné.`,
      });
    }

    if (missingQuantityLines > 0) {
      list.push({
        id: "missing-quantity",
        severity: "info",
        title: "Quantité non renseignée",
        description: `${missingQuantityLines} ligne(s) d'entrée n'ont pas de quantité renseignée.`,
      });
    }

    return list;
  }, [entreeRows, reservationSummaries]);

  const latestReservations = reservationSummaries.slice(0, 6);
  const latestSorties = sortieRows.slice(0, 6);

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Vue d’ensemble du stock
          </Typography>

          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            Suivi en temps réel des entrées, réservations et sorties.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            variant="outlined"
            label={
              lastUpdated
                ? `Dernière mise à jour : ${dayjs(lastUpdated).format(
                    "HH:mm:ss"
                  )}`
                : "Pas encore actualisé"
            }
          />

          <Button variant="contained" onClick={loadDashboard} disabled={loading}>
            {loading ? "Chargement..." : "Actualiser"}
          </Button>
        </Stack>
      </Stack>

      {error ? (
        <Alert severity="error">
          Impossible de charger le tableau de bord : {error}
        </Alert>
      ) : null}

      {loading && entreeRows.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            minHeight: 420,
            borderRadius: 3,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Stack alignItems="center" spacing={2}>
            <CircularProgress />

            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Chargement des données du stock...
            </Typography>
          </Stack>
        </Paper>
      ) : (
        <>
          {/* Summary cards */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(3, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            <SummaryCard
              title="Stock disponible"
              value={availableStock}
              description="Quantité actuellement disponible dans Entrée."
              accent={theme.palette.primary.main}
            />

            <SummaryCard
              title="Stock en parking"
              value={parkedStock}
              description="Quantité réservée pour les clients."
              accent={theme.palette.warning.main}
            />

            <SummaryCard
              title="Stock physique"
              value={physicalStock}
              description="Stock disponible plus stock réservé."
              accent={theme.palette.success.main}
            />

            <SummaryCard
              title="Quantité sortie"
              value={exitedStock}
              description="Quantité totale enregistrée dans Sortie."
              accent={theme.palette.secondary.main}
            />

            <SummaryCard
              title="Réservations actives"
              value={parkingReservations.length}
              description="Nombre de réservations actuellement dans Parking."
              accent={theme.palette.info.main}
            />

            <SummaryCard
              title="Lignes de stock"
              value={entreeRows.length}
              description="Nombre de lignes actuellement présentes dans Entrée."
              accent={theme.palette.grey[600]}
            />
          </Box>

          {/* Circle chart + stock by product */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "380px minmax(0, 1fr)",
              },
              gap: 2,
            }}
          >
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 3,
                minHeight: 430,
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Composition du stock actuel
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  mt: 0.5,
                  mb: 2,
                }}
              >
                Répartition entre stock disponible et stock réservé.
              </Typography>

              <StockCircleChart available={availableStock} parked={parkedStock} />
            </Paper>

            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 3,
                minWidth: 0,
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ px: 1, pb: 1 }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Stock par produit
                  </Typography>

                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Quantités disponibles et réservées par catégorie.
                  </Typography>
                </Box>

                <Chip
                  size="small"
                  variant="outlined"
                  label={`${productSummaries.length} produit(s)`}
                />
              </Stack>

              <Divider />

              <TableContainer sx={{ maxHeight: 360 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Produit</TableCell>
                      <TableCell align="right">Disponible</TableCell>
                      <TableCell align="right">Parking</TableCell>
                      <TableCell align="right">Stock physique</TableCell>
                      <TableCell align="right">Lignes</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {productSummaries.length ? (
                      productSummaries.map((row) => (
                        <TableRow key={row.product} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {row.product}
                            </Typography>
                          </TableCell>

                          <TableCell align="right">
                            {formatNumber(row.available)}
                          </TableCell>

                          <TableCell align="right">
                            {formatNumber(row.parked)}
                          </TableCell>

                          <TableCell align="right">
                            <strong>{formatNumber(row.physical)}</strong>
                          </TableCell>

                          <TableCell align="right">{row.entreeLines}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography
                            variant="body2"
                            sx={{
                              py: 4,
                              textAlign: "center",
                              color: "text.secondary",
                            }}
                          >
                            Aucun stock disponible.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>

          {/* NEW: Excel-style detailed stock */}
          <StockPivotTable rows={pivotRows} />

          {/* Recent reservations + sorties */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                xl: "repeat(2, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: 3, minWidth: 0 }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Réservations récentes
                  </Typography>

                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Dernières réservations enregistrées dans Parking.
                  </Typography>
                </Box>

                <Chip size="small" label={parkingReservations.length} />
              </Stack>

              <Divider />

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Réservation</TableCell>
                      <TableCell>Client</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Articles</TableCell>
                      <TableCell align="right">Quantité</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {latestReservations.length ? (
                      latestReservations.map((reservation) => (
                        <TableRow key={reservation.reservationId} hover>
                          <TableCell>#{reservation.reservationId}</TableCell>

                          <TableCell>{reservation.client}</TableCell>

                          <TableCell>
                            {formatDate(reservation.createdAt)}
                          </TableCell>

                          <TableCell align="right">
                            {reservation.itemCount}
                          </TableCell>

                          <TableCell align="right">
                            {formatNumber(reservation.totalQty)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography
                            variant="body2"
                            sx={{
                              py: 4,
                              textAlign: "center",
                              color: "text.secondary",
                            }}
                          >
                            Aucune réservation active.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: 3, minWidth: 0 }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Sorties récentes
                  </Typography>

                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Derniers produits vendus ou sortis du stock.
                  </Typography>
                </Box>

                <Chip size="small" label={sortieRows.length} />
              </Stack>

              <Divider />

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Client</TableCell>
                      <TableCell>Lot</TableCell>
                      <TableCell>Produit</TableCell>
                      <TableCell align="right">Quantité</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {latestSorties.length ? (
                      latestSorties.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell>
                            {formatDate(row.created_at ?? row.date_chg)}
                          </TableCell>

                          <TableCell>{row.client || "—"}</TableCell>

                          <TableCell>{row.lot || "—"}</TableCell>

                          <TableCell>{row.produit || "—"}</TableCell>

                          <TableCell align="right">
                            {formatNumber(safeNum(row.quantite, 0))}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography
                            variant="body2"
                            sx={{
                              py: 4,
                              textAlign: "center",
                              color: "text.secondary",
                            }}
                          >
                            Aucune sortie enregistrée.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>

          {/* Alerts */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{
                xs: "flex-start",
                sm: "center",
              }}
              spacing={1}
              sx={{ mb: 2 }}
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Alertes du stock
                </Typography>

                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Vérifications automatiques des données actuelles.
                </Typography>
              </Box>

              <Chip
                color={alerts.length ? "warning" : "success"}
                label={
                  alerts.length
                    ? `${alerts.length} alerte(s)`
                    : "Aucune anomalie"
                }
              />
            </Stack>

            {alerts.length ? (
              <Stack spacing={1}>
                {alerts.map((alert) => (
                  <Alert key={alert.id} severity={alert.severity}>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                      {alert.title}
                    </Typography>

                    <Typography variant="body2">{alert.description}</Typography>
                  </Alert>
                ))}
              </Stack>
            ) : (
              <Alert severity="success">
                Les données actuelles ne présentent aucune anomalie détectée.
              </Alert>
            )}
          </Paper>
        </>
      )}
    </Stack>
  );
}
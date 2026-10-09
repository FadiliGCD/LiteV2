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
  Typography,
} from "@mui/material";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type ParkingReservationDb = { reservation_id: number; client: string | null; created_at: string | null };
type ParkingItemDb = {
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
type EntreeRowDb = {
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
type ChargeItem = {
  entree_id: string;
  lot: string;
  date_production: string;
  produit: string;
  calibre: string;
  qualite: string;
  pct_ctrl: number | null;
  gr_mn: number | null;
  gr_mx: number | null;
  emballage: string;
  pu: number | null;
  colis: number | null;
  reserved_qty: number;
};

function safeNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function normalizeId(v: unknown) {
  return String(v ?? "").trim();
}
function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}
function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
function SummaryCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: "background.paper" }}>
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
        {title}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 950, mt: 0.5 }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.5 }}>
        {description}
      </Typography>
    </Paper>
  );
}

export default function RapportDeChargePage() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();
  const ridFromQuery = params.get("rid");
  const ridFromState = (loc.state as any)?.rid;
  const reservationId = Number(ridFromQuery ?? ridFromState);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [info, setInfo] = React.useState("");
  const [client, setClient] = React.useState("");
  const [createdAt, setCreatedAt] = React.useState("");
  const [items, setItems] = React.useState<ChargeItem[]>([]);
  const [docHtml, setDocHtml] = React.useState("");

  const totals = React.useMemo(() => {
    const totalQty = items.reduce((acc, it) => acc + safeNum(it.reserved_qty, 0), 0);
    const totalColis = items.reduce((acc, it) => acc + safeNum(it.colis, 0), 0);
    const totalValue = items.reduce((acc, it) => acc + safeNum(it.pu, 0) * safeNum(it.reserved_qty, 0), 0);
    return { totalQty, totalColis, totalValue };
  }, [items]);

  const buildTemplate = React.useCallback(() => {
    const dateNow = dayjs().format("DD/MM/YYYY");
    const created = createdAt ? dayjs(createdAt).format("DD/MM/YYYY HH:mm") : "";
    const rowsHtml = items
      .map((it, idx) => {
        return `
          <tr>
            <td style="padding:7px;border:1px solid #dbe3ef;">${idx + 1}</td>
            <td style="padding:7px;border:1px solid #dbe3ef;">${it.lot}</td>
            <td style="padding:7px;border:1px solid #dbe3ef;">${it.date_production || ""}</td>
            <td style="padding:7px;border:1px solid #dbe3ef;">${it.produit}</td>
            <td style="padding:7px;border:1px solid #dbe3ef;">${it.calibre}</td>
            <td style="padding:7px;border:1px solid #dbe3ef;">${it.qualite}</td>
            <td style="padding:7px;border:1px solid #dbe3ef;text-align:right;">${formatNumber(it.reserved_qty)}</td>
            <td style="padding:7px;border:1px solid #dbe3ef;text-align:right;">${it.colis ?? ""}</td>
            <td style="padding:7px;border:1px solid #dbe3ef;text-align:right;">${it.pu ?? ""}</td>
          </tr>`;
      })
      .join("");
    const html = `
      <div style="font-family: Arial, sans-serif; color:#111827; font-size:13px; line-height:1.45;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid #0f172a;padding-bottom:12px;">
          <div>
            <div style="font-size:23px;font-weight:800;letter-spacing:.3px;">RAPPORT DE CHARGE</div>
            <div style="margin-top:4px;color:#475569;">Document de vente / livraison</div>
          </div>
          <div style="text-align:right;color:#334155;">
            <div><b>Date:</b> ${dateNow}</div>
            <div><b>Réservation #:</b> ${Number.isFinite(reservationId) ? reservationId : ""}</div>
            <div><b>Créé:</b> ${created}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;">
          <div><b>Client:</b> ${client || ""}</div>
          <div><b>Matériel Transport:</b> __________________________</div>
          <div><b>Chauffeur:</b> ________________________________</div>
          <div><b>Destination:</b> ______________________________</div>
        </div>
        <div style="margin-top:16px;font-weight:800;font-size:15px;">Détails de la marchandise</div>
        <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:12.5px;">
          <thead>
            <tr>
              <th style="padding:7px;border:1px solid #dbe3ef;background:#0f172a;color:white;text-align:left;">#</th>
              <th style="padding:7px;border:1px solid #dbe3ef;background:#0f172a;color:white;text-align:left;">Lot</th>
              <th style="padding:7px;border:1px solid #dbe3ef;background:#0f172a;color:white;text-align:left;">Date Prod</th>
              <th style="padding:7px;border:1px solid #dbe3ef;background:#0f172a;color:white;text-align:left;">Produit</th>
              <th style="padding:7px;border:1px solid #dbe3ef;background:#0f172a;color:white;text-align:left;">Calibre</th>
              <th style="padding:7px;border:1px solid #dbe3ef;background:#0f172a;color:white;text-align:left;">Qualité</th>
              <th style="padding:7px;border:1px solid #dbe3ef;background:#0f172a;color:white;text-align:right;">Quantité</th>
              <th style="padding:7px;border:1px solid #dbe3ef;background:#0f172a;color:white;text-align:right;">Colis</th>
              <th style="padding:7px;border:1px solid #dbe3ef;background:#0f172a;color:white;text-align:right;">PU</th>
            </tr>
          </thead>
          <tbody>${rowsHtml || ""}</tbody>
        </table>
        <div style="display:flex;justify-content:flex-end;margin-top:12px;">
          <div style="min-width:340px;border:1px solid #cbd5e1;padding:12px;border-radius:10px;background:#f8fafc;">
            <div style="display:flex;justify-content:space-between;"><span><b>Total Quantité</b></span><span>${formatNumber(totals.totalQty)}</span></div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;"><span><b>Total Colis</b></span><span>${formatNumber(totals.totalColis)}</span></div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;"><span><b>Total (PU×Qte)</b></span><span>${formatMoney(totals.totalValue)}</span></div>
          </div>
        </div>
        <div style="margin-top:16px;">
          <b>Remarques:</b>
          <div style="margin-top:6px;color:#334155;">
            - Marchandise chargée et remise au transporteur.<br/>
            - Le client confirme la réception conformément aux quantités ci-dessus.<br/>
            - Toute réclamation doit être signalée immédiatement.
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:26px;">
          <div><div><b>Signature Vendeur</b></div><div style="margin-top:44px;border-top:1px solid #111827;width:240px;"></div></div>
          <div><div><b>Signature Acheteur</b></div><div style="margin-top:44px;border-top:1px solid #111827;width:240px;"></div></div>
        </div>
      </div>`;
    setDocHtml(html);
  }, [client, createdAt, items, totals.totalQty, totals.totalColis, totals.totalValue, reservationId]);

  const loadData = React.useCallback(async () => {
    if (!Number.isFinite(reservationId) || reservationId <= 0) {
      setError("Missing reservation id. Go back to Parking and click Rapport de charge on a reservation.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const { data: res, error: rErr } = await supabase
        .from("parking_reservations")
        .select("reservation_id, client, created_at")
        .eq("reservation_id", reservationId)
        .maybeSingle();
      if (rErr) throw new Error(rErr.message);
      if (!res) throw new Error("Reservation not found.");
      const resRow = res as any as ParkingReservationDb;
      setClient(String(resRow.client ?? ""));
      setCreatedAt(String(resRow.created_at ?? ""));

      const { data: its, error: iErr } = await supabase
        .from("parking_items")
        .select("id, reservation_id, entree_id, lot, code_prp, produit, calibre, qualite, reserved_qty")
        .eq("reservation_id", reservationId);
      if (iErr) throw new Error(iErr.message);
      const itemsDb = (its ?? []) as any as ParkingItemDb[];
      const entreeIds = Array.from(new Set(itemsDb.map((x) => normalizeId(x.entree_id)).filter(Boolean)));
      const entreeMap = new Map<string, EntreeRowDb>();

      if (entreeIds.length) {
        const { data: ents, error: eErr } = await supabase
          .from("entree")
          .select("id, lot, code_prp, date_production, produit, calibre, qualite, pct_ctrl, gr_mn, gr_mx, emballage, pu, colis, quantite")
          .in("id", entreeIds);
        if (eErr) throw new Error(eErr.message);
        for (const e of (ents ?? []) as any[]) entreeMap.set(String(e.id), e as EntreeRowDb);
      }

      const uiItems: ChargeItem[] = itemsDb.map((it) => {
        const e = it.entree_id ? entreeMap.get(String(it.entree_id)) : undefined;
        return {
          entree_id: String(it.entree_id ?? ""),
          lot: String(e?.lot ?? it.lot ?? ""),
          date_production: String(e?.date_production ?? ""),
          produit: String(e?.produit ?? it.produit ?? ""),
          calibre: String(e?.calibre ?? it.calibre ?? "nan"),
          qualite: String(e?.qualite ?? it.qualite ?? "nan"),
          pct_ctrl: e?.pct_ctrl ?? null,
          gr_mn: e?.gr_mn ?? null,
          gr_mx: e?.gr_mx ?? null,
          emballage: String(e?.emballage ?? ""),
          pu: e?.pu ?? null,
          colis: e?.colis ?? null,
          reserved_qty: safeNum(it.reserved_qty, 0),
        };
      });
      setItems(uiItems);
      setTimeout(() => setInfo("Document prêt. Vous pouvez le modifier puis l'imprimer en PDF."), 0);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load reservation.");
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    if (!loading && !error) buildTemplate();
  }, [loading, error, client, createdAt, items, buildTemplate]);

  const onPrint = () => {
    setInfo("");
    setError("");
    window.print();
  };
  const goBack = () => nav("/stock/parking");

  return (
    <Box>
      <style>{`
        @media print {
          .MuiDrawer-root, .MuiAppBar-root, footer, .no-print { display: none !important; }
          body { background: white !important; }
          #print-area { box-shadow: none !important; border: none !important; padding: 0 !important; }
        }
      `}</style>
      <Stack spacing={2.2}>
        <Paper
          className="no-print"
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 4,
            color: "white",
            background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #0ea5e9 100%)",
            overflow: "hidden",
          }}
        >
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={2}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 950 }}>
                Rapport de charge
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.82, mt: 0.5 }}>
                Générer, modifier et imprimer un document de vente / livraison depuis Parking.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
              <Chip label={Number.isFinite(reservationId) ? `Réservation #${reservationId}` : "Aucune réservation"} sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "white", fontWeight: 900 }} />
              <Chip label={client || "Client non défini"} sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "white", fontWeight: 900 }} />
            </Stack>
          </Stack>
        </Paper>

        <Box className="no-print" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1.5 }}>
          <SummaryCard title="Lignes" value={String(items.length)} description="Articles dans la réservation." />
          <SummaryCard title="Quantité" value={formatNumber(totals.totalQty)} description="Quantité totale à charger." />
          <SummaryCard title="Colis" value={formatNumber(totals.totalColis)} description="Colis estimés depuis Entrée." />
          <SummaryCard title="Valeur" value={formatMoney(totals.totalValue)} description="Total estimé PU × quantité." />
        </Box>

        <Paper className="no-print" variant="outlined" sx={{ p: 1.25, borderRadius: 3, bgcolor: "background.paper" }}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={1.2}>
            <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
              <Button variant="outlined" onClick={goBack}>Retour Parking</Button>
              <Button variant="outlined" onClick={loadData} disabled={loading}>Actualiser</Button>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, display: { xs: "none", md: "block" } }} />
              <Button variant="outlined" onClick={buildTemplate} disabled={loading}>Réinitialiser document</Button>
              <Button variant="contained" onClick={onPrint} disabled={loading || !!error}>Imprimer / PDF</Button>
            </Stack>
            <Chip color={loading ? "info" : error ? "warning" : "success"} label={loading ? "Chargement..." : error ? "Erreur" : "Document prêt"} />
          </Stack>
        </Paper>

        {info ? <Alert severity="success" className="no-print">{info}</Alert> : null}
        {error ? <Alert severity="error" className="no-print">{error}</Alert> : null}
        {loading ? (
          <Paper variant="outlined" className="no-print" sx={{ p: 4, borderRadius: 3 }}>
            <Stack alignItems="center" spacing={2}>
              <CircularProgress />
              <Typography variant="body2" sx={{ color: "text.secondary" }}>Chargement du rapport...</Typography>
            </Stack>
          </Paper>
        ) : null}

        <Paper
          id="print-area"
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 4,
            border: "1px solid",
            borderColor: "divider",
            backgroundColor: "background.paper",
            boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
          }}
        >
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5 }} className="no-print">
            Cliquez dans le document pour modifier le texte avant impression.
          </Typography>
          <Box
            sx={{ minHeight: 640, outline: "none", "&:focus": { boxShadow: "inset 0 0 0 2px rgba(59,130,246,.35)", borderRadius: 2 } }}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => setDocHtml((e.currentTarget as HTMLDivElement).innerHTML)}
            dangerouslySetInnerHTML={{ __html: docHtml }}
          />
        </Paper>
      </Stack>
    </Box>
  );
}

import * as React from "react";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

// -----------------------------
// Types
// -----------------------------
type ParkingReservationDb = {
  reservation_id: number;
  client: string | null;
  created_at: string | null;
};

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

function safeNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeId(v: unknown) {
  return String(v ?? "").trim();
}

// -----------------------------
// Page
// -----------------------------
export default function RapportDeChargePage() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();

  // rid can come from:
  //  - query param: ?rid=123
  //  - navigation state: { rid: 123 }
  const ridFromQuery = params.get("rid");
  const ridFromState = (loc.state as any)?.rid;
  const reservationId = Number(ridFromQuery ?? ridFromState);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");
  const [info, setInfo] = React.useState<string>("");

  const [client, setClient] = React.useState<string>("");
  const [createdAt, setCreatedAt] = React.useState<string>("");

  const [items, setItems] = React.useState<
    Array<{
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
    }>
  >([]);

  // editable "Word-like" document HTML
  const [docHtml, setDocHtml] = React.useState<string>("");

  const totals = React.useMemo(() => {
    const totalQty = items.reduce((acc, it) => acc + safeNum(it.reserved_qty, 0), 0);
    const totalColis = items.reduce((acc, it) => acc + safeNum(it.colis, 0), 0);
    const totalValue = items.reduce((acc, it) => acc + safeNum(it.pu, 0) * safeNum(it.reserved_qty, 0), 0);
    return {
      totalQty,
      totalColis,
      totalValue,
    };
  }, [items]);

  const buildTemplate = React.useCallback(() => {
    const dateNow = dayjs().format("DD/MM/YYYY");
    const created = createdAt ? dayjs(createdAt).format("DD/MM/YYYY HH:mm") : "";

    const rowsHtml = items
      .map((it, idx) => {
        return `
          <tr>
            <td style="padding:6px;border:1px solid #ddd;">${idx + 1}</td>
            <td style="padding:6px;border:1px solid #ddd;">${it.lot}</td>
            <td style="padding:6px;border:1px solid #ddd;">${it.date_production || ""}</td>
            <td style="padding:6px;border:1px solid #ddd;">${it.produit}</td>
            <td style="padding:6px;border:1px solid #ddd;">${it.calibre}</td>
            <td style="padding:6px;border:1px solid #ddd;">${it.qualite}</td>
            <td style="padding:6px;border:1px solid #ddd;text-align:right;">${it.reserved_qty}</td>
            <td style="padding:6px;border:1px solid #ddd;text-align:right;">${it.colis ?? ""}</td>
            <td style="padding:6px;border:1px solid #ddd;text-align:right;">${it.pu ?? ""}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <div style="font-family: Arial, sans-serif; color:#111;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
          <div>
            <div style="font-size:20px;font-weight:700;">RAPPORT DE CHARGE</div>
            <div style="margin-top:4px;color:#444;">Document de vente / livraison</div>
          </div>
          <div style="text-align:right;">
            <div><b>Date:</b> ${dateNow}</div>
            <div><b>Réservation #:</b> ${Number.isFinite(reservationId) ? reservationId : ""}</div>
            <div><b>Créé:</b> ${created}</div>
          </div>
        </div>

        <hr style="margin:14px 0;border:none;border-top:1px solid #ddd;" />

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div><b>Client:</b> ${client || ""}</div>
          <div><b>Matériel Transport:</b> __________________________</div>
          <div><b>Chauffeur:</b> ________________________________</div>
          <div><b>Destination:</b> ______________________________</div>
        </div>

        <div style="margin-top:14px;font-weight:700;">Détails de la marchandise</div>

        <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px;">
          <thead>
            <tr>
              <th style="padding:6px;border:1px solid #ddd;background:#f5f5f5;">#</th>
              <th style="padding:6px;border:1px solid #ddd;background:#f5f5f5;">Lot</th>
              <th style="padding:6px;border:1px solid #ddd;background:#f5f5f5;">Date Prod</th>
              <th style="padding:6px;border:1px solid #ddd;background:#f5f5f5;">Produit</th>
              <th style="padding:6px;border:1px solid #ddd;background:#f5f5f5;">Calibre</th>
              <th style="padding:6px;border:1px solid #ddd;background:#f5f5f5;">Qualité</th>
              <th style="padding:6px;border:1px solid #ddd;background:#f5f5f5;">Quantité</th>
              <th style="padding:6px;border:1px solid #ddd;background:#f5f5f5;">Colis</th>
              <th style="padding:6px;border:1px solid #ddd;background:#f5f5f5;">PU</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || ""}
          </tbody>
        </table>

        <div style="display:flex;justify-content:flex-end;margin-top:10px;">
          <div style="min-width:320px;border:1px solid #ddd;padding:10px;border-radius:8px;">
            <div style="display:flex;justify-content:space-between;"><span><b>Total Quantité</b></span><span>${totals.totalQty}</span></div>
            <div style="display:flex;justify-content:space-between;"><span><b>Total Colis</b></span><span>${totals.totalColis}</span></div>
            <div style="display:flex;justify-content:space-between;"><span><b>Total (PU×Qte)</b></span><span>${totals.totalValue.toFixed(2)}</span></div>
          </div>
        </div>

        <div style="margin-top:14px;">
          <b>Remarques:</b>
          <div style="margin-top:6px;">
            - Marchandise chargée et remise au transporteur.<br/>
            - Le client confirme la réception conformément aux quantités ci-dessus.<br/>
            - Toute réclamation doit être signalée immédiatement.
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:22px;">
          <div>
            <div><b>Signature Vendeur</b></div>
            <div style="margin-top:40px;border-top:1px solid #333;width:240px;"></div>
          </div>
          <div>
            <div><b>Signature Acheteur</b></div>
            <div style="margin-top:40px;border-top:1px solid #333;width:240px;"></div>
          </div>
        </div>
      </div>
    `;

    setDocHtml(html);
  }, [client, createdAt, items, totals.totalQty, totals.totalColis, totals.totalValue, reservationId]);

  const loadData = React.useCallback(async () => {
    if (!Number.isFinite(reservationId) || reservationId <= 0) {
      setError("Missing reservation id. Go back to Parking and click Send on a reservation.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setInfo("");

    try {
      // 1) reservation
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

      // 2) items
      const { data: its, error: iErr } = await supabase
        .from("parking_items")
        .select("id, reservation_id, entree_id, lot, code_prp, produit, calibre, qualite, reserved_qty")
        .eq("reservation_id", reservationId);

      if (iErr) throw new Error(iErr.message);

      const itemsDb = (its ?? []) as any as ParkingItemDb[];

      const entreeIds = Array.from(
        new Set(itemsDb.map((x) => normalizeId(x.entree_id)).filter(Boolean))
      );

      // 3) fetch entree details
      let entreeMap = new Map<string, EntreeRowDb>();
      if (entreeIds.length) {
        const { data: ents, error: eErr } = await supabase
          .from("entree")
          .select("id, lot, code_prp, date_production, produit, calibre, qualite, pct_ctrl, gr_mn, gr_mx, emballage, pu, colis, quantite")
          .in("id", entreeIds);

        if (eErr) throw new Error(eErr.message);

        for (const e of (ents ?? []) as any[]) {
          entreeMap.set(String(e.id), e as EntreeRowDb);
        }
      }

      const uiItems = itemsDb.map((it) => {
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

      // build document after data loads
      // (delay 1 tick so state is applied)
      setTimeout(() => {
        setInfo("Document ready. You can edit it, then print as PDF.");
      }, 0);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load reservation.");
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // rebuild template when core values change (client/items)
  React.useEffect(() => {
    if (!loading && !error) buildTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, client, createdAt, items]);

  const onPrint = () => {
    setInfo("");
    setError("");
    // Browser print dialog -> user chooses "Save as PDF"
    window.print();
  };

  const goBack = () => nav("/parking");

  return (
    <Box>
      {/* Print CSS: hide app chrome + buttons; print only the document */}
      <style>
        {`
          @media print {
            /* Hide MUI drawer/appbar/footer if present */
            .MuiDrawer-root, .MuiAppBar-root, footer, .no-print { display: none !important; }
            body { background: white !important; }
            #print-area { box-shadow: none !important; border: none !important; }
          }
        `}
      </style>

      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" className="no-print">
          <Box>
            <Typography variant="h5">Rapport de charge</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Editable document (Word-like). Use Print to save as PDF.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={Number.isFinite(reservationId) ? `Reservation #${reservationId}` : "No reservation"} />
            <Button variant="outlined" onClick={goBack}>
              Back
            </Button>
            <Button variant="outlined" onClick={buildTemplate} disabled={loading}>
              Reset template
            </Button>
            <Button variant="contained" onClick={onPrint} disabled={loading || !!error}>
              Print / Save PDF
            </Button>
          </Stack>
        </Stack>

        {info ? <Alert severity="success" className="no-print">{info}</Alert> : null}
        {error ? <Alert severity="error" className="no-print">{error}</Alert> : null}
        {loading ? <Alert severity="info" className="no-print">Loading…</Alert> : null}

        <Divider className="no-print" />

        <Paper
          id="print-area"
          sx={{
            p: 3,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            backgroundColor: "background.paper",
          }}
        >
          <Typography variant="caption" sx={{ color: "text.secondary" }} className="no-print">
            Click inside the document and edit freely. (This is a contentEditable page.)
          </Typography>

          <Box
            sx={{
              mt: 2,
              minHeight: 600,
              outline: "none",
            }}
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
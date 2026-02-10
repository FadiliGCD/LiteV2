import * as React from "react";
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

type ParkingItem = {
  entreeRowId: string; // link to entree row (kept as-is)
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

const PARKING_KEY = "lite-v2.parking.v1";

// example clients for now
const CLIENTS = ["Client Atlas", "Client Marina", "Client Sahara"];

function loadParking(): ParkingReservation[] {
  try {
    const raw = localStorage.getItem(PARKING_KEY);
    const arr = raw ? (JSON.parse(raw) as ParkingReservation[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveParking(list: ParkingReservation[]) {
  localStorage.setItem(PARKING_KEY, JSON.stringify(list));
}

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

export default function ParkingPage() {
  const [reservations, setReservations] = React.useState<ParkingReservation[]>(() => loadParking());
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const [info, setInfo] = React.useState<string>("");
  const [error, setError] = React.useState<string>("");

  // delete confirm
  const [openDelete, setOpenDelete] = React.useState(false);

  // modify dialog
  const [openModify, setOpenModify] = React.useState(false);
  const [editReservationId, setEditReservationId] = React.useState<string>("");
  const [editClient, setEditClient] = React.useState<string>("");
  const [editItems, setEditItems] = React.useState<ParkingItem[]>([]);

  const selected = React.useMemo(
    () => reservations.find((r) => r.reservationId === selectedId) ?? null,
    [reservations, selectedId]
  );

  // keep selection valid after changes
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
      { field: "itemsCount", headerName: "Items", width: 90, type: "number" },
      { field: "totalQty", headerName: "Total Qty", width: 110, type: "number" },
    ];
  }, []);

  const rows = React.useMemo(() => {
    return reservations.map((r) => ({
      id: r.reservationId, // DataGrid row id
      reservationId: r.reservationId,
      client: r.client,
      createdAt: fmtDate(r.createdAt),
      itemsCount: r.items?.length ?? 0,
      totalQty: sumQty(r.items ?? []),
    }));
  }, [reservations]);

  const refresh = () => {
    const data = loadParking();
    setReservations(data);
    setInfo("Refreshed.");
    setError("");
  };

  const openModifyDialog = () => {
    if (!selected) return;
    setInfo("");
    setError("");

    setEditReservationId(String(selected.reservationId));
    setEditClient(selected.client ?? "");
    setEditItems(
      (selected.items ?? []).map((it) => ({
        ...it,
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

    // If changing ID, ensure uniqueness
    if (selected && newId !== selected.reservationId) {
      const exists = reservations.some((r) => r.reservationId === newId);
      if (exists) return `Reservation ID ${newId} already exists. Choose another.`;
    }

    return "";
  };

  const confirmModify = () => {
    if (!selected) return;

    const msg = validateEdit();
    if (msg) {
      setError(msg);
      return;
    }

    const newId = Number(editReservationId);

    const cleanedItems: ParkingItem[] = editItems.map((it) => ({
      entreeRowId: String(it.entreeRowId ?? ""),
      Lot: String(it.Lot ?? ""),
      Code_Prp: String(it.Code_Prp ?? ""),
      Produit: String(it.Produit ?? ""),
      Calibre: String(it.Calibre ?? ""),
      Qualite: String(it.Qualite ?? ""),
      reservedQty: safeNum(it.reservedQty, 0),
    }));

    const updated: ParkingReservation[] = reservations.map((r) => {
      if (r.reservationId !== selected.reservationId) return r;
      return {
        ...r,
        reservationId: newId,
        client: editClient,
        items: cleanedItems,
      };
    });

    saveParking(updated);
    setReservations(updated);
    setSelectedId(newId);
    setOpenModify(false);
    setError("");
    setInfo(`Reservation updated (#${newId}).`);
  };

  const openDeleteDialog = () => {
    setInfo("");
    setError("");
    setOpenDelete(true);
  };

  const confirmDelete = () => {
    if (!selected) return;

    const updated = reservations.filter((r) => r.reservationId !== selected.reservationId);
    saveParking(updated);
    setReservations(updated);
    setSelectedId(null);
    setOpenDelete(false);
    setError("");
    setInfo(`Deleted reservation #${selected.reservationId}.`);
  };

  const handleSend = () => {
    if (!selected) return;
    setError("");
    setInfo("Send: will be implemented later (printable Word/PDF step).");
  };

  const handleSell = () => {
    if (!selected) return;
    setError("");
    setInfo("Sell: will be implemented later (push to Sortie).");
  };

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
            Select a reservation to enable actions.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip variant="outlined" label={`Reservations: ${reservations.length}`} />
          {selected ? <Chip color="info" label={`Selected: #${selected.reservationId}`} /> : <Chip label="No selection" />}
        </Stack>
      </Stack>

      <Paper sx={{ p: 1.2, borderRadius: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Button variant="outlined" onClick={refresh}>
            Refresh
          </Button>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

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

          <Button variant="contained" color="success" onClick={handleSell} disabled={!selected}>
            Sell
          </Button>
        </Stack>
      </Paper>

      {info ? <Alert severity="success">{info}</Alert> : null}
      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Paper sx={{ p: 1.2, borderRadius: 3 }}>
        <Box sx={{ height: 420, width: "100%" }}>
          <DataGrid
            rows={rows}
            columns={columns}
            getRowId={(r) => r.id}
            disableRowSelectionOnClick={false}
            hideFooterSelectedRowCount
            initialState={{ density: "compact" }}
            onRowClick={(params) => {
              setSelectedId(Number(params.row.reservationId));
              setInfo("");
              setError("");
            }}
          />
        </Box>
      </Paper>

      {/* Details */}
      <Paper sx={{ p: 1.2, borderRadius: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Reservation Details
        </Typography>

        {!selected ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Click a reservation above to see its items.
          </Typography>
        ) : (
          <Stack spacing={1}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <Chip label={`Reservation ID: ${selected.reservationId}`} />
              <Chip label={`Client: ${selected.client}`} />
              <Chip label={`Created: ${fmtDate(selected.createdAt)}`} />
              <Chip label={`Total Qty: ${sumQty(selected.items ?? [])}`} />
            </Stack>

            <Paper variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Lot</TableCell>
                    <TableCell>Code_Prp</TableCell>
                    <TableCell>Produit</TableCell>
                    <TableCell>Calibre</TableCell>
                    <TableCell>Qualite</TableCell>
                    <TableCell align="right">Reserved Qty</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(selected.items ?? []).map((it, idx) => (
                    <TableRow key={`${it.entreeRowId}-${idx}`}>
                      <TableCell>{it.Lot}</TableCell>
                      <TableCell>{it.Code_Prp}</TableCell>
                      <TableCell>{it.Produit}</TableCell>
                      <TableCell>{it.Calibre}</TableCell>
                      <TableCell>{it.Qualite}</TableCell>
                      <TableCell align="right">{it.reservedQty}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Stack>
        )}
      </Paper>

      {/* DELETE dialog */}
      <Dialog open={openDelete} onClose={() => setOpenDelete(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete reservation</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete reservation{" "}
            <b>{selected ? `#${selected.reservationId}` : ""}</b>?
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
            (For now, deleting a reservation does NOT restore quantities back to Entreé. We can add that later.)
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
                        <TextField
                          value={it.Lot}
                          onChange={(e) => updateItem(idx, { Lot: e.target.value })}
                          size="small"
                          fullWidth
                        />
                      </TableCell>

                      <TableCell>
                        <TextField
                          value={it.Code_Prp}
                          onChange={(e) => updateItem(idx, { Code_Prp: e.target.value })}
                          size="small"
                          fullWidth
                        />
                      </TableCell>

                      <TableCell>
                        <TextField
                          value={it.Produit}
                          onChange={(e) => updateItem(idx, { Produit: e.target.value })}
                          size="small"
                          fullWidth
                        />
                      </TableCell>

                      <TableCell>
                        <TextField
                          value={it.Calibre}
                          onChange={(e) => updateItem(idx, { Calibre: e.target.value })}
                          size="small"
                          fullWidth
                        />
                      </TableCell>

                      <TableCell>
                        <TextField
                          value={it.Qualite}
                          onChange={(e) => updateItem(idx, { Qualite: e.target.value })}
                          size="small"
                          fullWidth
                        />
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
                Note: For now, editing quantities here does not adjust Entreé quantities automatically.
                We’ll sync this with Entreé later (restore/consume).
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

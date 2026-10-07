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

import type {

  GridColDef,

  GridCellParams,

  GridFilterModel,

  GridRowId,

  GridRowSelectionModel,

} from "@mui/x-data-grid";



import type { Emballage, Produit, Qualite } from "@lite/shared";

import {

  PRODUIT_OPTIONS,

  QUALITE_OPTIONS,

  EMBALLAGE_OPTIONS,

  CALIBRE_BY_PRODUIT,

} from "@lite/shared";



import { supabase } from "../lib/supabaseClient";
import useStockAccess from "../auth/useStockAccess";
import { ensureFreshSession } from "../auth/auth";



/**

 * UI fields

 */

type SortieRow = {

  id: string;



  Date_Chg: string;

  Dossier: string;

  Client: string;

  Mat_Transport: string;



  Lot: string;

  Date_production: string;

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



function makeId() {

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;

}



function todayISO() {

  return dayjs().format("YYYY-MM-DD");

}



function stableStringify(obj: unknown) {

  return JSON.stringify(obj);

}



function newEmptyRow(): SortieRow {

  return {

    id: makeId(),

    Date_Chg: todayISO(),

    Dossier: "",

    Client: "",

    Mat_Transport: "",

    Lot: "",

    Date_production: "",

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



// ✅ FIX: keep this outside SortiePage so filter inputs do not lose focus

function FilterRow({ children }: { children: React.ReactNode }) {

  return (

    <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>

      {children}

    </Stack>

  );

}



/**

 * DB row shape

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

    id: String(r.id),

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

    id: r.id,

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

  const { can, loadingAccess, role } = useStockAccess();

  const canView = can("sortie_view");
  const canCreate = can("sortie_create");
  const canUpdate = can("sortie_update");
  const canDelete = can("sortie_delete");
  const canSaveAnyChange = canCreate || canUpdate || canDelete;

  const apiRef = useGridApiRef();



  const [rows, setRows] = React.useState<SortieRow[]>([]);

  const [lastSavedRows, setLastSavedRows] = React.useState<SortieRow[]>([]);

  const [deletedIds, setDeletedIds] = React.useState<Set<string>>(new Set());



  const [loading, setLoading] = React.useState(true);



  const [filterModel, setFilterModel] = React.useState<GridFilterModel>({

    items: [],

  });



  const [info, setInfo] = React.useState<string>("");

  const [errorMessages, setErrorMessages] = React.useState<string[]>([]);



  const [selectedRowIds, setSelectedRowIds] =

    React.useState<GridRowSelectionModel>({

      type: "include",

      ids: new Set<GridRowId>(),

    });



  const selectedIdsArray = React.useMemo(

    () => Array.from(selectedRowIds.ids ?? []),

    [selectedRowIds]

  );



  const [openFilter, setOpenFilter] = React.useState(false);

  const [filterForm, setFilterForm] = React.useState<FilterForm>(() =>

    emptyFilterForm()

  );



  const [openNew, setOpenNew] = React.useState(false);

  const [draft, setDraft] = React.useState<SortieRow>(() => newEmptyRow());



  const [openDeleteRows, setOpenDeleteRows] = React.useState(false);



  const hasUnsavedChanges = React.useMemo(() => {

    if (deletedIds.size) return true;

    return stableStringify(rows) !== stableStringify(lastSavedRows);

  }, [rows, lastSavedRows, deletedIds]);



  const fetchRows = React.useCallback(async () => {

    setLoading(true);

    setInfo("");

    setErrorMessages([]);



    try {

      const { data, error } = await supabase

        .from("sortie")

        .select(

          "id, date_chg, dossier, client, mat_transport, lot, date_production, produit, calibre, qualite, pct_ctrl, gr_mn, gr_mx, emballage, pu, colis, quantite"

        )

        .order("created_at", { ascending: false });



      if (error) throw new Error(error.message);



      const ui = (data as SortieDbRow[]).map(dbToUi);

      setRows(ui);

      setLastSavedRows(ui);

      setDeletedIds(new Set());

    } catch (e: any) {

      setErrorMessages([e?.message ?? "Failed to load Sortie"]);



      setRows([]);

      setLastSavedRows([]);

      setDeletedIds(new Set());

    } finally {

      setLoading(false);

    }

  }, []);



  React.useEffect(() => {

    if (loadingAccess) return;

    if (!canView) {
      setLoading(false);
      return;
    }

    fetchRows();

  }, [fetchRows, loadingAccess, canView]);



  const handleCellClick = React.useCallback(

    (params: GridCellParams) => {

      if (!canUpdate) return;

      apiRef.current?.startCellEditMode({

        id: params.id,

        field: params.field,

      });

    },

    [apiRef, canUpdate]

  );



  const columns = React.useMemo<GridColDef<SortieRow>[]>(() => {

    const numericCol = (

      field: keyof SortieRow,

      headerName: string,

      width: number

    ): GridColDef<SortieRow> => ({

      field: field as string,

      headerName,

      width,

      editable: canUpdate,

      type: "number",

      valueParser: (value) => toNumberOrNull(value),

      valueSetter: (value, row) =>

        ({ ...row, [field]: toNumberOrNull(value) }) as SortieRow,

    });



    return [

      {

        field: "Date_Chg",

        headerName: "Date Chg",

        width: 130,

        editable: canUpdate,

      },

      {

        field: "Dossier",

        headerName: "Dossier",

        width: 140,

        editable: canUpdate,

      },

      {

        field: "Client",

        headerName: "Client",

        width: 180,

        editable: canUpdate,

      },

      {

        field: "Mat_Transport",

        headerName: "Mat Transport",

        width: 160,

        editable: canUpdate,

      },

      {

        field: "Lot",

        headerName: "Lot",

        width: 140,

        editable: canUpdate,

      },

      {

        field: "Date_production",

        headerName: "Date Production",

        width: 150,

        editable: canUpdate,

      },

      {

        field: "Produit",

        headerName: "Produit",

        width: 170,

        editable: canUpdate,

        type: "singleSelect",

        valueOptions: PRODUIT_OPTIONS,

      },

      {

        field: "Calibre",

        headerName: "Calibre",

        width: 140,

        editable: canUpdate,

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

        editable: canUpdate,

        type: "singleSelect",

        valueOptions: QUALITE_OPTIONS,

      },

      {

        ...numericCol("%_Ctrl", "% Ctrl", 95),

        valueFormatter: (value) =>

          value == null || value === "" ? "" : `${value}%`,

      },

      numericCol("Gr_mn", "Gr mn", 95),

      numericCol("Gr_mx", "Gr mx", 95),

      {

        field: "Emballage",

        headerName: "Emballage",

        width: 120,

        editable: canUpdate,

        type: "singleSelect",

        valueOptions: EMBALLAGE_OPTIONS,

      },

      numericCol("PU", "PU", 90),

      numericCol("Colis", "Colis", 90),

      numericCol("Quantite", "Quantite", 110),

    ];

  }, [canUpdate]);



  const openNewEntry = () => {

    if (!canCreate) {
      setErrorMessages(["Vous n'avez pas la permission d'ajouter une sortie."]);
      return;
    }

    setInfo("");

    setErrorMessages([]);

    setDraft(newEmptyRow());

    setOpenNew(true);

  };



  const saveNewEntry = () => {

    if (!canCreate) {
      setErrorMessages(["Vous n'avez pas la permission d'ajouter une sortie."]);
      return;
    }

    const row: SortieRow = {

      ...draft,

      id: makeId(),

      Calibre: draft.Calibre?.trim() ? draft.Calibre : "nan",

      Date_Chg: draft.Date_Chg?.trim() ? draft.Date_Chg : todayISO(),

    };



    setRows((prev) => [row, ...prev]);

    setOpenNew(false);

    setInfo("Nouvelle sortie ajoutée au tableau. Cliquez sur Sauvegarder.");

  };



  const handleSave = async () => {

    try {
      await ensureFreshSession();

      setInfo("");

      setErrorMessages([]);



      const lastSavedMap = new Map(lastSavedRows.map((row) => [row.id, row]));

      const existingChanged = rows.filter((row) => {
        const saved = lastSavedMap.get(row.id);
        if (!saved) return false;
        return stableStringify(row) !== stableStringify(saved);
      });

      const fresh = rows.filter((row) => !lastSavedMap.has(row.id));



      if (deletedIds.size && !canDelete) {
        setErrorMessages(["Vous n'avez pas la permission de supprimer des sorties."]);
        return;
      }

      if (existingChanged.length && !canUpdate) {
        setErrorMessages([
          "Vous n'avez pas la permission de modifier les sorties existantes.",
        ]);
        return;
      }

      if (fresh.length && !canCreate) {
        setErrorMessages(["Vous n'avez pas la permission d'ajouter des sorties."]);
        return;
      }



      if (deletedIds.size) {

        const ids = Array.from(deletedIds);



        const { error: delErr } = await supabase

          .from("sortie")

          .delete()

          .in("id", ids);



        if (delErr) throw new Error(delErr.message);

      }



      const payload = [...existingChanged, ...fresh].map((r) => uiToDb(r));

      if (payload.length) {
        const { error: upErr } = await supabase

          .from("sortie")

          .upsert(payload, { onConflict: "id" });



        if (upErr) throw new Error(upErr.message);
      }



      await fetchRows();

      setDeletedIds(new Set());

      setInfo("Sauvegardé dans la base de données.");

    } catch (e: any) {

      setErrorMessages([e?.message ?? "La sauvegarde a échoué."]);

    }

  };



  const handleCancel = () => {

    setRows(lastSavedRows);

    setDeletedIds(new Set());

    setInfo("Modifications annulées.");

    setErrorMessages([]);

  };



  const handleRefresh = async () => {

    await fetchRows();

    setInfo("Actualisé depuis la base de données.");

  };



  const openDeleteSelected = () => {

    if (!canDelete) {
      setErrorMessages(["Vous n'avez pas la permission de supprimer des sorties."]);
      return;
    }

    if (!selectedIdsArray.length) {

      setErrorMessages(["Sélectionnez au moins une ligne à supprimer."]);

      return;

    }



    setErrorMessages([]);

    setInfo("");

    setOpenDeleteRows(true);

  };



  const confirmDeleteSelected = () => {

    if (!canDelete) {
      setErrorMessages(["Vous n'avez pas la permission de supprimer des sorties."]);
      return;
    }

    const idsToDelete = new Set(selectedIdsArray.map(String));



    setDeletedIds((prev) => {

      const next = new Set(prev);



      for (const id of idsToDelete) {

        next.add(String(id));

      }



      return next;

    });



    const updated = rows.filter((r) => !idsToDelete.has(String(r.id)));

    const finalRows = updated.length ? updated : [newEmptyRow()];



    setRows(finalRows);

    setSelectedRowIds({ type: "include", ids: new Set() } as any);

    setOpenDeleteRows(false);

    setInfo(`Ligne(s) supprimée(s): ${selectedIdsArray.length}. Cliquez sur Sauvegarder.`);

  };



  const hasAnyMultiFilter = (f: FilterForm) =>

    Object.values(f).some((v) => String(v ?? "").trim() !== "");



  const buildFilterModelFromForm = (f: FilterForm): GridFilterModel => {

    const items: any[] = [];



    if (f.Date_from.trim()) {

      items.push({

        field: "Date_Chg",

        operator: ">=",

        value: f.Date_from.trim(),

      });

    }



    if (f.Date_to.trim()) {

      items.push({

        field: "Date_Chg",

        operator: "<=",

        value: f.Date_to.trim(),

      });

    }



    if (f.Dossier.trim()) {

      items.push({

        field: "Dossier",

        operator: "contains",

        value: f.Dossier.trim(),

      });

    }



    if (f.Client.trim()) {

      items.push({

        field: "Client",

        operator: "contains",

        value: f.Client.trim(),

      });

    }



    if (f.Mat_Transport.trim()) {

      items.push({

        field: "Mat_Transport",

        operator: "contains",

        value: f.Mat_Transport.trim(),

      });

    }



    if (f.Lot.trim()) {

      items.push({

        field: "Lot",

        operator: "contains",

        value: f.Lot.trim(),

      });

    }



    if (f.DateProd_from.trim()) {

      items.push({

        field: "Date_production",

        operator: ">=",

        value: f.DateProd_from.trim(),

      });

    }



    if (f.DateProd_to.trim()) {

      items.push({

        field: "Date_production",

        operator: "<=",

        value: f.DateProd_to.trim(),

      });

    }



    if (f.Produit.trim()) {

      items.push({

        field: "Produit",

        operator: "equals",

        value: f.Produit.trim(),

      });

    }



    if (f.Calibre.trim()) {

      items.push({

        field: "Calibre",

        operator: "contains",

        value: f.Calibre.trim(),

      });

    }



    if (f.Qualite.trim()) {

      items.push({

        field: "Qualite",

        operator: "equals",

        value: f.Qualite.trim(),

      });

    }



    if (f.Emballage.trim()) {

      items.push({

        field: "Emballage",

        operator: "equals",

        value: f.Emballage.trim(),

      });

    }



    if (f.Quantite_min.trim()) {

      items.push({

        field: "Quantite",

        operator: ">=",

        value: f.Quantite_min.trim(),

      });

    }



    if (f.Quantite_max.trim()) {

      items.push({

        field: "Quantite",

        operator: "<=",

        value: f.Quantite_max.trim(),

      });

    }



    return { items };

  };



  const openFilterDialog = () => setOpenFilter(true);



  const applyFilter = () => {

    if (!hasAnyMultiFilter(filterForm)) {

      setFilterModel({ items: [] });

      setOpenFilter(false);

      setInfo("Filtre réinitialisé.");

      return;

    }



    setFilterModel(buildFilterModelFromForm(filterForm));

    setOpenFilter(false);

    setInfo("Filtre appliqué.");

  };



  const clearFilter = () => {

    setFilterForm(emptyFilterForm());

    setFilterModel({ items: [] });

    setInfo("Filtre réinitialisé.");

  };



  if (loadingAccess) {
    return (
      <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
        <CircularProgress />

        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Chargement des permissions...
        </Typography>
      </Stack>
    );
  }

  if (!canView) {
    return (
      <Alert severity="warning">
        Vous n'avez pas accès à la page Sortie.
      </Alert>
    );
  }

  return (

    <Stack spacing={2}>

      <Stack

        direction="row"

        alignItems="flex-start"

        justifyContent="space-between"

        spacing={2}

      >

        <Box>

          <Typography variant="h5">Sortie</Typography>



          <Typography variant="body2" sx={{ color: "text.secondary" }}>

            Base de données des sorties de produits.

          </Typography>

        </Box>



        <Stack direction="row" spacing={1} alignItems="center">

          {hasUnsavedChanges ? (

            <Chip color="warning" label="Modifications non sauvegardées" />

          ) : (

            <Chip color="success" label="Sauvegardé" />

          )}



          <Chip variant="outlined" label={`Lignes: ${rows.length}`} />



          {loading ? (

            <Chip color="info" label="Chargement..." />

          ) : (

            <Chip color="success" label="En ligne" />

          )}

          <Chip variant="outlined" label={`Rôle: ${role || "user"}`} />

        </Stack>

      </Stack>



      <Paper sx={{ p: 1.2, borderRadius: 3 }}>

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">

          <Button variant="outlined" onClick={handleRefresh} disabled={loading}>

            Actualiser

          </Button>



          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />



          <Button variant="contained" onClick={openNewEntry} disabled={loading || !canCreate}>

            Nouvelle sortie

          </Button>



          <Button

            variant="outlined"

            onClick={handleSave}

            disabled={loading || !canSaveAnyChange || !hasUnsavedChanges}

          >

            Sauvegarder

          </Button>



          <Button variant="text" onClick={handleCancel} disabled={loading || !hasUnsavedChanges}>

            Annuler

          </Button>



          <Button

            variant="outlined"

            color="error"

            onClick={openDeleteSelected}

            disabled={loading || !canDelete || !selectedIdsArray.length}

          >

            Supprimer

          </Button>



          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />



          <Button variant="outlined" onClick={openFilterDialog}>

            Filtrer

          </Button>



          <Button variant="text" onClick={clearFilter}>

            Réinitialiser filtre

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

            checkboxSelection

            disableRowSelectionOnClick

            rowSelectionModel={selectedRowIds}

            onRowSelectionModelChange={(m) => setSelectedRowIds(m as any)}

            filterModel={filterModel}

            onFilterModelChange={(m) => setFilterModel(m)}

            slots={{ toolbar: GridToolbar }}

            slotProps={{ toolbar: { showQuickFilter: false } as any }}

            onCellClick={handleCellClick}

            processRowUpdate={(newRow: SortieRow) => {

              if (!canUpdate) {
                return rows.find((r) => r.id === newRow.id) ?? newRow;
              }

              const cleaned: SortieRow = {

                ...newRow,

                Calibre: newRow.Calibre?.trim() ? newRow.Calibre : "nan",

                Date_Chg: newRow.Date_Chg?.trim()

                  ? newRow.Date_Chg

                  : todayISO(),

              };



              setRows((prev) =>

                prev.map((r) => (r.id === cleaned.id ? cleaned : r))

              );



              return cleaned;

            }}

            isCellEditable={() => canUpdate}

          />

        </Box>

      </Paper>



      {/* DELETE dialog */}

      <Dialog

        open={openDeleteRows}

        onClose={() => setOpenDeleteRows(false)}

        maxWidth="sm"

        fullWidth

      >

        <DialogTitle>Supprimer les lignes sélectionnées</DialogTitle>



        <DialogContent>

          <Typography variant="body2">

            Voulez-vous vraiment supprimer <b>{selectedIdsArray.length}</b>{" "}

            ligne(s) ?

          </Typography>



          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>

            Cela les supprimera du tableau. Cliquez sur <b>Sauvegarder</b> pour appliquer dans la base de données.

          </Typography>

        </DialogContent>



        <DialogActions sx={{ p: 2 }}>

          <Button onClick={() => setOpenDeleteRows(false)}>Annuler</Button>



          <Button

            variant="contained"

            color="error"

            onClick={confirmDeleteSelected}

          >

            Delete

          </Button>

        </DialogActions>

      </Dialog>



      {/* FILTER dialog */}

      <Dialog

        open={openFilter}

        onClose={() => setOpenFilter(false)}

        maxWidth="lg"

        fullWidth

      >

        <DialogTitle>Filtrer Sortie</DialogTitle>



        <DialogContent sx={{ mt: 1 }}>

          <FilterRow>

            <TextField

              label="Date Chg from"

              type="date"

              value={filterForm.Date_from}

              onChange={(e) =>

                setFilterForm((p) => ({ ...p, Date_from: e.target.value }))

              }

              InputLabelProps={{ shrink: true }}

              fullWidth

            />



            <TextField

              label="Date Chg to"

              type="date"

              value={filterForm.Date_to}

              onChange={(e) =>

                setFilterForm((p) => ({ ...p, Date_to: e.target.value }))

              }

              InputLabelProps={{ shrink: true }}

              fullWidth

            />



            <TextField

              label="Dossier contains"

              value={filterForm.Dossier}

              onChange={(e) =>

                setFilterForm((p) => ({ ...p, Dossier: e.target.value }))

              }

              fullWidth

            />

          </FilterRow>



          <FilterRow>

            <TextField

              label="Client contains"

              value={filterForm.Client}

              onChange={(e) =>

                setFilterForm((p) => ({ ...p, Client: e.target.value }))

              }

              fullWidth

            />



            <TextField

              label="Mat Transport contains"

              value={filterForm.Mat_Transport}

              onChange={(e) =>

                setFilterForm((p) => ({

                  ...p,

                  Mat_Transport: e.target.value,

                }))

              }

              fullWidth

            />



            <TextField

              label="Lot contains"

              value={filterForm.Lot}

              onChange={(e) =>

                setFilterForm((p) => ({ ...p, Lot: e.target.value }))

              }

              fullWidth

            />

          </FilterRow>



          <FilterRow>

            <TextField

              label="Date Production from"

              type="date"

              value={filterForm.DateProd_from}

              onChange={(e) =>

                setFilterForm((p) => ({

                  ...p,

                  DateProd_from: e.target.value,

                }))

              }

              InputLabelProps={{ shrink: true }}

              fullWidth

            />



            <TextField

              label="Date Production to"

              type="date"

              value={filterForm.DateProd_to}

              onChange={(e) =>

                setFilterForm((p) => ({

                  ...p,

                  DateProd_to: e.target.value,

                }))

              }

              InputLabelProps={{ shrink: true }}

              fullWidth

            />



            <FormControl fullWidth>

              <InputLabel>Produit</InputLabel>



              <Select

                label="Produit"

                value={filterForm.Produit}

                onChange={(e) =>

                  setFilterForm((p) => ({

                    ...p,

                    Produit: String(e.target.value),

                  }))

                }

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

              onChange={(e) =>

                setFilterForm((p) => ({ ...p, Calibre: e.target.value }))

              }

              fullWidth

            />



            <FormControl fullWidth>

              <InputLabel>Qualite</InputLabel>



              <Select

                label="Qualite"

                value={filterForm.Qualite}

                onChange={(e) =>

                  setFilterForm((p) => ({

                    ...p,

                    Qualite: String(e.target.value),

                  }))

                }

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

                onChange={(e) =>

                  setFilterForm((p) => ({

                    ...p,

                    Emballage: String(e.target.value),

                  }))

                }

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

              onChange={(e) =>

                setFilterForm((p) => ({

                  ...p,

                  Quantite_min: e.target.value,

                }))

              }

              fullWidth

            />



            <TextField

              label="Quantite max"

              type="number"

              value={filterForm.Quantite_max}

              onChange={(e) =>

                setFilterForm((p) => ({

                  ...p,

                  Quantite_max: e.target.value,

                }))

              }

              fullWidth

            />

          </FilterRow>

        </DialogContent>



        <DialogActions sx={{ p: 2 }}>

          <Button onClick={() => setOpenFilter(false)}>Annuler</Button>



          <Button onClick={() => setFilterForm(emptyFilterForm())}>Réinitialiser</Button>



          <Button variant="contained" onClick={applyFilter}>

            Appliquer

          </Button>

        </DialogActions>

      </Dialog>



      {/* NEW ENTRY dialog */}

      <Dialog

        open={openNew}

        onClose={() => setOpenNew(false)}

        maxWidth="md"

        fullWidth

      >

        <DialogTitle>Nouvelle sortie</DialogTitle>



        <DialogContent>

          <Stack spacing={2} sx={{ mt: 1 }}>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>

              <TextField

                label="Date Chg"

                type="date"

                value={draft.Date_Chg}

                onChange={(e) =>

                  setDraft((p) => ({ ...p, Date_Chg: e.target.value }))

                }

                InputLabelProps={{ shrink: true }}

                fullWidth

              />



              <TextField

                label="Dossier"

                value={draft.Dossier}

                onChange={(e) =>

                  setDraft((p) => ({ ...p, Dossier: e.target.value }))

                }

                fullWidth

              />



              <TextField

                label="Client"

                value={draft.Client}

                onChange={(e) =>

                  setDraft((p) => ({ ...p, Client: e.target.value }))

                }

                fullWidth

              />



              <TextField

                label="Mat Transport"

                value={draft.Mat_Transport}

                onChange={(e) =>

                  setDraft((p) => ({

                    ...p,

                    Mat_Transport: e.target.value,

                  }))

                }

                fullWidth

              />

            </Stack>



            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>

              <TextField

                label="Lot"

                value={draft.Lot}

                onChange={(e) =>

                  setDraft((p) => ({ ...p, Lot: e.target.value }))

                }

                fullWidth

              />



              <TextField

                label="Date Production"

                type="date"

                value={draft.Date_production}

                onChange={(e) =>

                  setDraft((p) => ({

                    ...p,

                    Date_production: e.target.value,

                  }))

                }

                InputLabelProps={{ shrink: true }}

                fullWidth

              />



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

                  onChange={(e) =>

                    setDraft((p) => ({

                      ...p,

                      Calibre: e.target.value as string,

                    }))

                  }

                >

                  <MenuItem value="nan">nan</MenuItem>



                  {draft.Produit

                    ? CALIBRE_BY_PRODUIT[draft.Produit].map((o) => (

                        <MenuItem key={o} value={o}>

                          {o}

                        </MenuItem>

                      ))

                    : null}

                </Select>

              </FormControl>



              <FormControl fullWidth>

                <InputLabel>Qualite</InputLabel>



                <Select

                  label="Qualite"

                  value={draft.Qualite}

                  onChange={(e) =>

                    setDraft((p) => ({

                      ...p,

                      Qualite: e.target.value as any,

                    }))

                  }

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

                onChange={(e) =>

                  setDraft((p) => ({

                    ...p,

                    "%_Ctrl": toNumberOrNull(e.target.value),

                  }))

                }

                fullWidth

              />



              <TextField

                label="Gr mn"

                value={draft.Gr_mn ?? ""}

                onChange={(e) =>

                  setDraft((p) => ({

                    ...p,

                    Gr_mn: toNumberOrNull(e.target.value),

                  }))

                }

                fullWidth

              />



              <TextField

                label="Gr mx"

                value={draft.Gr_mx ?? ""}

                onChange={(e) =>

                  setDraft((p) => ({

                    ...p,

                    Gr_mx: toNumberOrNull(e.target.value),

                  }))

                }

                fullWidth

              />

            </Stack>



            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>

              <FormControl fullWidth>

                <InputLabel>Emballage</InputLabel>



                <Select

                  label="Emballage"

                  value={draft.Emballage}

                  onChange={(e) =>

                    setDraft((p) => ({

                      ...p,

                      Emballage: e.target.value as any,

                    }))

                  }

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

                onChange={(e) =>

                  setDraft((p) => ({

                    ...p,

                    PU: toNumberOrNull(e.target.value),

                  }))

                }

                fullWidth

              />



              <TextField

                label="Colis"

                value={draft.Colis ?? ""}

                onChange={(e) =>

                  setDraft((p) => ({

                    ...p,

                    Colis: toNumberOrNull(e.target.value),

                  }))

                }

                fullWidth

              />



              <TextField

                label="Quantite"

                value={draft.Quantite ?? ""}

                onChange={(e) =>

                  setDraft((p) => ({

                    ...p,

                    Quantite: toNumberOrNull(e.target.value),

                  }))

                }

                fullWidth

              />

            </Stack>

          </Stack>

        </DialogContent>



        <DialogActions sx={{ p: 2 }}>

          <Button onClick={() => setOpenNew(false)}>Annuler</Button>



          <Button variant="contained" onClick={saveNewEntry}>

            Save Entry

          </Button>

        </DialogActions>

      </Dialog>

    </Stack>

  );

}
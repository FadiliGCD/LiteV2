import * as React from "react";
import dayjs from "dayjs";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../lib/supabaseClient";
import AppFooter from "../components/AppFooter";

type ProfileRow = {
  role: string | null;
  can_manage_employees: boolean | null;
};

type EmployeeRow = {
  id: string;
  full_name: string;
  employee_code: string | null;
  department: string | null;
  is_active: boolean;
  created_at: string;
};

type PointageRecord = {
  id: string;
  employee_id: string;
  work_date: string;

  period_1_in: string | null;
  period_1_out: string | null;
  period_2_in: string | null;
  period_2_out: string | null;
  period_3_in: string | null;
  period_3_out: string | null;
  period_4_in: string | null;
  period_4_out: string | null;
  period_5_in: string | null;
  period_5_out: string | null;

  hour_adjustment: number | null;
  kitchen_contribution: string | null;
  notes: string | null;
  created_at: string;
};

const PERIODS = [
  {
    label: "Période I",
    inField: "period_1_in",
    outField: "period_1_out",
  },
  {
    label: "Période II",
    inField: "period_2_in",
    outField: "period_2_out",
  },
  {
    label: "Période III",
    inField: "period_3_in",
    outField: "period_3_out",
  },
  {
    label: "Période IV",
    inField: "period_4_in",
    outField: "period_4_out",
  },
  {
    label: "Période V",
    inField: "period_5_in",
    outField: "period_5_out",
  },
] as const;

type PeriodInField = (typeof PERIODS)[number]["inField"];
type PeriodOutField = (typeof PERIODS)[number]["outField"];
type PeriodTimeField = PeriodInField | PeriodOutField;

function todayISO() {
  return dayjs().format("YYYY-MM-DD");
}

function safeNum(value: unknown, fallback = 0) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  const date = dayjs(value);
  return date.isValid() ? date.format("HH:mm") : "";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = dayjs(value);
  return date.isValid() ? date.format("DD/MM/YYYY HH:mm") : "—";
}

function formatHourNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseHourInput(value: string) {
  const cleaned = value.trim().replace(",", ".");

  if (!cleaned) return 0;

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function dateAndTimeToIso(
  dateText: string,
  timeText: string,
  startIsoForOut?: string | null
) {
  if (!dateText || !timeText) return null;

  const [hours, minutes] = timeText.split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  let result = dayjs(dateText)
    .hour(hours)
    .minute(minutes)
    .second(0)
    .millisecond(0);

  if (startIsoForOut) {
    const start = dayjs(startIsoForOut);

    if (start.isValid() && result.isBefore(start)) {
      result = result.add(1, "day");
    }
  }

  return result.toDate().toISOString();
}

function nowForSelectedDateIso(
  dateText: string,
  startIsoForOut?: string | null
) {
  const now = dayjs();

  let result = dayjs(dateText)
    .hour(now.hour())
    .minute(now.minute())
    .second(now.second())
    .millisecond(0);

  if (startIsoForOut) {
    const start = dayjs(startIsoForOut);

    if (start.isValid() && result.isBefore(start)) {
      result = result.add(1, "day");
    }
  }

  return result.toDate().toISOString();
}

function periodMinutes(
  startValue: string | null,
  endValue: string | null,
  selectedDate: string
) {
  if (!startValue) return 0;

  const start = dayjs(startValue);

  if (!start.isValid()) return 0;

  let end: dayjs.Dayjs | null = null;

  if (endValue) {
    end = dayjs(endValue);

    if (end.isValid() && end.isBefore(start)) {
      end = end.add(1, "day");
    }
  } else if (selectedDate === todayISO()) {
    end = dayjs();
  }

  if (!end || !end.isValid() || end.isBefore(start)) {
    return 0;
  }

  return end.diff(start, "minute");
}

function workedMinutes(record: PointageRecord | undefined, selectedDate: string) {
  if (!record) return 0;

  return PERIODS.reduce((total, period) => {
    return (
      total +
      periodMinutes(
        record[period.inField],
        record[period.outField],
        selectedDate
      )
    );
  }, 0);
}

function totalHours(record: PointageRecord | undefined, selectedDate: string) {
  const worked = workedMinutes(record, selectedDate) / 60;
  const adjustment = safeNum(record?.hour_adjustment, 0);

  return worked + adjustment;
}

function employeeLabel(employee: EmployeeRow) {
  const code = employee.employee_code ? ` • ${employee.employee_code}` : "";
  const department = employee.department ? ` • ${employee.department}` : "";

  return `${employee.full_name}${code}${department}`;
}

function findNextInField(record: PointageRecord | undefined) {
  for (const period of PERIODS) {
    if (!record?.[period.inField]) {
      return period.inField;
    }

    if (record?.[period.inField] && !record?.[period.outField]) {
      return null;
    }
  }

  return null;
}

function findOpenOutField(record: PointageRecord | undefined) {
  if (!record) return null;

  for (let i = PERIODS.length - 1; i >= 0; i -= 1) {
    const period = PERIODS[i];

    if (record[period.inField] && !record[period.outField]) {
      return {
        outField: period.outField,
        startIso: record[period.inField],
      };
    }
  }

  return null;
}

export default function PointagePage() {
  const [selectedDate, setSelectedDate] = React.useState(todayISO());

  const [profile, setProfile] = React.useState<ProfileRow | null>(null);
  const [employees, setEmployees] = React.useState<EmployeeRow[]>([]);
  const [records, setRecords] = React.useState<PointageRecord[]>([]);

  const [selectedEmployee, setSelectedEmployee] =
    React.useState<EmployeeRow | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [info, setInfo] = React.useState("");
  const [error, setError] = React.useState("");

  const [openEmployeeDialog, setOpenEmployeeDialog] = React.useState(false);
  const [newEmployeeName, setNewEmployeeName] = React.useState("");
  const [newEmployeeCode, setNewEmployeeCode] = React.useState("");
  const [newEmployeeDepartment, setNewEmployeeDepartment] = React.useState("");

  const canManageEmployees =
    String(profile?.role ?? "").toLowerCase() === "superuser" ||
    profile?.can_manage_employees === true;

  const activeEmployees = React.useMemo(() => {
    return employees
      .filter((employee) => employee.is_active)
      .sort((a, b) =>
        a.full_name.localeCompare(b.full_name, "fr", {
          sensitivity: "base",
        })
      );
  }, [employees]);

  const recordMap = React.useMemo(() => {
    return new Map(records.map((record) => [record.employee_id, record]));
  }, [records]);

  const loadPointage = React.useCallback(async () => {
    setLoading(true);
    setError("");
    setInfo("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Session not found.");
      }

      const [profileResult, employeesResult, recordsResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("role, can_manage_employees")
            .eq("id", user.id)
            .maybeSingle(),

          supabase
            .from("pointage_employees")
            .select(
              "id, full_name, employee_code, department, is_active, created_at"
            )
            .order("full_name", { ascending: true }),

          supabase
            .from("pointage_records")
            .select(
              "id, employee_id, work_date, period_1_in, period_1_out, period_2_in, period_2_out, period_3_in, period_3_out, period_4_in, period_4_out, period_5_in, period_5_out, hour_adjustment, kitchen_contribution, notes, created_at"
            )
            .eq("work_date", selectedDate)
            .order("created_at", { ascending: false }),
        ]);

      if (profileResult.error) throw new Error(profileResult.error.message);
      if (employeesResult.error) throw new Error(employeesResult.error.message);
      if (recordsResult.error) throw new Error(recordsResult.error.message);

      setProfile((profileResult.data ?? null) as ProfileRow | null);
      setEmployees((employeesResult.data ?? []) as EmployeeRow[]);
      setRecords((recordsResult.data ?? []) as PointageRecord[]);
    } catch (loadError: any) {
      setError(loadError?.message ?? "Failed to load pointage.");
      setEmployees([]);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  React.useEffect(() => {
    loadPointage();
  }, [loadPointage]);

  const upsertRecord = async (
    employee: EmployeeRow,
    changes: Record<string, unknown>
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("Session not found.");

    const existing = recordMap.get(employee.id);

    const payload: Record<string, unknown> = {
      employee_id: employee.id,
      work_date: selectedDate,
      ...changes,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    if (!existing) {
      payload.created_by = user.id;
    }

    const { error: upsertError } = await supabase
      .from("pointage_records")
      .upsert(payload, {
        onConflict: "employee_id,work_date",
      });

    if (upsertError) throw new Error(upsertError.message);
  };

  const clockInLikeAction = async (
    employee: EmployeeRow,
    label: string
  ) => {
    const existing = recordMap.get(employee.id);
    const field = findNextInField(existing);

    if (!field) {
      throw new Error(
        "Impossible d'ajouter une entrée. Une période est déjà ouverte ou les 5 périodes sont utilisées."
      );
    }

    await upsertRecord(employee, {
      [field]: nowForSelectedDateIso(selectedDate),
    });

    setInfo(`${label} enregistré pour ${employee.full_name}.`);
  };

  const clockOutLikeAction = async (
    employee: EmployeeRow,
    label: string
  ) => {
    const existing = recordMap.get(employee.id);
    const openPeriod = findOpenOutField(existing);

    if (!openPeriod) {
      throw new Error(
        "Aucune période ouverte. Enregistrez d'abord une entrée."
      );
    }

    await upsertRecord(employee, {
      [openPeriod.outField]: nowForSelectedDateIso(
        selectedDate,
        openPeriod.startIso
      ),
    });

    setInfo(`${label} enregistré pour ${employee.full_name}.`);
  };

  const handleAction = async (
    action: "clock_in" | "lunch_start" | "lunch_end" | "clock_out"
  ) => {
    setInfo("");
    setError("");

    if (!selectedEmployee) {
      setError("Sélectionnez un employé d'abord.");
      return;
    }

    setSaving(true);

    try {
      if (action === "clock_in") {
        await clockInLikeAction(selectedEmployee, "Entrée");
      }

      if (action === "lunch_start") {
        await clockOutLikeAction(selectedEmployee, "Début pause");
      }

      if (action === "lunch_end") {
        await clockInLikeAction(selectedEmployee, "Fin pause");
      }

      if (action === "clock_out") {
        await clockOutLikeAction(selectedEmployee, "Sortie");
      }

      await loadPointage();
    } catch (actionError: any) {
      setError(actionError?.message ?? "Action failed.");
    } finally {
      setSaving(false);
    }
  };

  const updateRecordTime = async (
    employee: EmployeeRow,
    record: PointageRecord | undefined,
    field: PeriodTimeField,
    timeText: string
  ) => {
    setInfo("");
    setError("");
    setSaving(true);

    try {
      const period = PERIODS.find(
        (p) => p.inField === field || p.outField === field
      );

      const startIsoForOut =
        period && period.outField === field && record
          ? record[period.inField]
          : null;

      const isoValue = timeText
        ? dateAndTimeToIso(selectedDate, timeText, startIsoForOut)
        : null;

      await upsertRecord(employee, {
        [field]: isoValue,
      });

      await loadPointage();
      setInfo("Horaire mis à jour.");
    } catch (updateError: any) {
      setError(updateError?.message ?? "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const updateAdjustment = async (
    employee: EmployeeRow,
    value: string
  ) => {
    setInfo("");
    setError("");
    setSaving(true);

    try {
      await upsertRecord(employee, {
        hour_adjustment: parseHourInput(value),
      });

      await loadPointage();
      setInfo("+ Hr / - Hr mis à jour.");
    } catch (updateError: any) {
      setError(updateError?.message ?? "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const updateKitchenContribution = async (
    employee: EmployeeRow,
    value: string
  ) => {
    setInfo("");
    setError("");
    setSaving(true);

    try {
      await upsertRecord(employee, {
        kitchen_contribution: value.trim() || null,
      });

      await loadPointage();
      setInfo("Cotisation cuisine mise à jour.");
    } catch (updateError: any) {
      setError(updateError?.message ?? "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const addEmployee = async () => {
    setInfo("");
    setError("");

    if (!canManageEmployees) {
      setError("Vous n'avez pas la permission de modifier la liste des employés.");
      return;
    }

    if (!newEmployeeName.trim()) {
      setError("Le nom de l'employé est obligatoire.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Session not found.");

      const { error: insertError } = await supabase
        .from("pointage_employees")
        .insert({
          full_name: newEmployeeName.trim(),
          employee_code: newEmployeeCode.trim() || null,
          department: newEmployeeDepartment.trim() || null,
          created_by: user.id,
        });

      if (insertError) throw new Error(insertError.message);

      setNewEmployeeName("");
      setNewEmployeeCode("");
      setNewEmployeeDepartment("");
      setOpenEmployeeDialog(false);

      await loadPointage();

      setInfo("Employé ajouté.");
    } catch (insertError: any) {
      setError(insertError?.message ?? "Failed to add employee.");
    } finally {
      setSaving(false);
    }
  };

  const deleteEmployee = async (employee: EmployeeRow) => {
    setInfo("");
    setError("");

    if (!canManageEmployees) {
      setError("Vous n'avez pas la permission de modifier la liste des employés.");
      return;
    }

    const confirmed = window.confirm(
      `Supprimer ${employee.full_name} de la liste active ?`
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from("pointage_employees")
        .update({
          is_active: false,
        })
        .eq("id", employee.id);

      if (updateError) throw new Error(updateError.message);

      if (selectedEmployee?.id === employee.id) {
        setSelectedEmployee(null);
      }

      await loadPointage();

      setInfo("Employé supprimé de la liste active.");
    } catch (deleteError: any) {
      setError(deleteError?.message ?? "Failed to delete employee.");
    } finally {
      setSaving(false);
    }
  };

  const headerCellSx = {
    bgcolor: "#8cc63f",
    color: "#111827",
    fontWeight: 900,
    border: "1px solid #2f3a2f",
    whiteSpace: "nowrap",
  };

  const subHeaderCellSx = {
    bgcolor: "#d7e8b5",
    color: "#111827",
    fontWeight: 800,
    border: "1px solid #2f3a2f",
    whiteSpace: "nowrap",
  };

  const periodCellSx = {
    bgcolor: "#f1efe3",
    border: "1px solid #9ca3af",
    p: 0.5,
  };

  const totalCellSx = {
    bgcolor: "#c5bb92",
    border: "1px solid #6b654e",
    fontWeight: 900,
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f4f7fb",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Paper
        square
        elevation={0}
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "rgba(255,255,255,0.95)",
        }}
      >
        <Box
          sx={{
            maxWidth: 1600,
            mx: "auto",
            px: { xs: 2, md: 4 },
            py: 1.5,
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            spacing={2}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                component="img"
                src="/logo.png"
                alt="Lite V2"
                sx={{
                  height: 44,
                  width: "auto",
                  objectFit: "contain",
                }}
              />

              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Pointage
                </Typography>

                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Journal quotidien des entrées, sorties et pauses
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" href="/modules">
                Modules
              </Button>

              <Button
                variant="contained"
                onClick={loadPointage}
                disabled={loading}
              >
                Actualiser
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>

      <Box
        component="main"
        sx={{
          flex: 1,
          width: "100%",
          maxWidth: 1600,
          mx: "auto",
          px: { xs: 2, md: 4 },
          py: 4,
        }}
      >
        <Stack spacing={3}>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", lg: "center" }}
            spacing={2}
          >
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                Journal de pointage
              </Typography>

              <Typography
                variant="body2"
                sx={{ color: "text.secondary", mt: 0.5 }}
              >
                Structure basée sur l'ancien journal PDF, avec la logique de
                pointage moderne dans l'application.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                color={canManageEmployees ? "success" : "default"}
                label={
                  canManageEmployees ? "Admin pointage" : "Utilisateur pointage"
                }
              />

              {saving ? <Chip color="info" label="Sauvegarde..." /> : null}
            </Stack>
          </Stack>

          {error ? <Alert severity="warning">{error}</Alert> : null}
          {info ? <Alert severity="success">{info}</Alert> : null}

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems={{ xs: "stretch", md: "center" }}
              >
                <TextField
                  label="Date"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 210 }}
                />

                <Autocomplete
                  fullWidth
                  options={activeEmployees}
                  value={selectedEmployee}
                  onChange={(_, value) => setSelectedEmployee(value)}
                  getOptionLabel={(option) => employeeLabel(option)}
                  isOptionEqualToValue={(option, value) =>
                    option.id === value.id
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Rechercher un employé"
                      placeholder="Tapez le nom de l'employé..."
                    />
                  )}
                />

                {canManageEmployees ? (
                  <Button
                    variant="outlined"
                    onClick={() => setOpenEmployeeDialog(true)}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    Ajouter employé
                  </Button>
                ) : null}
              </Stack>

              <Divider />

              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  variant="contained"
                  onClick={() => handleAction("clock_in")}
                  disabled={!selectedEmployee || saving}
                >
                  Entrée
                </Button>

                <Button
                  variant="outlined"
                  color="warning"
                  onClick={() => handleAction("lunch_start")}
                  disabled={!selectedEmployee || saving}
                >
                  Début pause
                </Button>

                <Button
                  variant="outlined"
                  color="success"
                  onClick={() => handleAction("lunch_end")}
                  disabled={!selectedEmployee || saving}
                >
                  Fin pause
                </Button>

                <Button
                  variant="contained"
                  color="error"
                  onClick={() => handleAction("clock_out")}
                  disabled={!selectedEmployee || saving}
                >
                  Sortie
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Box
              sx={{
                border: "1px solid #111827",
                bgcolor: "white",
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "240px 1fr" },
                  borderBottom: "1px solid #111827",
                }}
              >
                <Box
                  sx={{
                    p: 1.5,
                    display: "grid",
                    placeItems: "center",
                    borderRight: { md: "1px solid #111827" },
                  }}
                >
                  <Box
                    component="img"
                    src="/logo.png"
                    alt="Logo"
                    sx={{
                      height: 70,
                      width: "auto",
                      objectFit: "contain",
                    }}
                  />
                </Box>

                <Box>
                  <Typography
                    variant="h4"
                    sx={{
                      textAlign: "center",
                      fontWeight: 900,
                      py: 1.2,
                      borderBottom: "1px solid #111827",
                      letterSpacing: 1,
                    }}
                  >
                    JOURNAL DE POINTAGE
                  </Typography>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        md: "repeat(4, 1fr)",
                      },
                    }}
                  >
                    <Typography sx={{ p: 1, borderRight: "1px solid #111827" }}>
                      Référence : <strong>FO/RH 08</strong>
                    </Typography>

                    <Typography sx={{ p: 1, borderRight: "1px solid #111827" }}>
                      Version : <strong>A</strong>
                    </Typography>

                    <Typography sx={{ p: 1, borderRight: "1px solid #111827" }}>
                      Date : <strong>01/05/2016</strong>
                    </Typography>

                    <Typography sx={{ p: 1 }}>
                      Page <strong>1 sur 1</strong>
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "260px 1fr" },
                  gap: 2,
                  p: 1.5,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box
                    sx={{
                      bgcolor: "#8cc63f",
                      fontWeight: 900,
                      px: 1,
                      py: 0.5,
                      border: "1px solid #111827",
                    }}
                  >
                    Date
                  </Box>

                  <Box
                    sx={{
                      color: "error.main",
                      fontWeight: 900,
                      px: 2,
                      py: 0.5,
                      border: "1px solid #111827",
                      bgcolor: "white",
                    }}
                  >
                    {dayjs(selectedDate).format("DD/MM/YYYY")}
                  </Box>
                </Stack>

                <Box
                  sx={{
                    bgcolor: "error.main",
                    color: "white",
                    fontWeight: 900,
                    textAlign: "center",
                    py: 0.7,
                    border: "1px solid #b91c1c",
                    letterSpacing: 0.5,
                  }}
                >
                  Traitement
                </Box>
              </Box>

              {loading ? (
                <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
                  <CircularProgress />

                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Chargement du journal de pointage...
                  </Typography>
                </Stack>
              ) : (
                <TableContainer sx={{ maxHeight: 720 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell rowSpan={2} align="center" sx={headerCellSx}>
                          N°
                        </TableCell>

                        <TableCell rowSpan={2} sx={headerCellSx}>
                          Nom Complet
                        </TableCell>

                        <TableCell rowSpan={2} align="right" sx={headerCellSx}>
                          Total
                        </TableCell>

                        {PERIODS.map((period) => (
                          <TableCell
                            key={period.label}
                            colSpan={2}
                            align="center"
                            sx={headerCellSx}
                          >
                            {period.label}
                          </TableCell>
                        ))}

                        <TableCell rowSpan={2} align="center" sx={headerCellSx}>
                          + Hr
                          <br />- Hr
                        </TableCell>

                        <TableCell rowSpan={2} align="center" sx={headerCellSx}>
                          Cotisation
                          <br />
                          Cuisine
                        </TableCell>
                      </TableRow>

                      <TableRow>
                        {PERIODS.map((period) => (
                          <React.Fragment key={`${period.label}-sub`}>
                            <TableCell align="center" sx={subHeaderCellSx}>
                              Entrée
                            </TableCell>

                            <TableCell align="center" sx={subHeaderCellSx}>
                              Sortie
                            </TableCell>
                          </React.Fragment>
                        ))}
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {activeEmployees.length ? (
                        activeEmployees.map((employee) => {
                          const record = recordMap.get(employee.id);
                          const total = totalHours(record, selectedDate);

                          return (
                            <TableRow key={employee.id} hover>
                              <TableCell
                                align="center"
                                sx={{
                                  border: "1px solid #9ca3af",
                                  fontWeight: 800,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {employee.employee_code || "—"}
                              </TableCell>

                              <TableCell
                                sx={{
                                  border: "1px solid #9ca3af",
                                  minWidth: 220,
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 900 }}
                                >
                                  {employee.full_name}
                                </Typography>

                                {employee.department ? (
                                  <Typography
                                    variant="caption"
                                    sx={{ color: "text.secondary" }}
                                  >
                                    {employee.department}
                                  </Typography>
                                ) : null}
                              </TableCell>

                              <TableCell align="right" sx={totalCellSx}>
                                {formatHourNumber(total)}
                              </TableCell>

                              {PERIODS.map((period) => (
                                <React.Fragment key={`${employee.id}-${period.label}`}>
                                  <TableCell sx={periodCellSx}>
                                    <TextField
                                      type="time"
                                      size="small"
                                      value={formatTime(record?.[period.inField])}
                                      onChange={(event) =>
                                        updateRecordTime(
                                          employee,
                                          record,
                                          period.inField,
                                          event.target.value
                                        )
                                      }
                                      inputProps={{ step: 60 }}
                                      sx={{
                                        width: 95,
                                        "& input": {
                                          fontSize: 13,
                                          p: 0.7,
                                        },
                                      }}
                                    />
                                  </TableCell>

                                  <TableCell sx={periodCellSx}>
                                    <TextField
                                      type="time"
                                      size="small"
                                      value={formatTime(record?.[period.outField])}
                                      onChange={(event) =>
                                        updateRecordTime(
                                          employee,
                                          record,
                                          period.outField,
                                          event.target.value
                                        )
                                      }
                                      inputProps={{ step: 60 }}
                                      sx={{
                                        width: 95,
                                        "& input": {
                                          fontSize: 13,
                                          p: 0.7,
                                        },
                                      }}
                                    />
                                  </TableCell>
                                </React.Fragment>
                              ))}

                              <TableCell align="center" sx={totalCellSx}>
                                <TextField
                                  key={`${employee.id}-${record?.hour_adjustment ?? 0}`}
                                  size="small"
                                  defaultValue={formatHourNumber(
                                    safeNum(record?.hour_adjustment, 0)
                                  )}
                                  onBlur={(event) =>
                                    updateAdjustment(employee, event.target.value)
                                  }
                                  sx={{
                                    width: 90,
                                    "& input": {
                                      textAlign: "right",
                                      fontSize: 13,
                                      p: 0.7,
                                      fontWeight: 800,
                                    },
                                  }}
                                />
                              </TableCell>

                              <TableCell align="center" sx={totalCellSx}>
                                <TextField
                                  key={`${employee.id}-${
                                    record?.kitchen_contribution ?? ""
                                  }`}
                                  size="small"
                                  defaultValue={
                                    record?.kitchen_contribution ?? ""
                                  }
                                  onBlur={(event) =>
                                    updateKitchenContribution(
                                      employee,
                                      event.target.value
                                    )
                                  }
                                  sx={{
                                    width: 120,
                                    "& input": {
                                      fontSize: 13,
                                      p: 0.7,
                                    },
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={15}>
                            <Typography
                              variant="body2"
                              sx={{
                                py: 5,
                                textAlign: "center",
                                color: "text.secondary",
                              }}
                            >
                              Aucun employé actif.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Paper>

          {canManageEmployees ? (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
                spacing={1}
                sx={{ mb: 1.5 }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Liste des employés
                  </Typography>

                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Modification réservée aux administrateurs.
                  </Typography>
                </Box>

                <Chip
                  variant="outlined"
                  label={`${activeEmployees.length} employé(s) actif(s)`}
                />
              </Stack>

              <Divider sx={{ mb: 1 }} />

              <TableContainer sx={{ maxHeight: 280 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nom</TableCell>
                      <TableCell>Code</TableCell>
                      <TableCell>Département</TableCell>
                      <TableCell>Date création</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {activeEmployees.length ? (
                      activeEmployees.map((employee) => (
                        <TableRow key={employee.id} hover>
                          <TableCell>
                            <strong>{employee.full_name}</strong>
                          </TableCell>

                          <TableCell>{employee.employee_code || "—"}</TableCell>

                          <TableCell>{employee.department || "—"}</TableCell>

                          <TableCell>{formatDateTime(employee.created_at)}</TableCell>

                          <TableCell align="right">
                            <Button
                              color="error"
                              size="small"
                              onClick={() => deleteEmployee(employee)}
                              disabled={saving}
                            >
                              Supprimer
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography
                            variant="body2"
                            sx={{
                              py: 3,
                              textAlign: "center",
                              color: "text.secondary",
                            }}
                          >
                            Aucun employé actif.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ) : null}
        </Stack>
      </Box>

      <AppFooter />

      <Dialog
        open={openEmployeeDialog}
        onClose={() => setOpenEmployeeDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Ajouter un employé</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nom complet"
              value={newEmployeeName}
              onChange={(event) => setNewEmployeeName(event.target.value)}
              fullWidth
              required
            />

            <TextField
              label="Code employé / N°"
              value={newEmployeeCode}
              onChange={(event) => setNewEmployeeCode(event.target.value)}
              fullWidth
            />

            <TextField
              label="Département"
              value={newEmployeeDepartment}
              onChange={(event) => setNewEmployeeDepartment(event.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenEmployeeDialog(false)}>Cancel</Button>

          <Button variant="contained" onClick={addEmployee} disabled={saving}>
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
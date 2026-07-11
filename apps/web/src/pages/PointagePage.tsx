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
  clock_in: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  clock_out: string | null;
  notes: string | null;
  created_at: string;
};

type TimeField = "clock_in" | "lunch_start" | "lunch_end" | "clock_out";

function todayISO() {
  return dayjs().format("YYYY-MM-DD");
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

function dateAndTimeToIso(dateText: string, timeText: string) {
  if (!dateText || !timeText) return null;

  const [hours, minutes] = timeText.split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return dayjs(dateText)
    .hour(hours)
    .minute(minutes)
    .second(0)
    .millisecond(0)
    .toDate()
    .toISOString();
}

function nowForSelectedDateIso(dateText: string) {
  const now = dayjs();

  return dayjs(dateText)
    .hour(now.hour())
    .minute(now.minute())
    .second(now.second())
    .millisecond(0)
    .toDate()
    .toISOString();
}

function minutesBetween(
  start: string | null,
  end: string | null,
  selectedDate: string
) {
  if (!start) return null;

  const startDate = dayjs(start);

  if (!startDate.isValid()) return null;

  let endDate: dayjs.Dayjs | null = null;

  if (end) {
    const parsedEnd = dayjs(end);
    if (parsedEnd.isValid()) endDate = parsedEnd;
  } else if (selectedDate === todayISO()) {
    endDate = dayjs();
  }

  if (!endDate || endDate.isBefore(startDate)) return null;

  return endDate.diff(startDate, "minute");
}

function formatDuration(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes)) return "—";

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (h <= 0) return `${m}min`;
  if (m <= 0) return `${h}h`;

  return `${h}h ${m}min`;
}

function getStatus(record: PointageRecord) {
  if (!record.clock_in) return "Pas commencé";
  if (record.clock_out) return "Sorti";
  if (record.lunch_start && !record.lunch_end) return "Pause déjeuner";
  if (record.lunch_start && record.lunch_end) return "Présent après pause";
  return "Présent";
}

function statusColor(status: string) {
  if (status === "Sorti") return "default";
  if (status === "Pause déjeuner") return "warning";
  if (status === "Présent" || status === "Présent après pause") return "success";
  return "default";
}

function employeeLabel(employee: EmployeeRow) {
  const code = employee.employee_code ? ` • ${employee.employee_code}` : "";
  const department = employee.department ? ` • ${employee.department}` : "";

  return `${employee.full_name}${code}${department}`;
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

  const employeeMap = React.useMemo(() => {
    return new Map(employees.map((employee) => [employee.id, employee]));
  }, [employees]);

  const tableRows = React.useMemo(() => {
    return [...records].sort((a, b) => {
      const employeeA = employeeMap.get(a.employee_id)?.full_name ?? "";
      const employeeB = employeeMap.get(b.employee_id)?.full_name ?? "";

      return employeeA.localeCompare(employeeB, "fr", {
        sensitivity: "base",
      });
    });
  }, [records, employeeMap]);

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
              "id, employee_id, work_date, clock_in, lunch_start, lunch_end, clock_out, notes, created_at"
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

  const clockAction = async (field: TimeField) => {
    setInfo("");
    setError("");

    if (!selectedEmployee) {
      setError("Sélectionnez un employé d'abord.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Session not found.");

      const existing = records.find(
        (record) => record.employee_id === selectedEmployee.id
      );

      const nowIso = nowForSelectedDateIso(selectedDate);

      const payload: Record<string, unknown> = {
        employee_id: selectedEmployee.id,
        work_date: selectedDate,
        [field]: nowIso,
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

      await loadPointage();

      const actionLabel =
        field === "clock_in"
          ? "Entrée enregistrée"
          : field === "lunch_start"
          ? "Début pause enregistré"
          : field === "lunch_end"
          ? "Fin pause enregistrée"
          : "Sortie enregistrée";

      setInfo(`${actionLabel} pour ${selectedEmployee.full_name}.`);
    } catch (clockError: any) {
      setError(clockError?.message ?? "Action failed.");
    } finally {
      setSaving(false);
    }
  };

  const updateRecordTime = async (
    record: PointageRecord,
    field: TimeField,
    timeText: string
  ) => {
    setInfo("");
    setError("");

    const isoValue = timeText
      ? dateAndTimeToIso(selectedDate, timeText)
      : null;

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Session not found.");

      const { error: updateError } = await supabase
        .from("pointage_records")
        .update({
          [field]: isoValue,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq("id", record.id);

      if (updateError) throw new Error(updateError.message);

      await loadPointage();
      setInfo("Ligne mise à jour.");
    } catch (updateError: any) {
      setError(updateError?.message ?? "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const updateRecordNotes = async (record: PointageRecord, notes: string) => {
    setInfo("");
    setError("");
    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Session not found.");

      const { error: updateError } = await supabase
        .from("pointage_records")
        .update({
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq("id", record.id);

      if (updateError) throw new Error(updateError.message);

      await loadPointage();
      setInfo("Notes mises à jour.");
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
            maxWidth: 1500,
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
                  Entrées, sorties et pauses des employés
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" href="/modules">
                Modules
              </Button>

              <Button variant="contained" onClick={loadPointage} disabled={loading}>
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
          maxWidth: 1500,
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
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 900,
                }}
              >
                Pointage des employés
              </Typography>

              <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                Sélectionnez une date, recherchez un employé, puis enregistrez
                son entrée, sa pause ou sa sortie.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                color={canManageEmployees ? "success" : "default"}
                label={canManageEmployees ? "Admin pointage" : "Utilisateur pointage"}
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
                  isOptionEqualToValue={(option, value) => option.id === value.id}
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
                  onClick={() => clockAction("clock_in")}
                  disabled={!selectedEmployee || saving}
                >
                  Entrée
                </Button>

                <Button
                  variant="outlined"
                  color="warning"
                  onClick={() => clockAction("lunch_start")}
                  disabled={!selectedEmployee || saving}
                >
                  Début pause
                </Button>

                <Button
                  variant="outlined"
                  color="success"
                  onClick={() => clockAction("lunch_end")}
                  disabled={!selectedEmployee || saving}
                >
                  Fin pause
                </Button>

                <Button
                  variant="contained"
                  color="error"
                  onClick={() => clockAction("clock_out")}
                  disabled={!selectedEmployee || saving}
                >
                  Sortie
                </Button>
              </Stack>
            </Stack>
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
                    Visible par tous les utilisateurs pointage. Modification
                    réservée aux administrateurs.
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
                  Données du {dayjs(selectedDate).format("DD/MM/YYYY")}
                </Typography>

                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Les horaires peuvent être corrigés directement dans le tableau.
                </Typography>
              </Box>

              <Chip variant="outlined" label={`${records.length} ligne(s)`} />
            </Stack>

            <Divider sx={{ mb: 1 }} />

            {loading ? (
              <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
                <CircularProgress />

                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Chargement du pointage...
                </Typography>
              </Stack>
            ) : (
              <TableContainer sx={{ maxHeight: 560 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Employé</TableCell>
                      <TableCell>Entrée</TableCell>
                      <TableCell>Début pause</TableCell>
                      <TableCell>Fin pause</TableCell>
                      <TableCell>Sortie</TableCell>
                      <TableCell>Temps brut</TableCell>
                      <TableCell>Pause</TableCell>
                      <TableCell>Temps net</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {tableRows.length ? (
                      tableRows.map((record) => {
                        const employee = employeeMap.get(record.employee_id);

                        const grossMinutes = minutesBetween(
                          record.clock_in,
                          record.clock_out,
                          selectedDate
                        );

                        const lunchMinutes = minutesBetween(
                          record.lunch_start,
                          record.lunch_end,
                          selectedDate
                        );

                        const netMinutes =
                          grossMinutes === null
                            ? null
                            : grossMinutes - (lunchMinutes ?? 0);

                        const status = getStatus(record);

                        return (
                          <TableRow key={record.id} hover>
                            <TableCell sx={{ minWidth: 220 }}>
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                {employee?.full_name ?? "Employé supprimé"}
                              </Typography>

                              <Typography
                                variant="caption"
                                sx={{ color: "text.secondary" }}
                              >
                                {employee?.employee_code || employee?.department
                                  ? `${employee.employee_code ?? ""} ${
                                      employee.department
                                        ? `• ${employee.department}`
                                        : ""
                                    }`
                                  : "—"}
                              </Typography>
                            </TableCell>

                            <TableCell sx={{ minWidth: 120 }}>
                              <TextField
                                type="time"
                                size="small"
                                value={formatTime(record.clock_in)}
                                onChange={(event) =>
                                  updateRecordTime(
                                    record,
                                    "clock_in",
                                    event.target.value
                                  )
                                }
                                inputProps={{ step: 60 }}
                              />
                            </TableCell>

                            <TableCell sx={{ minWidth: 120 }}>
                              <TextField
                                type="time"
                                size="small"
                                value={formatTime(record.lunch_start)}
                                onChange={(event) =>
                                  updateRecordTime(
                                    record,
                                    "lunch_start",
                                    event.target.value
                                  )
                                }
                                inputProps={{ step: 60 }}
                              />
                            </TableCell>

                            <TableCell sx={{ minWidth: 120 }}>
                              <TextField
                                type="time"
                                size="small"
                                value={formatTime(record.lunch_end)}
                                onChange={(event) =>
                                  updateRecordTime(
                                    record,
                                    "lunch_end",
                                    event.target.value
                                  )
                                }
                                inputProps={{ step: 60 }}
                              />
                            </TableCell>

                            <TableCell sx={{ minWidth: 120 }}>
                              <TextField
                                type="time"
                                size="small"
                                value={formatTime(record.clock_out)}
                                onChange={(event) =>
                                  updateRecordTime(
                                    record,
                                    "clock_out",
                                    event.target.value
                                  )
                                }
                                inputProps={{ step: 60 }}
                              />
                            </TableCell>

                            <TableCell>{formatDuration(grossMinutes)}</TableCell>

                            <TableCell>{formatDuration(lunchMinutes)}</TableCell>

                            <TableCell>
                              <strong>{formatDuration(netMinutes)}</strong>
                            </TableCell>

                            <TableCell>
                              <Chip
                                size="small"
                                color={statusColor(status) as any}
                                label={status}
                              />
                            </TableCell>

                            <TableCell sx={{ minWidth: 220 }}>
                              <TextField
                                size="small"
                                defaultValue={record.notes ?? ""}
                                placeholder="Notes..."
                                onBlur={(event) =>
                                  updateRecordNotes(record, event.target.value)
                                }
                                fullWidth
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={10}>
                          <Typography
                            variant="body2"
                            sx={{
                              py: 5,
                              textAlign: "center",
                              color: "text.secondary",
                            }}
                          >
                            Aucun pointage enregistré pour cette date.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
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
              label="Code employé"
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
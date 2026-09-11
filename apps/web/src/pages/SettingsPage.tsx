import * as React from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import AppFooter from "../components/AppFooter";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type ProfileRow = {
  id: string;
  role: string | null;
  module_access: string[] | null;
  hr_access: string[] | null;
  can_manage_hr: boolean | null;
  can_manage_employees: boolean | null;
};

type SettingsCardProps = {
  title: string;
  description: string;
  value?: string;
  status?: "active" | "warning" | "locked";
};

function shortId(id: string) {
  if (!id) return "—";
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function SettingsCard({ title, description, value, status }: SettingsCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 3,
        bgcolor: "background.paper",
        height: "100%",
      }}
    >
      <Stack spacing={1.3}>
        <Stack direction="row" justifyContent="space-between" spacing={2}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            {title}
          </Typography>

          {status ? (
            <Chip
              size="small"
              color={
                status === "active"
                  ? "success"
                  : status === "warning"
                  ? "warning"
                  : "default"
              }
              label={
                status === "active"
                  ? "Active"
                  : status === "warning"
                  ? "To configure"
                  : "Locked"
              }
            />
          ) : null}
        </Stack>

        <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7 }}>
          {description}
        </Typography>

        {value ? (
          <Typography variant="h5" sx={{ fontWeight: 900, mt: 1 }}>
            {value}
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = React.useState(0);
  const [profiles, setProfiles] = React.useState<ProfileRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const loadProfiles = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: profilesError } = await supabase
        .from("profiles")
        .select(
          "id, role, module_access, hr_access, can_manage_hr, can_manage_employees"
        )
        .order("role", { ascending: true });

      if (profilesError) throw new Error(profilesError.message);

      setProfiles((data ?? []) as ProfileRow[]);
    } catch (loadError: any) {
      setError(
        loadError?.message ?? "Unable to load security settings."
      );
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const superusers = profiles.filter(
    (profile) => String(profile.role ?? "").toLowerCase() === "superuser"
  );

  const admins = profiles.filter(
    (profile) => String(profile.role ?? "").toLowerCase() === "admin"
  );

  const hrUsers = profiles.filter((profile) =>
    String(profile.role ?? "").toLowerCase().includes("hr")
  );

  const stockUsers = profiles.filter((profile) =>
    String(profile.role ?? "").toLowerCase().includes("stock")
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f4f7fb",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AppHeader
        title="Settings"
        subtitle="Security, users, roles and logs"
        actions={
          <Button component={Link} to="/modules" variant="outlined">
            Modules
          </Button>
        }
      />

      <Box
        component="main"
        sx={{
          flex: 1,
          width: "100%",
          maxWidth: 1500,
          mx: "auto",
          px: { xs: 2, md: 4 },
          py: { xs: 4, md: 6 },
        }}
      >
        <Stack spacing={3}>
          <Box>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 900,
                fontSize: { xs: "2rem", md: "2.7rem" },
              }}
            >
              Superuser control center
            </Typography>

            <Typography
              variant="body1"
              sx={{
                color: "text.secondary",
                maxWidth: 850,
                mt: 1,
                lineHeight: 1.7,
              }}
            >
              This section is reserved for the application creator. It is used
              to monitor the application state, users, access control, logs and
              sensitive actions.
            </Typography>
          </Box>

          {error ? <Alert severity="warning">{error}</Alert> : null}

          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
            <Box sx={{ px: 2, pt: 2, bgcolor: "background.paper" }}>
              <Tabs
                value={tab}
                onChange={(_, value) => setTab(value)}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="Overview" />
                <Tab label="Users & roles" />
                <Tab label="Logs" />
                <Tab label="Security & access" />
                <Tab label="Maintenance" />
              </Tabs>
            </Box>

            <Divider />

            <Box sx={{ p: { xs: 2, md: 3 } }}>
              {loading ? (
                <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
                  <CircularProgress />

                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Loading settings...
                  </Typography>
                </Stack>
              ) : null}

              {!loading && tab === 0 ? (
                <Stack spacing={3}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, minmax(0, 1fr))",
                        lg: "repeat(4, minmax(0, 1fr))",
                      },
                      gap: 2,
                    }}
                  >
                    <SettingsCard
                      title="Users"
                      description="Total number of user profiles registered in the application."
                      value={String(profiles.length)}
                      status="active"
                    />

                    <SettingsCard
                      title="Superusers"
                      description="Accounts with unlimited access. This number should stay at 1."
                      value={String(superusers.length)}
                      status={superusers.length === 1 ? "active" : "warning"}
                    />

                    <SettingsCard
                      title="Administrators"
                      description="Business management users with controlled administrative access."
                      value={String(admins.length)}
                      status="active"
                    />

                    <SettingsCard
                      title="Audit logging"
                      description="Area planned for sensitive action logs."
                      value="Planned"
                      status="warning"
                    />
                  </Box>

                  <Alert severity="info">
                    Dangerous actions such as user creation, user deletion, role
                    changes and permanent deletion must go through a secure
                    server-side function. They must not be executed directly
                    from the frontend.
                  </Alert>
                </Stack>
              ) : null}

              {!loading && tab === 1 ? (
                <Stack spacing={2}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                    spacing={2}
                  >
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>
                        Users & roles
                      </Typography>

                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary", mt: 0.5 }}
                      >
                        First version is read-only. User creation, user
                        deletion and role changes will be enabled after the
                        secure backend is implemented.
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button variant="outlined" disabled>
                        Add user
                      </Button>

                      <Button variant="outlined" disabled>
                        Edit role
                      </Button>

                      <Button variant="outlined" color="error" disabled>
                        Disable user
                      </Button>
                    </Stack>
                  </Stack>

                  <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "1fr",
                          md: "1.2fr 1fr 1.4fr 1.4fr 1fr",
                        },
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        fontWeight: 900,
                      }}
                    >
                      <Box sx={{ p: 1.5 }}>User</Box>
                      <Box sx={{ p: 1.5 }}>Role</Box>
                      <Box sx={{ p: 1.5 }}>Modules</Box>
                      <Box sx={{ p: 1.5 }}>HR access</Box>
                      <Box sx={{ p: 1.5 }}>Permissions</Box>
                    </Box>

                    {profiles.length ? (
                      profiles.map((profile) => (
                        <Box
                          key={profile.id}
                          sx={{
                            display: "grid",
                            gridTemplateColumns: {
                              xs: "1fr",
                              md: "1.2fr 1fr 1.4fr 1.4fr 1fr",
                            },
                            borderTop: "1px solid",
                            borderColor: "divider",
                            bgcolor: "background.paper",
                          }}
                        >
                          <Box sx={{ p: 1.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                              {shortId(profile.id)}
                            </Typography>

                            <Typography
                              variant="caption"
                              sx={{ color: "text.secondary" }}
                            >
                              Email/display name will be added in the next profile update
                            </Typography>
                          </Box>

                          <Box sx={{ p: 1.5 }}>
                            <Chip
                              size="small"
                              label={profile.role || "user"}
                              color={
                                String(profile.role ?? "").toLowerCase() ===
                                "superuser"
                                  ? "success"
                                  : "default"
                              }
                            />
                          </Box>

                          <Box sx={{ p: 1.5 }}>
                            <Typography variant="body2">
                              {(profile.module_access ?? []).join(", ") || "—"}
                            </Typography>
                          </Box>

                          <Box sx={{ p: 1.5 }}>
                            <Typography variant="body2">
                              {(profile.hr_access ?? []).join(", ") || "—"}
                            </Typography>
                          </Box>

                          <Box sx={{ p: 1.5 }}>
                            <Stack spacing={0.5}>
                              <Chip
                                size="small"
                                variant="outlined"
                                label={
                                  profile.can_manage_hr
                                    ? "HR management"
                                    : "Limited HR"
                                }
                              />

                              <Chip
                                size="small"
                                variant="outlined"
                                label={
                                  profile.can_manage_employees
                                    ? "Employee management"
                                    : "Limited employees"
                                }
                              />
                            </Stack>
                          </Box>
                        </Box>
                      ))
                    ) : (
                      <Box sx={{ p: 3 }}>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          No profiles found.
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                </Stack>
              ) : null}

              {!loading && tab === 2 ? (
                <Stack spacing={2}>
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    Application logs
                  </Typography>

                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    This area will show important actions: login activity,
                    stock changes, sortie creation, HR updates, role changes,
                    deletions, Excel imports and exports.
                  </Typography>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        md: "repeat(3, minmax(0, 1fr))",
                      },
                      gap: 2,
                    }}
                  >
                    <SettingsCard
                      title="Login logs"
                      description="Track successful logins, rejected attempts and sensitive sessions."
                      status="warning"
                    />

                    <SettingsCard
                      title="Business logs"
                      description="Track changes in Entrée, Parking, Sortie, Rapport de charge and Pointage."
                      status="warning"
                    />

                    <SettingsCard
                      title="Security logs"
                      description="Track role changes, permission changes and superuser actions."
                      status="warning"
                    />
                  </Box>

                  <Alert severity="info">
                    Next technical step: create an <strong>app_audit_logs</strong>{" "}
                    table with user_id, action, module, table_name, old_value,
                    new_value and created_at.
                  </Alert>
                </Stack>
              ) : null}

              {!loading && tab === 3 ? (
                <Stack spacing={2}>
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    Security & access
                  </Typography>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        md: "repeat(2, minmax(0, 1fr))",
                      },
                      gap: 2,
                    }}
                  >
                    <SettingsCard
                      title="Superuser rule"
                      description="Only one account should be superuser: the creator of the application."
                      value={`${superusers.length} superuser`}
                      status={superusers.length === 1 ? "active" : "warning"}
                    />

                    <SettingsCard
                      title="Admin management"
                      description="Admins can manage business activity, but must not modify system rules."
                      value={`${admins.length} admin(s)`}
                      status="active"
                    />

                    <SettingsCard
                      title="HR users"
                      description="Accounts linked to human resources, pointage, main d'œuvre and payroll."
                      value={String(hrUsers.length)}
                      status="active"
                    />

                    <SettingsCard
                      title="Stock users"
                      description="Accounts linked to entries, parking, sorties and charge reports."
                      value={String(stockUsers.length)}
                      status="active"
                    />
                  </Box>
                </Stack>
              ) : null}

              {!loading && tab === 4 ? (
                <Stack spacing={2}>
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    Maintenance
                  </Typography>

                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    This area will be used for sensitive maintenance functions.
                    The buttons are intentionally locked in this first version.
                  </Typography>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        md: "repeat(3, minmax(0, 1fr))",
                      },
                      gap: 2,
                    }}
                  >
                    <SettingsCard
                      title="Database backup"
                      description="Prepare a secure export or backup of the database."
                      status="locked"
                    />

                    <SettingsCard
                      title="Data cleanup"
                      description="Archive old data without permanent deletion."
                      status="locked"
                    />

                    <SettingsCard
                      title="Maintenance mode"
                      description="Temporarily block business access during technical work."
                      status="locked"
                    />
                  </Box>

                  <Alert severity="warning">
                    Maintenance actions should never directly delete data.
                    We will use archive, deactivation and history instead.
                  </Alert>
                </Stack>
              ) : null}
            </Box>
          </Paper>
        </Stack>
      </Box>

      <AppFooter />
    </Box>
  );
}
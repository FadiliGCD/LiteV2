import * as React from "react";

import { Link } from "react-router-dom";

import {

  Alert,

  Box,

  Button,

  Checkbox,

  Chip,

  CircularProgress,

  Dialog,

  DialogActions,

  DialogContent,

  DialogTitle,

  Divider,

  FormControl,

  FormControlLabel,

  FormGroup,

  InputLabel,

  MenuItem,

  Paper,

  Select,

  Stack,

  Tab,

  Tabs,

  TextField,

  Typography,

} from "@mui/material";

import AppFooter from "../components/AppFooter";

import AppHeader from "../components/AppHeader";

import { ensureFreshSession } from "../auth/auth";

import { supabase } from "../lib/supabaseClient";



type ProfileRow = {

  id: string;

  email: string | null;

  username: string | null;

  role: string | null;

  module_access: string[] | null;

  hr_access: string[] | null;

  stock_access: string[] | null;

  can_manage_hr: boolean | null;

  can_manage_employees: boolean | null;

  is_disabled: boolean | null;

};



type AuditLogRow = {

  id: string;

  created_at: string;

  actor_user_id: string | null;

  actor_email: string | null;

  actor_role: string | null;

  action: string;

  module: string;

  table_name: string;

  row_id: string | null;

  old_data: unknown | null;

  new_data: unknown | null;

  source: string | null;

  notes: string | null;

};



type SettingsCardProps = {

  title: string;

  description: string;

  value?: string;

  status?: "active" | "warning" | "locked";

};



type EditDraft = {

  role: string;

  module_access: string[];

  hr_access: string[];

  stock_access: string[];

  can_manage_hr: boolean;

  can_manage_employees: boolean;

};


type CreateDraft = EditDraft & {

  email: string;

  username: string;

  password: string;

};



const ROLE_OPTIONS = [

  "user",

  "admin",

  "stock_entree_add",

  "stock_emballage",

  "hr_pointage",

];



const MODULE_OPTIONS = [

  "reception",

  "production",

  "stock",

  "accounting",

  "hr",

];



const HR_OPTIONS = [

  "main_doeuvre",

  "pointage",

  "reductions_remunerations",

  "paie_declarations",

];



const STOCK_OPTIONS = [

  "stock_dashboard",

  "entree_view",

  "entree_create",

  "entree_update",

  "entree_delete",

  "entree_import",

  "entree_export",

  "entree_send_parking",

  "parking_view",

  "parking_update",

  "parking_delete",

  "parking_send_sortie",

  "sortie_view",

  "sortie_create",

  "sortie_update",

  "sortie_delete",

  "rapport_charge_view",

  "rapport_charge_print",

];



const ROLE_PRESETS: Record<string, EditDraft> = {

  user: {

    role: "user",

    module_access: [],

    hr_access: [],

    stock_access: [],

    can_manage_hr: false,

    can_manage_employees: false,

  },

  admin: {

    role: "admin",

    module_access: ["reception", "production", "stock", "accounting", "hr"],

    hr_access: [...HR_OPTIONS],

    stock_access: [...STOCK_OPTIONS],

    can_manage_hr: true,

    can_manage_employees: true,

  },

  stock_entree_add: {

    role: "stock_entree_add",

    module_access: ["stock"],

    hr_access: [],

    stock_access: ["entree_view", "entree_create"],

    can_manage_hr: false,

    can_manage_employees: false,

  },

  stock_emballage: {

    role: "stock_emballage",

    module_access: ["stock"],

    hr_access: [],

    stock_access: [

      "entree_view",

      "entree_send_parking",

      "parking_view",

      "parking_send_sortie",

      "sortie_view",

      "sortie_create",

      "sortie_update",

      "sortie_delete",

    ],

    can_manage_hr: false,

    can_manage_employees: false,

  },

  hr_pointage: {

    role: "hr_pointage",

    module_access: ["hr"],

    hr_access: ["pointage"],

    stock_access: [],

    can_manage_hr: false,

    can_manage_employees: false,

  },

};



function shortId(id: string) {

  if (!id) return "—";

  return `${id.slice(0, 8)}...${id.slice(-4)}`;

}



function formatDateTime(value: string | null | undefined) {

  if (!value) return "—";



  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;



  return new Intl.DateTimeFormat("en-IE", {

    year: "numeric",

    month: "2-digit",

    day: "2-digit",

    hour: "2-digit",

    minute: "2-digit",

    second: "2-digit",

  }).format(date);

}



function formatJson(value: unknown) {

  if (value === null || value === undefined) return "—";



  try {

    return JSON.stringify(value, null, 2);

  } catch {

    return String(value);

  }

}



function actionChipColor(action: string) {

  const normalized = action.toUpperCase();



  if (normalized === "INSERT") return "success" as const;

  if (normalized === "UPDATE") return "warning" as const;

  if (normalized === "DELETE") return "error" as const;



  return "default" as const;

}



function makeEditDraft(profile: ProfileRow): EditDraft {

  return {

    role: String(profile.role ?? "user"),

    module_access: Array.isArray(profile.module_access) ? profile.module_access : [],

    hr_access: Array.isArray(profile.hr_access) ? profile.hr_access : [],

    stock_access: Array.isArray(profile.stock_access) ? profile.stock_access : [],

    can_manage_hr: Boolean(profile.can_manage_hr),

    can_manage_employees: Boolean(profile.can_manage_employees),

  };

}

function makeCreateDraft(): CreateDraft {

  const preset = ROLE_PRESETS.user;

  return {

    email: "",

    username: "",

    password: "",

    role: preset.role,

    module_access: [...preset.module_access],

    hr_access: [...preset.hr_access],

    stock_access: [...preset.stock_access],

    can_manage_hr: preset.can_manage_hr,

    can_manage_employees: preset.can_manage_employees,

  };

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



function JsonBlock({ title, value }: { title: string; value: unknown }) {

  return (

    <Stack spacing={1}>

      <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>

        {title}

      </Typography>



      <Box

        component="pre"

        sx={{

          m: 0,

          p: 2,

          borderRadius: 2,

          bgcolor: "#0f172a",

          color: "#e5e7eb",

          fontSize: 12,

          overflow: "auto",

          maxHeight: 420,

          whiteSpace: "pre-wrap",

          wordBreak: "break-word",

        }}

      >

        {formatJson(value)}

      </Box>

    </Stack>

  );

}



function PermissionGroup({

  title,

  options,

  values,

  onToggle,

}: {

  title: string;

  options: string[];

  values: string[];

  onToggle: (value: string) => void;

}) {

  return (

    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>

      <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>

        {title}

      </Typography>



      <FormGroup

        sx={{

          display: "grid",

          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },

          gap: 0.2,

        }}

      >

        {options.map((option) => (

          <FormControlLabel

            key={option}

            control={

              <Checkbox

                size="small"

                checked={values.includes(option)}

                onChange={() => onToggle(option)}

              />

            }

            label={<Typography variant="body2">{option}</Typography>}

          />

        ))}

      </FormGroup>

    </Paper>

  );

}



export default function SettingsPage() {

  const [tab, setTab] = React.useState(0);

  const [profiles, setProfiles] = React.useState<ProfileRow[]>([]);

  const [auditLogs, setAuditLogs] = React.useState<AuditLogRow[]>([]);

  const [selectedLog, setSelectedLog] = React.useState<AuditLogRow | null>(null);

  const [editTarget, setEditTarget] = React.useState<ProfileRow | null>(null);

  const [editDraft, setEditDraft] = React.useState<EditDraft | null>(null);

  const [disableTarget, setDisableTarget] = React.useState<ProfileRow | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  const [createDraft, setCreateDraft] = React.useState<CreateDraft>(() => makeCreateDraft());

  const [loading, setLoading] = React.useState(true);

  const [loadingLogs, setLoadingLogs] = React.useState(false);

  const [savingUserAccess, setSavingUserAccess] = React.useState(false);

  const [changingDisabled, setChangingDisabled] = React.useState(false);

  const [creatingUser, setCreatingUser] = React.useState(false);

  const [error, setError] = React.useState("");

  const [logsError, setLogsError] = React.useState("");

  const [editError, setEditError] = React.useState("");

  const [createError, setCreateError] = React.useState("");

  const [info, setInfo] = React.useState("");



  const loadProfiles = React.useCallback(async () => {

    setLoading(true);

    setError("");



    try {

      const { data, error: profilesError } = await supabase.rpc(

        "settings_list_users"

      );



      if (profilesError) throw new Error(profilesError.message);



      setProfiles((data ?? []) as ProfileRow[]);

    } catch (loadError: any) {

      setError(loadError?.message ?? "Unable to load security settings.");

      setProfiles([]);

    } finally {

      setLoading(false);

    }

  }, []);



  const loadAuditLogs = React.useCallback(async () => {

    setLoadingLogs(true);

    setLogsError("");



    try {

      const { data, error: logsLoadError } = await supabase

        .from("app_audit_logs")

        .select(

          "id, created_at, actor_user_id, actor_email, actor_role, action, module, table_name, row_id, old_data, new_data, source, notes"

        )

        .order("created_at", { ascending: false })

        .limit(100);



      if (logsLoadError) throw new Error(logsLoadError.message);



      setAuditLogs((data ?? []) as AuditLogRow[]);

    } catch (loadError: any) {

      setLogsError(loadError?.message ?? "Unable to load audit logs.");

      setAuditLogs([]);

    } finally {

      setLoadingLogs(false);

    }

  }, []);



  React.useEffect(() => {

    loadProfiles();

  }, [loadProfiles]);



  React.useEffect(() => {

    if (tab === 2) {

      void loadAuditLogs();

    }

  }, [loadAuditLogs, tab]);



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



  const disabledUsers = profiles.filter((profile) => Boolean(profile.is_disabled));



  const insertLogs = auditLogs.filter(

    (log) => String(log.action ?? "").toUpperCase() === "INSERT"

  ).length;



  const updateLogs = auditLogs.filter(

    (log) => String(log.action ?? "").toUpperCase() === "UPDATE"

  ).length;



  const deleteLogs = auditLogs.filter(

    (log) => String(log.action ?? "").toUpperCase() === "DELETE"

  ).length;



  const openEditDialog = (profile: ProfileRow) => {

    setInfo("");

    setEditError("");



    if (String(profile.role ?? "").toLowerCase() === "superuser") {

      setEditError("The superuser account is locked and cannot be edited from Settings.");

      return;

    }



    setEditTarget(profile);

    setEditDraft(makeEditDraft(profile));

  };



  const closeEditDialog = () => {

    if (savingUserAccess) return;

    setEditTarget(null);

    setEditDraft(null);

    setEditError("");

  };



  const applyRolePreset = (role: string) => {

    const preset = ROLE_PRESETS[role] ?? ROLE_PRESETS.user;

    setEditDraft({

      role: preset.role,

      module_access: [...preset.module_access],

      hr_access: [...preset.hr_access],

      stock_access: [...preset.stock_access],

      can_manage_hr: preset.can_manage_hr,

      can_manage_employees: preset.can_manage_employees,

    });

  };



  const toggleDraftValue = (

    key: "module_access" | "hr_access" | "stock_access",

    value: string

  ) => {

    setEditDraft((current) => {

      if (!current) return current;



      const values = current[key];

      const nextValues = values.includes(value)

        ? values.filter((item) => item !== value)

        : [...values, value];



      return {

        ...current,

        [key]: nextValues,

      };

    });

  };



  const saveUserAccess = async () => {

    if (!editTarget || !editDraft) return;



    setSavingUserAccess(true);

    setEditError("");

    setInfo("");



    try {

      await ensureFreshSession();



      const { error: updateError } = await supabase.rpc(

        "settings_update_user_access",

        {

          p_user_id: editTarget.id,

          p_role: editDraft.role,

          p_module_access: editDraft.module_access,

          p_hr_access: editDraft.hr_access,

          p_stock_access: editDraft.stock_access,

          p_can_manage_hr: editDraft.can_manage_hr,

          p_can_manage_employees: editDraft.can_manage_employees,

        }

      );



      if (updateError) throw new Error(updateError.message);



      closeEditDialog();

      await loadProfiles();

      setInfo(`Access updated for ${editTarget.email || editTarget.username || shortId(editTarget.id)}.`);

    } catch (saveError: any) {

      setEditError(saveError?.message ?? "Unable to update user access.");

    } finally {

      setSavingUserAccess(false);

    }

  };



  const openDisableDialog = (profile: ProfileRow) => {

    setInfo("");

    setEditError("");



    if (String(profile.role ?? "").toLowerCase() === "superuser") {

      setEditError("The superuser account cannot be disabled from Settings.");

      return;

    }



    setDisableTarget(profile);

  };



  const closeDisableDialog = () => {

    if (changingDisabled) return;

    setDisableTarget(null);

  };



  const confirmToggleDisabled = async () => {

    if (!disableTarget) return;



    const nextDisabled = !Boolean(disableTarget.is_disabled);

    setChangingDisabled(true);

    setEditError("");

    setInfo("");



    try {

      await ensureFreshSession();



      const { error: disabledError } = await supabase.rpc(

        "settings_set_user_disabled",

        {

          p_user_id: disableTarget.id,

          p_is_disabled: nextDisabled,

        }

      );



      if (disabledError) throw new Error(disabledError.message);



      closeDisableDialog();

      await loadProfiles();

      setInfo(

        `${disableTarget.email || disableTarget.username || shortId(disableTarget.id)} ${

          nextDisabled ? "disabled" : "enabled"

        } successfully.`

      );

    } catch (disableError: any) {

      setEditError(disableError?.message ?? "Unable to update disabled status.");

    } finally {

      setChangingDisabled(false);

    }

  };



  const openCreateDialog = () => {

    setInfo("");

    setCreateError("");

    setCreateDraft(makeCreateDraft());

    setCreateDialogOpen(true);

  };


  const closeCreateDialog = () => {

    if (creatingUser) return;

    setCreateDialogOpen(false);

    setCreateError("");

  };


  const applyCreateRolePreset = (role: string) => {

    const preset = ROLE_PRESETS[role] ?? ROLE_PRESETS.user;

    setCreateDraft((current) => ({

      ...current,

      role: preset.role,

      module_access: [...preset.module_access],

      hr_access: [...preset.hr_access],

      stock_access: [...preset.stock_access],

      can_manage_hr: preset.can_manage_hr,

      can_manage_employees: preset.can_manage_employees,

    }));

  };


  const toggleCreateDraftValue = (

    key: "module_access" | "hr_access" | "stock_access",

    value: string

  ) => {

    setCreateDraft((current) => {

      const values = current[key];

      const nextValues = values.includes(value)

        ? values.filter((item) => item !== value)

        : [...values, value];


      return {

        ...current,

        [key]: nextValues,

      };

    });

  };


  const saveNewUser = async () => {

    const email = createDraft.email.trim().toLowerCase();

    const username = createDraft.username.trim();

    const password = createDraft.password;


    if (!email) {

      setCreateError("Email is required.");

      return;

    }


    if (!password || password.length < 8) {

      setCreateError("Password must contain at least 8 characters.");

      return;

    }


    setCreatingUser(true);

    setCreateError("");

    setInfo("");


    try {

      const session = await ensureFreshSession();


      const response = await fetch("/api/settings-create-user", {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

          Authorization: `Bearer ${session.access_token}`,

        },

        body: JSON.stringify({

          email,

          password,

          username,

          role: createDraft.role,

          module_access: createDraft.module_access,

          hr_access: createDraft.hr_access,

          stock_access: createDraft.stock_access,

          can_manage_hr: createDraft.can_manage_hr,

          can_manage_employees: createDraft.can_manage_employees,

        }),

      });


      const result = await response.json().catch(() => null);


      if (!response.ok) {

        throw new Error(result?.error ?? "Unable to create user.");

      }


      closeCreateDialog();

      setCreateDraft(makeCreateDraft());

      await loadProfiles();

      setInfo(`User created: ${email}`);

    } catch (createUserError: any) {

      setCreateError(createUserError?.message ?? "Unable to create user.");

    } finally {

      setCreatingUser(false);

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

          {editError ? <Alert severity="warning">{editError}</Alert> : null}

          {info ? <Alert severity="success">{info}</Alert> : null}



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

                      description="Database trigger logs for Entrée, Parking and Sortie changes."

                      value="Active"

                      status="active"

                    />

                  </Box>



                  <Alert severity="info">

                    Dangerous actions such as user creation, user deletion, role

                    changes and permanent deletion go through secure server-side

                    functions. They are not executed directly from frontend table

                    writes.

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

                        Edit user access through a secure superuser-only RPC.

                        The superuser account remains locked from frontend edits.

                      </Typography>

                    </Box>



                    <Stack direction="row" spacing={1} flexWrap="wrap">

                      <Button variant="outlined" onClick={openCreateDialog}>

                        Add user

                      </Button>



                      <Button variant="outlined" disabled>

                        Disable/enable from row actions

                      </Button>

                    </Stack>

                  </Stack>



                  <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>

                    <Box

                      sx={{

                        display: "grid",

                        gridTemplateColumns: {

                          xs: "1fr",

                          md: "1.2fr 0.8fr 0.8fr 1.1fr 1.1fr 1.5fr 1fr",

                        },

                        bgcolor: "primary.main",

                        color: "primary.contrastText",

                        fontWeight: 900,

                      }}

                    >

                      <Box sx={{ p: 1.5 }}>User</Box>

                      <Box sx={{ p: 1.5 }}>Role</Box>

                      <Box sx={{ p: 1.5 }}>Status</Box>

                      <Box sx={{ p: 1.5 }}>Modules</Box>

                      <Box sx={{ p: 1.5 }}>HR access</Box>

                      <Box sx={{ p: 1.5 }}>Stock access</Box>

                      <Box sx={{ p: 1.5 }}>Actions</Box>

                    </Box>



                    {profiles.length ? (

                      profiles.map((profile) => {

                        const isSuperuser =

                          String(profile.role ?? "").toLowerCase() === "superuser";

                        const isDisabled = Boolean(profile.is_disabled);



                        return (

                          <Box

                            key={profile.id}

                            sx={{

                              display: "grid",

                              gridTemplateColumns: {

                                xs: "1fr",

                                md: "1.2fr 0.8fr 0.8fr 1.1fr 1.1fr 1.5fr 1fr",

                              },

                              borderTop: "1px solid",

                              borderColor: "divider",

                              bgcolor: isDisabled ? "#f8fafc" : "background.paper",

                            }}

                          >

                            <Box sx={{ p: 1.5 }}>

                              <Typography variant="body2" sx={{ fontWeight: 800 }}>

                                {profile.email || profile.username || shortId(profile.id)}

                              </Typography>



                              <Typography

                                variant="caption"

                                sx={{ color: "text.secondary" }}

                              >

                                {profile.username ? `${profile.username} • ` : ""}

                                {shortId(profile.id)}

                              </Typography>

                            </Box>



                            <Box sx={{ p: 1.5 }}>

                              <Chip

                                size="small"

                                label={profile.role || "user"}

                                color={isSuperuser ? "success" : "default"}

                              />

                            </Box>



                            <Box sx={{ p: 1.5 }}>

                              <Chip

                                size="small"

                                label={isDisabled ? "Disabled" : "Active"}

                                color={isDisabled ? "warning" : "success"}

                                variant={isDisabled ? "filled" : "outlined"}

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

                              <Stack spacing={0.7} alignItems="flex-start">

                                {(profile.stock_access ?? []).length ? (

                                  (profile.stock_access ?? []).map((item) => (

                                    <Chip

                                      key={`${profile.id}-${item}`}

                                      size="small"

                                      variant="outlined"

                                      label={item}

                                    />

                                  ))

                                ) : (

                                  <Typography variant="body2">—</Typography>

                                )}



                                <Stack direction="row" spacing={0.5} flexWrap="wrap">

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

                              </Stack>

                            </Box>



                            <Box sx={{ p: 1.5 }}>

                              <Stack spacing={0.75} alignItems="flex-start">

                                <Button

                                  size="small"

                                  variant="outlined"

                                  disabled={isSuperuser}

                                  onClick={() => openEditDialog(profile)}

                                >

                                  Edit

                                </Button>



                                <Button

                                  size="small"

                                  variant="outlined"

                                  color={isDisabled ? "success" : "warning"}

                                  disabled={isSuperuser}

                                  onClick={() => openDisableDialog(profile)}

                                >

                                  {isDisabled ? "Enable" : "Disable"}

                                </Button>



                                {isSuperuser ? (

                                  <Typography

                                    variant="caption"

                                    sx={{ display: "block", color: "text.secondary", mt: 0.5 }}

                                  >

                                    Locked

                                  </Typography>

                                ) : null}

                              </Stack>

                            </Box>

                          </Box>

                        );

                      })

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

                  <Stack

                    direction={{ xs: "column", md: "row" }}

                    justifyContent="space-between"

                    alignItems={{ xs: "flex-start", md: "center" }}

                    spacing={2}

                  >

                    <Box>

                      <Typography variant="h5" sx={{ fontWeight: 900 }}>

                        Application logs

                      </Typography>



                      <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>

                        Shows the last 100 audit logs. Only the superuser can

                        read these logs.

                      </Typography>

                    </Box>



                    <Button

                      variant="outlined"

                      onClick={loadAuditLogs}

                      disabled={loadingLogs}

                    >

                      Refresh logs

                    </Button>

                  </Stack>



                  {logsError ? <Alert severity="warning">{logsError}</Alert> : null}



                  <Box

                    sx={{

                      display: "grid",

                      gridTemplateColumns: {

                        xs: "1fr",

                        md: "repeat(4, minmax(0, 1fr))",

                      },

                      gap: 2,

                    }}

                  >

                    <SettingsCard

                      title="Total logs"

                      description="Latest loaded audit log rows from the database."

                      value={String(auditLogs.length)}

                      status="active"

                    />



                    <SettingsCard

                      title="Insert actions"

                      description="Rows created in audited tables."

                      value={String(insertLogs)}

                      status="active"

                    />



                    <SettingsCard

                      title="Update actions"

                      description="Rows modified in audited tables."

                      value={String(updateLogs)}

                      status="active"

                    />



                    <SettingsCard

                      title="Delete actions"

                      description="Rows deleted from audited tables."

                      value={String(deleteLogs)}

                      status={deleteLogs > 0 ? "warning" : "active"}

                    />

                  </Box>



                  <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>

                    <Box

                      sx={{

                        display: "grid",

                        gridTemplateColumns: {

                          xs: "1fr",

                          md: "1.2fr 1.6fr 1fr 1fr 1fr 1.3fr 0.8fr",

                        },

                        bgcolor: "primary.main",

                        color: "primary.contrastText",

                        fontWeight: 900,

                      }}

                    >

                      <Box sx={{ p: 1.5 }}>Date</Box>

                      <Box sx={{ p: 1.5 }}>User</Box>

                      <Box sx={{ p: 1.5 }}>Role</Box>

                      <Box sx={{ p: 1.5 }}>Action</Box>

                      <Box sx={{ p: 1.5 }}>Table</Box>

                      <Box sx={{ p: 1.5 }}>Row</Box>

                      <Box sx={{ p: 1.5 }}>Details</Box>

                    </Box>



                    {loadingLogs ? (

                      <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>

                        <CircularProgress />

                        <Typography variant="body2" sx={{ color: "text.secondary" }}>

                          Loading audit logs...

                        </Typography>

                      </Stack>

                    ) : null}



                    {!loadingLogs && auditLogs.length ? (

                      auditLogs.map((log) => (

                        <Box

                          key={log.id}

                          sx={{

                            display: "grid",

                            gridTemplateColumns: {

                              xs: "1fr",

                              md: "1.2fr 1.6fr 1fr 1fr 1fr 1.3fr 0.8fr",

                            },

                            borderTop: "1px solid",

                            borderColor: "divider",

                            bgcolor: "background.paper",

                            alignItems: "center",

                          }}

                        >

                          <Box sx={{ p: 1.5 }}>

                            <Typography variant="body2" sx={{ fontWeight: 800 }}>

                              {formatDateTime(log.created_at)}

                            </Typography>

                          </Box>



                          <Box sx={{ p: 1.5 }}>

                            <Typography variant="body2" sx={{ fontWeight: 800 }}>

                              {log.actor_email || "—"}

                            </Typography>

                            <Typography variant="caption" sx={{ color: "text.secondary" }}>

                              {log.source || "database_trigger"}

                            </Typography>

                          </Box>



                          <Box sx={{ p: 1.5 }}>

                            <Chip size="small" label={log.actor_role || "—"} />

                          </Box>



                          <Box sx={{ p: 1.5 }}>

                            <Chip

                              size="small"

                              color={actionChipColor(log.action)}

                              label={log.action}

                            />

                          </Box>



                          <Box sx={{ p: 1.5 }}>

                            <Typography variant="body2">{log.table_name}</Typography>

                          </Box>



                          <Box sx={{ p: 1.5 }}>

                            <Typography variant="body2" sx={{ fontFamily: "monospace" }}>

                              {log.row_id || "—"}

                            </Typography>

                          </Box>



                          <Box sx={{ p: 1.5 }}>

                            <Button

                              size="small"

                              variant="outlined"

                              onClick={() => setSelectedLog(log)}

                            >

                              View

                            </Button>

                          </Box>

                        </Box>

                      ))

                    ) : null}



                    {!loadingLogs && !auditLogs.length ? (

                      <Box sx={{ p: 3 }}>

                        <Typography variant="body2" sx={{ color: "text.secondary" }}>

                          No audit logs found yet.

                        </Typography>

                      </Box>

                    ) : null}

                  </Paper>



                  <Alert severity="info">

                    These logs are generated by database triggers and frontend event

                    logs. Users should not be able to edit or delete audit logs

                    from the frontend.

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



                    <SettingsCard

                      title="Disabled users"

                      description="Accounts blocked from using Lite V2 at profile level."

                      value={String(disabledUsers.length)}

                      status={disabledUsers.length > 0 ? "warning" : "active"}

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

                    Maintenance actions should never directly delete data. We will

                    use archive, deactivation and history instead.

                  </Alert>

                </Stack>

              ) : null}

            </Box>

          </Paper>

        </Stack>

      </Box>



      <AppFooter />



      <Dialog

        open={Boolean(selectedLog)}

        onClose={() => setSelectedLog(null)}

        fullWidth

        maxWidth="lg"

      >

        <DialogTitle sx={{ fontWeight: 900 }}>

          Audit log details

        </DialogTitle>



        <DialogContent dividers>

          {selectedLog ? (

            <Stack spacing={3}>

              <Box

                sx={{

                  display: "grid",

                  gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },

                  gap: 2,

                }}

              >

                <SettingsCard

                  title="Action"

                  description={`${selectedLog.table_name} • ${selectedLog.row_id || "no row id"}`}

                  value={selectedLog.action}

                  status={selectedLog.action === "DELETE" ? "warning" : "active"}

                />



                <SettingsCard

                  title="Actor"

                  description={selectedLog.actor_role || "No role recorded"}

                  value={selectedLog.actor_email || "Unknown user"}

                  status="active"

                />

              </Box>



              <JsonBlock title="Old data" value={selectedLog.old_data} />

              <JsonBlock title="New data" value={selectedLog.new_data} />

            </Stack>

          ) : null}

        </DialogContent>



        <DialogActions>

          <Button onClick={() => setSelectedLog(null)}>Close</Button>

        </DialogActions>

      </Dialog>



      <Dialog

        open={Boolean(editTarget && editDraft)}

        onClose={closeEditDialog}

        fullWidth

        maxWidth="lg"

      >

        <DialogTitle sx={{ fontWeight: 900 }}>

          Edit user access

        </DialogTitle>



        <DialogContent dividers>

          {editTarget && editDraft ? (

            <Stack spacing={3}>

              <Alert severity="info">

                This action uses the secure <strong>settings_update_user_access</strong>{" "}

                RPC. The superuser account cannot be edited here, and another

                superuser cannot be created.

              </Alert>



              {editError ? <Alert severity="warning">{editError}</Alert> : null}



              <Box

                sx={{

                  display: "grid",

                  gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr" },

                  gap: 2,

                }}

              >

                <SettingsCard

                  title="User"

                  description={shortId(editTarget.id)}

                  value={editTarget.email || editTarget.username || "Unknown user"}

                  status="active"

                />



                <FormControl fullWidth>

                  <InputLabel id="settings-edit-role-label">Role</InputLabel>

                  <Select

                    labelId="settings-edit-role-label"

                    label="Role"

                    value={editDraft.role}

                    onChange={(event) => applyRolePreset(String(event.target.value))}

                  >

                    {ROLE_OPTIONS.map((role) => (

                      <MenuItem key={role} value={role}>

                        {role}

                      </MenuItem>

                    ))}

                  </Select>

                </FormControl>

              </Box>



              <Box

                sx={{

                  display: "grid",

                  gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },

                  gap: 2,

                }}

              >

                <PermissionGroup

                  title="Module access"

                  options={MODULE_OPTIONS}

                  values={editDraft.module_access}

                  onToggle={(value) => toggleDraftValue("module_access", value)}

                />



                <PermissionGroup

                  title="HR access"

                  options={HR_OPTIONS}

                  values={editDraft.hr_access}

                  onToggle={(value) => toggleDraftValue("hr_access", value)}

                />

              </Box>



              <PermissionGroup

                title="Stock access"

                options={STOCK_OPTIONS}

                values={editDraft.stock_access}

                onToggle={(value) => toggleDraftValue("stock_access", value)}

              />



              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>

                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>

                  Management flags

                </Typography>



                <FormGroup>

                  <FormControlLabel

                    control={

                      <Checkbox

                        checked={editDraft.can_manage_hr}

                        onChange={(event) =>

                          setEditDraft((current) =>

                            current

                              ? { ...current, can_manage_hr: event.target.checked }

                              : current

                          )

                        }

                      />

                    }

                    label="Can manage HR"

                  />



                  <FormControlLabel

                    control={

                      <Checkbox

                        checked={editDraft.can_manage_employees}

                        onChange={(event) =>

                          setEditDraft((current) =>

                            current

                              ? {

                                  ...current,

                                  can_manage_employees: event.target.checked,

                                }

                              : current

                          )

                        }

                      />

                    }

                    label="Can manage employees"

                  />

                </FormGroup>

              </Paper>

            </Stack>

          ) : null}

        </DialogContent>



        <DialogActions>

          <Button onClick={closeEditDialog} disabled={savingUserAccess}>

            Cancel

          </Button>

          <Button

            variant="contained"

            onClick={saveUserAccess}

            disabled={savingUserAccess || !editTarget || !editDraft}

          >

            {savingUserAccess ? "Saving..." : "Save access"}

          </Button>

        </DialogActions>

      </Dialog>




      <Dialog

        open={createDialogOpen}

        onClose={closeCreateDialog}

        fullWidth

        maxWidth="lg"

      >

        <DialogTitle sx={{ fontWeight: 900 }}>Add user</DialogTitle>


        <DialogContent dividers>

          <Stack spacing={3}>

            <Alert severity="info">

              This creates a Supabase Auth user through the secure server function

              <strong> /api/settings-create-user</strong>. Never create users with

              the service-role key in frontend code.

            </Alert>


            {createError ? <Alert severity="warning">{createError}</Alert> : null}


            <Box

              sx={{

                display: "grid",

                gridTemplateColumns: { xs: "1fr", md: "1.2fr 1fr 1fr" },

                gap: 2,

              }}

            >

              <TextField

                label="Email"

                type="email"

                value={createDraft.email}

                onChange={(event) =>

                  setCreateDraft((current) => ({

                    ...current,

                    email: event.target.value,

                  }))

                }

                fullWidth

                required

              />


              <TextField

                label="Username"

                value={createDraft.username}

                onChange={(event) =>

                  setCreateDraft((current) => ({

                    ...current,

                    username: event.target.value,

                  }))

                }

                fullWidth

              />


              <TextField

                label="Temporary password"

                type="password"

                value={createDraft.password}

                onChange={(event) =>

                  setCreateDraft((current) => ({

                    ...current,

                    password: event.target.value,

                  }))

                }

                fullWidth

                required

                helperText="Minimum 8 characters. The user can change it later."

              />

            </Box>


            <Box

              sx={{

                display: "grid",

                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },

                gap: 2,

              }}

            >

              <FormControl fullWidth>

                <InputLabel id="settings-create-role-label">Role</InputLabel>

                <Select

                  labelId="settings-create-role-label"

                  label="Role"

                  value={createDraft.role}

                  onChange={(event) => applyCreateRolePreset(String(event.target.value))}

                >

                  {ROLE_OPTIONS.map((role) => (

                    <MenuItem key={role} value={role}>

                      {role}

                    </MenuItem>

                  ))}

                </Select>

              </FormControl>


              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>

                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>

                  Management flags

                </Typography>


                <FormGroup>

                  <FormControlLabel

                    control={

                      <Checkbox

                        checked={createDraft.can_manage_hr}

                        onChange={(event) =>

                          setCreateDraft((current) => ({

                            ...current,

                            can_manage_hr: event.target.checked,

                          }))

                        }

                      />

                    }

                    label="Can manage HR"

                  />


                  <FormControlLabel

                    control={

                      <Checkbox

                        checked={createDraft.can_manage_employees}

                        onChange={(event) =>

                          setCreateDraft((current) => ({

                            ...current,

                            can_manage_employees: event.target.checked,

                          }))

                        }

                      />

                    }

                    label="Can manage employees"

                  />

                </FormGroup>

              </Paper>

            </Box>


            <Box

              sx={{

                display: "grid",

                gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },

                gap: 2,

              }}

            >

              <PermissionGroup

                title="Module access"

                options={MODULE_OPTIONS}

                values={createDraft.module_access}

                onToggle={(value) => toggleCreateDraftValue("module_access", value)}

              />


              <PermissionGroup

                title="HR access"

                options={HR_OPTIONS}

                values={createDraft.hr_access}

                onToggle={(value) => toggleCreateDraftValue("hr_access", value)}

              />

            </Box>


            <PermissionGroup

              title="Stock access"

              options={STOCK_OPTIONS}

              values={createDraft.stock_access}

              onToggle={(value) => toggleCreateDraftValue("stock_access", value)}

            />

          </Stack>

        </DialogContent>


        <DialogActions>

          <Button onClick={closeCreateDialog} disabled={creatingUser}>

            Cancel

          </Button>

          <Button

            variant="contained"

            onClick={saveNewUser}

            disabled={creatingUser}

          >

            {creatingUser ? "Creating..." : "Create user"}

          </Button>

        </DialogActions>

      </Dialog>



      <Dialog

        open={Boolean(disableTarget)}

        onClose={closeDisableDialog}

        fullWidth

        maxWidth="sm"

      >

        <DialogTitle sx={{ fontWeight: 900 }}>

          {disableTarget?.is_disabled ? "Enable user" : "Disable user"}

        </DialogTitle>



        <DialogContent dividers>

          {disableTarget ? (

            <Stack spacing={2}>

              <Alert severity={disableTarget.is_disabled ? "info" : "warning"}>

                {disableTarget.is_disabled

                  ? "This will allow the user to access Lite V2 again."

                  : "This will block the user from using Lite V2. The account is not deleted."}

              </Alert>



              <SettingsCard

                title={disableTarget.is_disabled ? "User to enable" : "User to disable"}

                description={`${disableTarget.role || "user"} • ${shortId(disableTarget.id)}`}

                value={disableTarget.email || disableTarget.username || "Unknown user"}

                status={disableTarget.is_disabled ? "warning" : "active"}

              />

            </Stack>

          ) : null}

        </DialogContent>



        <DialogActions>

          <Button onClick={closeDisableDialog} disabled={changingDisabled}>

            Cancel

          </Button>

          <Button

            variant="contained"

            color={disableTarget?.is_disabled ? "success" : "warning"}

            onClick={confirmToggleDisabled}

            disabled={changingDisabled || !disableTarget}

          >

            {changingDisabled

              ? "Saving..."

              : disableTarget?.is_disabled

              ? "Enable user"

              : "Disable user"}

          </Button>

        </DialogActions>

      </Dialog>

    </Box>

  );

}

import * as React from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { supabase } from "../lib/supabaseClient";

type HrAccessKey =
  | "pointage"
  | "employees"
  | "contracts"
  | "planning"
  | "payroll";

type ProfileRow = {
  role: string | null;
  hr_access: string[] | null;
  can_manage_hr: boolean | null;
};

function hasHrAccess(profile: ProfileRow | null, accessKey: HrAccessKey) {
  if (!profile) return false;

  const role = String(profile.role ?? "").toLowerCase();

  if (role === "superuser") return true;
  if (profile.can_manage_hr === true) return true;

  const access = Array.isArray(profile.hr_access) ? profile.hr_access : [];

  return access.includes(accessKey);
}

export default function RequireHrAccess({
  accessKey,
  children,
}: {
  accessKey: HrAccessKey;
  children: React.ReactNode;
}) {
  const [status, setStatus] = React.useState<
    "checking" | "allowed" | "denied"
  >("checking");

  React.useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (mounted) setStatus("denied");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("role, hr_access, can_manage_hr")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw new Error(error.message);

        const allowed = hasHrAccess((data ?? null) as ProfileRow | null, accessKey);

        if (mounted) {
          setStatus(allowed ? "allowed" : "denied");
        }
      } catch {
        if (mounted) setStatus("denied");
      }
    };

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [accessKey]);

  if (status === "checking") {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Vérification des permissions HR...
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (status === "denied") {
    return <Navigate to="/hr" replace />;
  }

  return <>{children}</>;
}
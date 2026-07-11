import * as React from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { supabase } from "../lib/supabaseClient";

type ModuleKey =
  | "reception"
  | "production"
  | "stock"
  | "accounting"
  | "hr"
  | "pointage";

type ProfileRow = {
  role: string | null;
  module_access: string[] | null;
};

function hasAccess(profile: ProfileRow | null, moduleKey: ModuleKey) {
  if (!profile) return false;

  const role = String(profile.role ?? "").toLowerCase();

  if (role === "superuser") return true;

  const access = Array.isArray(profile.module_access)
    ? profile.module_access
    : [];

  return access.includes(moduleKey);
}

export default function RequireModule({
  moduleKey,
  children,
}: {
  moduleKey: ModuleKey;
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
          .select("role, module_access")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw new Error(error.message);

        const allowed = hasAccess((data ?? null) as ProfileRow | null, moduleKey);

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
  }, [moduleKey]);

  if (status === "checking") {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Vérification des permissions...
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (status === "denied") {
    return <Navigate to="/modules" replace />;
  }

  return <>{children}</>;
}
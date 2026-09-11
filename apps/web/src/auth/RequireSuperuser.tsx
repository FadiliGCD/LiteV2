import * as React from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { supabase } from "../lib/supabaseClient";

type ProfileRow = {
  role: string | null;
};

export default function RequireSuperuser({
  children,
}: {
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
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw new Error(error.message);

        const profile = (data ?? null) as ProfileRow | null;
        const role = String(profile?.role ?? "").toLowerCase();

        if (mounted) {
          setStatus(role === "superuser" ? "allowed" : "denied");
        }
      } catch {
        if (mounted) setStatus("denied");
      }
    };

    checkAccess();

    return () => {
      mounted = false;
    };
  }, []);

  if (status === "checking") {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />

          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Vérification des permissions superuser...
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
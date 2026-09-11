import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { getSession, signOut } from "../auth/auth";

type AppHeaderProps = {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  showLogout?: boolean;
};

export default function AppHeader({
  title,
  subtitle,
  actions,
  showLogout = true,
}: AppHeaderProps) {
  const navigate = useNavigate();
  const [userLabel, setUserLabel] = React.useState("Session active");

  React.useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const session = await getSession();

        if (!mounted) return;

        if (session) {
          setUserLabel(`${session.user.email} • ${session.role}`);
        }
      } catch {
        if (mounted) {
          setUserLabel("Session active");
        }
      }
    };

    loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  const logout = async () => {
    try {
      await signOut();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <Paper
      square
      elevation={0}
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "rgba(255,255,255,0.94)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 20,
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
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
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
                {title}
              </Typography>

              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {subtitle}
              </Typography>
            </Box>
          </Stack>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
          >
            <Chip variant="outlined" label={userLabel} />

            {actions}

            {showLogout ? (
              <Button variant="outlined" onClick={logout}>
                Déconnexion
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Box>
    </Paper>
  );
}
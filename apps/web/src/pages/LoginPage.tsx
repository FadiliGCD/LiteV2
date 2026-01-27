import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  Divider,
} from "@mui/material";
import { setSession } from "../auth/auth";
import AppFooter from "../components/AppFooter";

export default function LoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");

  const onLogin = () => {
    // TEMP (frontend-only):
    // admin/admin => superuser
    // user/user => user
    if (username === "admin" && password === "admin") {
      setSession({ username, role: "superuser" });
      nav("/", { replace: true });
      return;
    }
    if (username === "user" && password === "user") {
      setSession({ username, role: "user" });
      nav("/", { replace: true });
      return;
    }
    alert("Invalid credentials");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background:
          "linear-gradient(180deg, rgba(11,61,145,0.10) 0%, rgba(244,246,248,1) 45%)",
      }}
    >
      <Box sx={{ flex: 1, display: "grid", placeItems: "center", p: 2 }}>
        <Paper
          sx={{
            width: "min(520px, 92vw)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          {/* Top official band */}
          <Box
            sx={{
              px: 3,
              py: 2,
              background: "linear-gradient(90deg, #0B3D91 0%, #1F6FEB 100%)",
              color: "white",
            }}
          >
            <Typography variant="h6">AFB Global Portal</Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Secure Access • Authorized Personnel Only
            </Typography>
          </Box>

          <Stack spacing={2} sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Sign in
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Enter your credentials to continue.
            </Typography>

            <Divider />

            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              fullWidth
            />

            <Button variant="contained" size="large" onClick={onLogin}>
              Login
            </Button>

            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Demo: admin/admin (superuser), user/user (user)
            </Typography>
          </Stack>
        </Paper>
      </Box>

      <AppFooter />
    </Box>
  );
}

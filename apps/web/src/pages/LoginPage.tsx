import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  Divider,
} from "@mui/material";
import AppFooter from "../components/AppFooter";
import { signInWithEmail, signUpWithEmail } from "../auth/auth";

export default function LoginPage() {
  const nav = useNavigate();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [info, setInfo] = React.useState<string>("");

  const onLogin = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      nav("/", { replace: true });
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const onSignUp = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password);
      setInfo(
        "Account created. If email confirmation is enabled, check your inbox. Otherwise you can sign in now."
      );
    } catch (e: any) {
      setError(e?.message ?? "Sign up failed");
    } finally {
      setLoading(false);
    }
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
            <Typography variant="h6">KATASAB Fish Portail</Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Authorized Personnel Only
            </Typography>
          </Box>

          <Stack spacing={2} sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Sign in
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Use your email + password.
            </Typography>

            <Divider />

            {info ? <Alert severity="success">{info}</Alert> : null}
            {error ? <Alert severity="error">{error}</Alert> : null}

            <TextField
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
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

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="contained"
                size="large"
                onClick={onLogin}
                disabled={loading}
                fullWidth
              >
                {loading ? "Please wait..." : "Login"}
              </Button>

              
            </Stack>

            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              In case you forget your password, please contact the administrator to reset it for you.
            </Typography>
          </Stack>
        </Paper>
      </Box>

      <AppFooter />
    </Box>
  );
}

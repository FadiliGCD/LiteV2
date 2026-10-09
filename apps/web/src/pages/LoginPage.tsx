import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AppFooter from "../components/AppFooter";
import { signInWithEmail } from "../auth/auth";

export default function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [info, setInfo] = React.useState<string>("");
  const [updateMessage, setUpdateMessage] = React.useState("");

  React.useEffect(() => {
    try {
      const message = sessionStorage.getItem("lite-v2.update-message");
      if (message) {
        setUpdateMessage(message);
        sessionStorage.removeItem("lite-v2.update-message");
      }
    } catch {
      // ignore
    }
  }, []);

  const onLogin = async () => {
    const cleanEmail = email.trim();
    setError("");
    setInfo("");
    if (!cleanEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(cleanEmail, password);
      nav("/modules", { replace: true });
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loading) void onLogin();
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#eef4fb",
        background:
          "radial-gradient(circle at top left, rgba(14,165,233,0.22), transparent 34%), radial-gradient(circle at bottom right, rgba(29,78,216,0.18), transparent 32%), #eef4fb",
      }}
    >
      <Box
        component="main"
        sx={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          px: { xs: 1.5, md: 3 },
          py: { xs: 3, md: 6 },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: "min(1080px, 96vw)",
            overflow: "hidden",
            borderRadius: 5,
            border: "1px solid rgba(15, 23, 42, 0.08)",
            boxShadow: "0 24px 70px rgba(15, 23, 42, 0.16)",
            bgcolor: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(12px)",
          }}
        >
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.05fr 0.95fr" } }}>
            <Box
              sx={{
                p: { xs: 3, md: 5 },
                color: "white",
                minHeight: { xs: 260, md: 620 },
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                background:
                  "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #0ea5e9 100%)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  width: 320,
                  height: 320,
                  borderRadius: "50%",
                  right: -120,
                  top: -110,
                  bgcolor: "rgba(255,255,255,0.10)",
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  width: 220,
                  height: 220,
                  borderRadius: "50%",
                  left: -90,
                  bottom: -80,
                  bgcolor: "rgba(255,255,255,0.08)",
                }}
              />
              <Stack spacing={2.2} sx={{ position: "relative", zIndex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip
                    label="Lite V2"
                    size="small"
                    sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "white", fontWeight: 900 }}
                  />
                  <Chip
                    label="Internal Portal"
                    size="small"
                    sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "white", fontWeight: 900 }}
                  />
                </Stack>
                <Box>
                  <Typography
                    variant="h3"
                    sx={{
                      fontWeight: 950,
                      letterSpacing: -1,
                      fontSize: { xs: "2.1rem", md: "3rem" },
                      lineHeight: 1.05,
                    }}
                  >
                    KATASAB Fish Portal
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 1.4, opacity: 0.86, fontWeight: 600 }}>
                    Stock, HR and operational control center.
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ maxWidth: 520, opacity: 0.82, lineHeight: 1.8 }}>
                  Secure access for authorized personnel. Every user sees only the modules and actions allowed by their role.
                </Typography>
              </Stack>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.2}
                sx={{ position: "relative", zIndex: 1, mt: 4 }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    bgcolor: "rgba(255,255,255,0.13)",
                    color: "white",
                    flex: 1,
                  }}
                >
                  <Typography variant="caption" sx={{ opacity: 0.76 }}>
                    Security
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 900 }}>
                    Protected access
                  </Typography>
                </Paper>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    bgcolor: "rgba(255,255,255,0.13)",
                    color: "white",
                    flex: 1,
                  }}
                >
                  <Typography variant="caption" sx={{ opacity: 0.76 }}>
                    Workflow
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 900 }}>
                    Entrée → Parking → Sortie
                  </Typography>
                </Paper>
              </Stack>
            </Box>

            <Box
              sx={{
                p: { xs: 3, md: 5 },
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <Stack spacing={2.4} component="form" onSubmit={onSubmit}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: -0.5 }}>
                    Sign in
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.8, color: "text.secondary", lineHeight: 1.7 }}>
                    Use your assigned email and password to continue.
                  </Typography>
                </Box>

                <Divider />

                {updateMessage ? <Alert severity="info">{updateMessage}</Alert> : null}
                {info ? <Alert severity="success">{info}</Alert> : null}
                {error ? <Alert severity="error">{error}</Alert> : null}

                <Stack spacing={1.6}>
                  <TextField
                    label="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    type="email"
                    fullWidth
                    autoFocus
                  />
                  <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    fullWidth
                  />
                </Stack>

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading || !email.trim() || !password}
                  fullWidth
                  sx={{
                    py: 1.35,
                    borderRadius: 2.4,
                    fontWeight: 950,
                    boxShadow: "0 14px 26px rgba(29, 78, 216, 0.22)",
                  }}
                >
                  {loading ? "Please wait..." : "Login"}
                </Button>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.6,
                    borderRadius: 3,
                    bgcolor: "rgba(15, 23, 42, 0.02)",
                  }}
                >
                  <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.7 }}>
                    In case you forget your password, please contact the administrator to reset it for you.
                  </Typography>
                </Paper>
              </Stack>
            </Box>
          </Box>
        </Paper>
      </Box>
      <AppFooter />
    </Box>
  );
}

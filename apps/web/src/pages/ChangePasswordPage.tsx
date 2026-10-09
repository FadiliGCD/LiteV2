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
} from "@mui/material";
import { supabase } from "../lib/supabaseClient";

export default function ChangePasswordPage() {
  const navigate = useNavigate();

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const savePassword = async () => {
    setError("");

    if (!password || password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw new Error(updateError.message);

      const { error: rpcError } = await supabase.rpc(
        "complete_forced_password_change"
      );

      if (rpcError) throw new Error(rpcError.message);

      navigate("/modules", { replace: true });
    } catch (saveError: any) {
      setError(saveError?.message ?? "Unable to change password.");
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
        alignItems: "center",
        justifyContent: "center",
        px: 2,
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          width: "100%",
          maxWidth: 520,
          p: 4,
          borderRadius: 4,
        }}
      >
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              Change password
            </Typography>

            <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
              Your account is using a temporary password. Please create a new
              password before continuing.
            </Typography>
          </Box>

          {error ? <Alert severity="warning">{error}</Alert> : null}

          <TextField
            label="New password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            helperText="Minimum 8 characters."
            fullWidth
            required
          />

          <TextField
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            fullWidth
            required
          />

          <Button
            variant="contained"
            size="large"
            onClick={savePassword}
            disabled={saving}
          >
            {saving ? "Saving..." : "Change password"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
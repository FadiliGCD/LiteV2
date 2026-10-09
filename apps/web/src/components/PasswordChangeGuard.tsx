import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function PasswordChangeGuard() {
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    let mounted = true;

    const checkPasswordFlag = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      if (!user) return;

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("must_change_password, is_disabled")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted || error || !profile) return;

      if (profile.is_disabled) {
        await supabase.auth.signOut();
        navigate("/login", { replace: true });
        return;
      }

      if (
        profile.must_change_password &&
        location.pathname !== "/change-password"
      ) {
        navigate("/change-password", { replace: true });
      }

      if (
        !profile.must_change_password &&
        location.pathname === "/change-password"
      ) {
        navigate("/modules", { replace: true });
      }
    };

    void checkPasswordFlag();

    return () => {
      mounted = false;
    };
  }, [location.pathname, navigate]);

  return null;
}
import * as React from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = React.useState(true);
  const [authed, setAuthed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;

    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setAuthed(!!data.session);
      setChecking(false);
    };

    run();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
      setChecking(false);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (checking) return null; // or spinner
  if (!authed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

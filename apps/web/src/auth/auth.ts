import { supabase } from "../lib/supabaseClient";

export type Role = "superuser" | "user";

export type SessionUser = {
  id: string;
  email: string;
  role: Role;
  username?: string;
};

// The shape AppLayout expects
export type AppSession = {
  user: { email: string };
  role: Role;
};

// -----------------------------
// Core: fetch current user + role
// -----------------------------
export async function getSupabaseUser(): Promise<SessionUser | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const email = user.email ?? "";
  const id = user.id;

  // Pull role from profiles
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role, username, email")
    .eq("id", id)
    .maybeSingle();

  // If profile doesn't exist yet, create it with default role=user
  if (!profile && !pErr) {
    await supabase.from("profiles").insert({
      id,
      email,
      username: email ? email.split("@")[0] : "",
      role: "user",
    });
  }

  const roleRaw = (profile?.role ?? "user") as string;
  const role: Role = roleRaw === "superuser" ? "superuser" : "user";

  return {
    id,
    email,
    role,
    username: profile?.username ?? undefined,
  };
}

// -----------------------------
// Compatibility for AppLayout
// -----------------------------
export async function getSession(): Promise<AppSession | null> {
  const u = await getSupabaseUser();
  if (!u) return null;

  return {
    user: { email: u.email },
    role: u.role,
  };
}

export function onAuthChange(cb: (session: AppSession | null) => void) {
  return supabase.auth.onAuthStateChange(async (_event, _session) => {
    // After any auth change, re-fetch profile/role to keep it accurate
    const s = await getSession();
    cb(s);
  });
}

// -----------------------------
// Auth actions
// -----------------------------
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw new Error(error.message);
}
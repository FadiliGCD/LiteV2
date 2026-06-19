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
// Small cache (reduces slow loads)
// -----------------------------
const CACHE_KEY = "lite-v2.appSession.cache.v1";
const CACHE_TTL_MS = 60_000; // 60 seconds

function readCache(): AppSession | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; value: AppSession };
    if (!parsed?.ts || !parsed?.value) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache(value: AppSession) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), value }));
  } catch {
    // ignore
  }
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

// -----------------------------
// Core: fetch current user + role
// (uses getSession first, then reads profiles)
// -----------------------------
export async function getSupabaseUser(): Promise<SessionUser | null> {
  // Fast path: getSession is local + quick
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;
  if (!user) return null;

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
    // Don't block UX too much; still await so next calls find it
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
// (cached for speed)
// -----------------------------
export async function getSession(): Promise<AppSession | null> {
  const cached = readCache();
  if (cached) return cached;

  const u = await getSupabaseUser();
  if (!u) return null;

  const s: AppSession = {
    user: { email: u.email },
    role: u.role,
  };

  writeCache(s);
  return s;
}

export function onAuthChange(cb: (session: AppSession | null) => void) {
  return supabase.auth.onAuthStateChange((_event, authSession) => {
    // Logout: respond immediately without another Supabase request
    if (!authSession?.user) {
      cb(null);
      return;
    }

    // Run profile/session lookup after the auth callback has completed
    window.setTimeout(() => {
      void getSession()
        .then((session) => cb(session))
        .catch(() => cb(null));
    }, 0);
  });
}

// -----------------------------
// Auth actions
// -----------------------------
export async function signInWithEmail(email: string, password: string) {
  clearCache();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function signUpWithEmail(email: string, password: string) {
  clearCache();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function signOut() {
  clearCache();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw new Error(error.message);
}
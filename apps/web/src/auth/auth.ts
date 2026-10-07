import { supabase } from "../lib/supabaseClient";

export type Role = string;

export type SessionUser = {
  id: string;
  email: string;
  role: Role;
  username?: string;
  isDisabled?: boolean;
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
// Internal logging helper
// -----------------------------
async function logAppEvent(
  action: string,
  module = "auth",
  tableName = "app",
  notes?: string
) {
  try {
    await supabase.rpc("log_app_event", {
      p_action: action,
      p_module: module,
      p_table_name: tableName,
      p_notes: notes ?? null,
    });
  } catch {
    // Never block login/logout because logging failed
  }
}

// -----------------------------
// Disabled account helper
// -----------------------------
async function blockIfDisabled(userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_disabled")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (profile?.is_disabled) {
    clearCache();

    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }

    throw new Error("This account is disabled. Contact the superuser.");
  }
}

// -----------------------------
// Core: fetch current user + role
// -----------------------------
export async function getSupabaseUser(): Promise<SessionUser | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;
  if (!user) return null;

  const email = user.email ?? "";
  const id = user.id;

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role, username, email, is_disabled")
    .eq("id", id)
    .maybeSingle();

  if (pErr) {
    throw new Error(pErr.message);
  }

  // If profile doesn't exist yet, create it with default role=user
  if (!profile) {
    await supabase.from("profiles").insert({
      id,
      email,
      username: email ? email.split("@")[0] : "",
      role: "user",
      is_disabled: false,
    });

    return {
      id,
      email,
      role: "user",
      username: email ? email.split("@")[0] : undefined,
      isDisabled: false,
    };
  }

  if (profile.is_disabled) {
    clearCache();

    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }

    return null;
  }

  const role: Role = String(profile.role ?? "user");

  return {
    id,
    email,
    role,
    username: profile.username ?? undefined,
    isDisabled: Boolean(profile.is_disabled),
  };
}

// -----------------------------
// Compatibility for AppLayout
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
    if (!authSession?.user) {
      clearCache();
      cb(null);
      return;
    }

    window.setTimeout(() => {
      void getSession()
        .then((session) => cb(session))
        .catch(() => cb(null));
    }, 0);
  });
}

// -----------------------------
// Session freshness guard
// -----------------------------
export async function ensureFreshSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  if (!session) {
    clearCache();
    throw new Error(
      "Votre session a expiré. Reconnectez-vous, puis réessayez."
    );
  }

  await blockIfDisabled(session.user.id);

  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
  const expiresSoon =
    expiresAtMs > 0 && Date.now() > expiresAtMs - 2 * 60 * 1000;

  if (!expiresSoon) {
    return session;
  }

  const {
    data: { session: refreshedSession },
    error: refreshError,
  } = await supabase.auth.refreshSession();

  if (refreshError || !refreshedSession) {
    clearCache();
    throw new Error(
      "Votre session a expiré. Reconnectez-vous, puis réessayez."
    );
  }

  await blockIfDisabled(refreshedSession.user.id);

  return refreshedSession;
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

  const userId = data.user?.id;

  if (userId) {
    await blockIfDisabled(userId);
  }

  await logAppEvent("LOGIN", "auth", "auth.users", "User signed in");

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
  await logAppEvent("LOGOUT", "auth", "auth.users", "User signed out");

  clearCache();

  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) throw new Error(error.message);

  await logAppEvent(
    "PASSWORD_RESET_REQUEST",
    "auth",
    "auth.users",
    `Password reset requested for ${email}`
  );
}
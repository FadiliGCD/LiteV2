import * as React from "react";
import { supabase } from "../lib/supabaseClient";

const CURRENT_APP_VERSION = "2.12.3";
const VERSION_STORAGE_KEY = "lite-v2.current-version";
const CHECK_INTERVAL_MS = 60_000; // 1 minute

type RemoteVersion = {
  version?: string;
  critical?: boolean;
  message?: string;
};

async function forceLogoutForUpdate(message?: string) {
  try {
    sessionStorage.setItem(
      "lite-v2.update-message",
      message || "Lite V2 was updated. Please log in again."
    );
  } catch {
    // ignore
  }

  try {
    localStorage.removeItem("lite-v2.appSession.cache.v1");
  } catch {
    // ignore
  }

  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }

  window.location.replace("/login?update=required");
}

export default function AppVersionGuard() {
  const checkingRef = React.useRef(false);

  const checkVersion = React.useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;

    try {
      const response = await fetch(`/app-version.json?t=${Date.now()}`, {
        cache: "no-store",
      });

      if (!response.ok) return;

      const remote = (await response.json()) as RemoteVersion;
      const remoteVersion = String(remote.version ?? "").trim();

      if (!remoteVersion) return;

      const savedVersion = localStorage.getItem(VERSION_STORAGE_KEY);

      if (!savedVersion) {
        localStorage.setItem(VERSION_STORAGE_KEY, CURRENT_APP_VERSION);
      }

      const versionChanged = remoteVersion !== CURRENT_APP_VERSION;

      if (versionChanged && remote.critical) {
        await forceLogoutForUpdate(remote.message);
        return;
      }

      localStorage.setItem(VERSION_STORAGE_KEY, remoteVersion);
    } catch {
      // Never crash the app because version check failed
    } finally {
      checkingRef.current = false;
    }
  }, []);

  React.useEffect(() => {
    void checkVersion();

    const interval = window.setInterval(() => {
      void checkVersion();
    }, CHECK_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkVersion();
      }
    };

    window.addEventListener("focus", checkVersion);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checkVersion);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [checkVersion]);

  return null;
}
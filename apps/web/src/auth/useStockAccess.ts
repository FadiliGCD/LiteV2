import * as React from "react";
import { supabase } from "../lib/supabaseClient";

export type StockPermission =
  | "stock_dashboard"
  | "entree_view"
  | "entree_create"
  | "entree_update"
  | "entree_delete"
  | "entree_import"
  | "entree_export"
  | "entree_send_parking"
  | "parking_view"
  | "parking_update"
  | "parking_delete"
  | "parking_send_sortie"
  | "sortie_view"
  | "sortie_create"
  | "sortie_update"
  | "sortie_delete"
  | "rapport_charge_view"
  | "rapport_charge_print";

type ProfileRow = {
  role: string | null;
  stock_access: string[] | null;
};

export function hasStockPermission(
  profile: ProfileRow | null,
  permission: StockPermission
) {
  if (!profile) return false;

  const role = String(profile.role ?? "").toLowerCase();

  if (role === "superuser" || role === "admin") {
    return true;
  }

  const access = Array.isArray(profile.stock_access)
    ? profile.stock_access
    : [];

  return access.includes(permission);
}

export default function useStockAccess() {
  const [profile, setProfile] = React.useState<ProfileRow | null>(null);
  const [loadingAccess, setLoadingAccess] = React.useState(true);

  const loadAccess = React.useCallback(async () => {
    setLoadingAccess(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role, stock_access")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw new Error(error.message);

      setProfile((data ?? null) as ProfileRow | null);
    } catch {
      setProfile(null);
    } finally {
      setLoadingAccess(false);
    }
  }, []);

  React.useEffect(() => {
    loadAccess();
  }, [loadAccess]);

  const can = React.useCallback(
    (permission: StockPermission) => {
      return hasStockPermission(profile, permission);
    },
    [profile]
  );

  const role = String(profile?.role ?? "").toLowerCase();

  return {
    profile,
    role,
    loadingAccess,
    reloadAccess: loadAccess,
    can,
    isAdminStock: role === "superuser" || role === "admin",
  };
}
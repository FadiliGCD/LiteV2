import { createClient } from "@supabase/supabase-js";

declare const process: {
  env: Record<string, string | undefined>;
};

type CreateUserBody = {
  email?: string;
  password?: string;
  username?: string;
  role?: string;
  module_access?: unknown;
  hr_access?: unknown;
  stock_access?: unknown;
  can_manage_hr?: unknown;
  can_manage_employees?: unknown;
};

const ROLE_OPTIONS = [
  "user",
  "admin",
  "stock_entree_add",
  "stock_emballage",
  "hr_pointage",
];

const MODULE_OPTIONS = [
  "reception",
  "production",
  "stock",
  "accounting",
  "hr",
];

const HR_OPTIONS = [
  "main_doeuvre",
  "pointage",
  "reductions_remunerations",
  "paie_declarations",
];

const STOCK_OPTIONS = [
  "stock_dashboard",
  "entree_view",
  "entree_create",
  "entree_update",
  "entree_delete",
  "entree_import",
  "entree_export",
  "entree_send_parking",
  "parking_view",
  "parking_update",
  "parking_delete",
  "parking_send_sortie",
  "sortie_view",
  "sortie_create",
  "sortie_update",
  "sortie_delete",
  "rapport_charge_view",
  "rapport_charge_print",
];

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function sanitizeArray(value: unknown, allowed: string[]) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item ?? "").trim())
    .filter((item, index, array) => allowed.includes(item) && array.indexOf(item) === index);
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing server environment variable: ${name}`);
  }
  return value;
}

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
      const supabaseUrl = requireEnv("SUPABASE_URL");
      const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
      const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

      const authorization = request.headers.get("authorization") ?? "";
      const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

      if (!accessToken) {
        return jsonResponse({ error: "Missing authorization token" }, 401);
      }

      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const {
        data: { user: actor },
        error: actorError,
      } = await userClient.auth.getUser(accessToken);

      if (actorError || !actor) {
        return jsonResponse({ error: "Invalid or expired session" }, 401);
      }

      const { data: actorProfile, error: actorProfileError } = await adminClient
        .from("profiles")
        .select("role, is_disabled")
        .eq("id", actor.id)
        .maybeSingle();

      if (actorProfileError) {
        return jsonResponse({ error: actorProfileError.message }, 500);
      }

      if (actorProfile?.role !== "superuser" || actorProfile?.is_disabled) {
        return jsonResponse({ error: "Only active superuser can create users" }, 403);
      }

      const body = (await request.json()) as CreateUserBody;

      const email = normalizeEmail(body.email);
      const password = String(body.password ?? "");
      const username = normalizeText(body.username) || email.split("@")[0] || "";
      const role = normalizeText(body.role || "user").toLowerCase();

      if (!email || !email.includes("@")) {
        return jsonResponse({ error: "Valid email is required" }, 400);
      }

      if (!password || password.length < 8) {
        return jsonResponse({ error: "Password must contain at least 8 characters" }, 400);
      }

      if (role === "superuser") {
        return jsonResponse({ error: "Cannot create another superuser" }, 400);
      }

      if (!ROLE_OPTIONS.includes(role)) {
        return jsonResponse({ error: "Role not allowed" }, 400);
      }

      const profileRow = {
        email,
        username,
        role,
        module_access: sanitizeArray(body.module_access, MODULE_OPTIONS),
        hr_access: sanitizeArray(body.hr_access, HR_OPTIONS),
        stock_access: sanitizeArray(body.stock_access, STOCK_OPTIONS),
        can_manage_hr: Boolean(body.can_manage_hr),
        can_manage_employees: Boolean(body.can_manage_employees),
        is_disabled: false,
      };

      const { data: createdAuthUser, error: createAuthError } =
        await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            username,
          },
        });

      if (createAuthError || !createdAuthUser.user) {
        return jsonResponse(
          { error: createAuthError?.message ?? "Unable to create auth user" },
          400
        );
      }

      const userId = createdAuthUser.user.id;

      const { error: profileCreateError } = await adminClient.from("profiles").upsert(
        {
          id: userId,
          ...profileRow,
        },
        { onConflict: "id" }
      );

      if (profileCreateError) {
        await adminClient.auth.admin.deleteUser(userId).catch(() => undefined);

        return jsonResponse({ error: profileCreateError.message }, 500);
      }

      await adminClient.from("app_audit_logs").insert({
        actor_user_id: actor.id,
        actor_email: actor.email ?? null,
        actor_role: actorProfile.role,
        action: "CREATE_USER",
        module: "settings",
        table_name: "profiles",
        row_id: userId,
        old_data: null,
        new_data: {
          id: userId,
          ...profileRow,
        },
        source: "vercel_function",
        notes: `Created user ${email}`,
      });

      return jsonResponse({
        user: {
          id: userId,
          email,
          username,
          role,
        },
      });
    } catch (error: any) {
      return jsonResponse(
        { error: error?.message ?? "Unexpected error while creating user" },
        500
      );
    }
  },
};

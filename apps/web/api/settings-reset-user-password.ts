import { createClient } from "@supabase/supabase-js";

declare const process: {
  env: Record<string, string | undefined>;
};

type ResetPasswordBody = {
  user_id?: string;
  password?: string;
};

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
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
        return jsonResponse(
          { error: "Only active superuser can reset user passwords" },
          403
        );
      }

      const body = (await request.json()) as ResetPasswordBody;

      const userId = String(body.user_id ?? "").trim();
      const password = String(body.password ?? "");

      if (!userId) {
        return jsonResponse({ error: "User ID is required" }, 400);
      }

      if (!password || password.length < 8) {
        return jsonResponse(
          { error: "Password must contain at least 8 characters" },
          400
        );
      }

      const { data: targetProfile, error: targetProfileError } =
        await adminClient
          .from("profiles")
          .select("role, email, username")
          .eq("id", userId)
          .maybeSingle();

      if (targetProfileError) {
        return jsonResponse({ error: targetProfileError.message }, 500);
      }

      if (!targetProfile) {
        return jsonResponse({ error: "Target profile not found" }, 404);
      }

      if (targetProfile.role === "superuser") {
        return jsonResponse(
          { error: "Superuser password cannot be reset from Settings" },
          400
        );
      }

      const { error: updatePasswordError } =
        await adminClient.auth.admin.updateUserById(userId, {
          password,
        });

      if (updatePasswordError) {
        return jsonResponse({ error: updatePasswordError.message }, 400);
      }

      const { error: profileUpdateError } = await adminClient
        .from("profiles")
        .update({ must_change_password: true })
        .eq("id", userId);

      if (profileUpdateError) {
        return jsonResponse({ error: profileUpdateError.message }, 500);
      }

      await adminClient.from("app_audit_logs").insert({
        actor_user_id: actor.id,
        actor_email: actor.email ?? null,
        actor_role: actorProfile.role,
        action: "SETTINGS_RESET_PASSWORD",
        module: "settings",
        table_name: "auth.users",
        row_id: userId,
        old_data: null,
        new_data: {
          user_id: userId,
          email: targetProfile.email ?? null,
          username: targetProfile.username ?? null,
          password_changed: true,
        },
        source: "vercel_function",
        notes: `Reset password for ${
          targetProfile.email || targetProfile.username || userId
        }`,
      });

      return jsonResponse({
        ok: true,
        user: {
          id: userId,
          email: targetProfile.email ?? null,
          username: targetProfile.username ?? null,
        },
      });
    } catch (error: any) {
      return jsonResponse(
        { error: error?.message ?? "Unexpected error while resetting password" },
        500
      );
    }
  },
};

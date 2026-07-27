import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type PasswordChangeBody = {
  password?: string;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function hasStrongPassword(password: string) {
  return (
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password)
  );
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, ctx) => {
    if (request.method !== "POST") {
      return jsonError("Method not allowed", 405);
    }

    const userId = ctx.userClaims?.id;
    if (!userId) {
      return jsonError("Unauthorized", 401);
    }

    const body = (await request.json().catch(() => null)) as PasswordChangeBody | null;
    const password = body?.password;
    if (!password || !hasStrongPassword(password)) {
      return jsonError("Use at least 12 characters with uppercase, lowercase, and a number", 400);
    }

    const { data: profile, error: profileError } = await ctx.supabaseAdmin
      .from("profiles")
      .select("id, is_active, must_change_password")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile || !profile.is_active) {
      return jsonError("Account access is not available", 403);
    }
    if (!profile.must_change_password) {
      return jsonError("This account does not require a password change", 409);
    }

    const { error: passwordError } = await ctx.supabase.auth.updateUser({ password });
    if (passwordError) {
      return jsonError(passwordError.message, 400);
    }

    const { data: updatedProfile, error: updateError } = await ctx.supabaseAdmin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", userId)
      .eq("is_active", true)
      .eq("must_change_password", true)
      .select("id")
      .maybeSingle();

    if (updateError || !updatedProfile) {
      return jsonError("Password was changed, but account access could not be activated. Contact support.", 500);
    }

    return Response.json({ completed: true });
  }),
};

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type Role = "RESIDENT" | "GUARD" | "ADMIN";

type CreateUserBody = {
  fullName?: string;
  role?: Role;
  email?: string;
  phone?: string;
  flatId?: string;
  occupancyType?: "OWNER" | "TENANT";
};

const TEMP_PASSWORD_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const TEMP_PASSWORD_LENGTH = 12;

function generateTempPassword() {
  const bytes = new Uint8Array(TEMP_PASSWORD_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => TEMP_PASSWORD_CHARSET[b % TEMP_PASSWORD_CHARSET.length]).join("");
}

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

// Admin-only: provisions a login-capable account (auth user + profile row) for
// a resident/guard/admin, scoped to the caller's own society. Returns a temp
// password shown once in the UI; the user is forced to change it on first login
// (profiles.must_change_password), per AGENTS.md's account-provisioning model.
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const callerId = ctx.userClaims?.id;
    if (!callerId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // RLS-scoped self-read confirms the caller's real role/society server-side —
    // never trust a client-supplied role or societyId.
    const { data: callerProfile, error: callerError } = await ctx.supabase
      .from("profiles")
      .select("role, society_id")
      .eq("id", callerId)
      .single();

    if (callerError || !callerProfile || callerProfile.role !== "ADMIN") {
      return Response.json({ error: "Only society admins can create accounts" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as CreateUserBody | null;
    if (!body) return badRequest("Invalid request body");

    const fullName = body.fullName?.trim();
    const role = body.role;
    const email = body.email?.trim().toLowerCase();
    const phone = body.phone?.trim() || null;
    const flatId = body.flatId || null;
    const occupancyType = body.occupancyType ?? null;

    if (!fullName || fullName.length < 2) return badRequest("Full name is required");
    if (!role || !["RESIDENT", "GUARD", "ADMIN"].includes(role)) return badRequest("A valid role is required");
    if (!email || !/\S+@\S+\.\S+/.test(email)) return badRequest("A valid email is required");
    if (role === "RESIDENT" && !flatId) return badRequest("Residents require a flat");

    const societyId = callerProfile.society_id;

    if (flatId) {
      const { data: flat, error: flatError } = await ctx.supabaseAdmin
        .from("flats")
        .select("id, society_id")
        .eq("id", flatId)
        .single();
      if (flatError || !flat || flat.society_id !== societyId) {
        return badRequest("Flat does not belong to your society");
      }
    }

    const tempPassword = generateTempPassword();

    const { data: created, error: createError } = await ctx.supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (createError || !created?.user) {
      return badRequest(createError?.message ?? "Could not create the account");
    }

    const { error: profileError } = await ctx.supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      society_id: societyId,
      role,
      flat_id: flatId,
      occupancy_type: occupancyType,
      full_name: fullName,
      phone,
      must_change_password: true,
    });

    if (profileError) {
      // compensate — don't leave an orphaned auth user with no profile
      await ctx.supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return badRequest(profileError.message);
    }

    await ctx.supabaseAdmin.from("audit_events").insert({
      society_id: societyId,
      actor_id: callerId,
      action: `Added ${fullName} (${role.toLowerCase()})`,
      detail: email,
    });

    return Response.json({ userId: created.user.id, email, tempPassword });
  }),
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request with a signed-in admin's access token:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-user-with-temp-password' \
    --header 'Authorization: Bearer <admin-access-token>' \
    --header 'Content-Type: application/json' \
    --data '{"fullName":"Asha Rao","role":"RESIDENT","email":"asha@example.com","flatId":"<flat-uuid>"}'

*/

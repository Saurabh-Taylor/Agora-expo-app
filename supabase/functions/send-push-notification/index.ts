// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type SendPushBody = {
  profileIds?: string[];
  flatId?: string;
  notifyAllResidents?: boolean;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

// Generic push sender reused across every notification trigger (visitor
// requests now; notices/complaint-status changes in later phases). Callers
// pass either explicit profileIds or a flatId (resolved server-side to that
// flat's residents); every target is re-checked against the caller's own
// society_id before a token is looked up — never trust client-supplied ids.
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const callerId = ctx.userClaims?.id;
    if (!callerId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: callerProfile, error: callerError } = await ctx.supabase
      .from("profiles")
      .select("society_id")
      .eq("id", callerId)
      .single();

    if (callerError || !callerProfile) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const societyId = callerProfile.society_id;

    const body = (await req.json().catch(() => null)) as SendPushBody | null;
    if (!body) return badRequest("Invalid request body");

    const title = body.title?.trim();
    const message = body.body?.trim();
    if (!title || !message) return badRequest("title and body are required");

    let profileIds = (body.profileIds ?? []).filter(Boolean);

    if (body.flatId) {
      const { data: flat, error: flatError } = await ctx.supabaseAdmin
        .from("flats")
        .select("id, society_id")
        .eq("id", body.flatId)
        .single();
      if (flatError || !flat || flat.society_id !== societyId) {
        return badRequest("Flat does not belong to your society");
      }

      const { data: residents, error: residentsError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("flat_id", body.flatId)
        .eq("role", "RESIDENT");
      if (residentsError) return badRequest(residentsError.message);
      profileIds = profileIds.concat((residents ?? []).map((r) => r.id));
    }

    if (body.notifyAllResidents) {
      const { data: residents, error: residentsError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("society_id", societyId)
        .eq("role", "RESIDENT");
      if (residentsError) return badRequest(residentsError.message);
      profileIds = profileIds.concat((residents ?? []).map((r) => r.id));
    }

    profileIds = [...new Set(profileIds)];
    if (profileIds.length === 0) return Response.json({ sent: 0 });

    // Re-scope every target to the caller's own society before trusting it.
    const { data: recipients, error: recipientsError } = await ctx.supabaseAdmin
      .from("profiles")
      .select("id")
      .in("id", profileIds)
      .eq("society_id", societyId);
    if (recipientsError) return badRequest(recipientsError.message);

    const allowedIds = (recipients ?? []).map((r) => r.id);
    if (allowedIds.length === 0) return Response.json({ sent: 0 });

    const { data: tokens, error: tokensError } = await ctx.supabaseAdmin
      .from("push_tokens")
      .select("token")
      .in("profile_id", allowedIds);
    if (tokensError) return badRequest(tokensError.message);
    if (!tokens || tokens.length === 0) return Response.json({ sent: 0 });

    const messages = tokens.map((t) => ({
      to: t.token,
      title,
      body: message,
      data: body.data ?? {},
    }));

    const pushResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(messages),
    });

    if (!pushResponse.ok) {
      return Response.json({ error: "Expo push service error" }, { status: 502 });
    }

    return Response.json({ sent: messages.length });
  }),
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request with a signed-in user's access token:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send-push-notification' \
    --header 'Authorization: Bearer <access-token>' \
    --header 'Content-Type: application/json' \
    --data '{"flatId":"<flat-uuid>","title":"Visitor at the gate","body":"Ravi Kumar is waiting at Gate 1","data":{"type":"VISITOR_REQUEST","requestId":"<request-uuid>"}}'

*/

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type Role = "RESIDENT" | "GUARD" | "ADMIN";
type NotificationType = "VISITOR_REQUEST" | "VISITOR_DECISION" | "NOTICE" | "BOOKING_DECISION";

type SendPushBody = {
  data?: {
    type?: NotificationType;
    requestId?: string;
    noticeId?: string;
    bookingId?: string;
  };
};

type NotificationAudience = {
  profileIds: string[];
  title: string;
  body: string;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return jsonError("Method not allowed", 405);

    const callerId = ctx.userClaims?.id;
    if (!callerId) return jsonError("Unauthorized", 401);

    const { data: caller, error: callerError } = await ctx.supabase
      .from("profiles")
      .select("id, role, society_id, flat_id")
      .eq("id", callerId)
      .single();

    if (callerError || !caller) return jsonError("Unauthorized", 401);

    const body = (await req.json().catch(() => null)) as SendPushBody | null;
    const type = body?.data?.type;
    if (!type) return jsonError("A supported notification type is required", 400);

    const audienceResult = await resolveAudience(type, body.data ?? {}, caller as {
      id: string;
      role: Role;
      society_id: string;
      flat_id: string | null;
    }, ctx.supabaseAdmin);

    if (audienceResult instanceof Response) return audienceResult;
    if (audienceResult.profileIds.length === 0) return Response.json({ sent: 0 });

    const { data: recipients, error: recipientsError } = await ctx.supabaseAdmin
      .from("profiles")
      .select("id")
      .in("id", audienceResult.profileIds)
      .eq("society_id", caller.society_id);
    if (recipientsError) return jsonError("Could not authorize notification recipients", 500);

    const allowedIds = (recipients ?? []).map((profile) => profile.id);
    if (allowedIds.length === 0) return Response.json({ sent: 0 });

    const { data: tokens, error: tokensError } = await ctx.supabaseAdmin
      .from("push_tokens")
      .select("token")
      .eq("society_id", caller.society_id)
      .in("profile_id", allowedIds);
    if (tokensError) return jsonError("Could not load notification tokens", 500);
    if (!tokens?.length) return Response.json({ sent: 0 });

    const messages = tokens.map(({ token }) => ({
      to: token,
      title: audienceResult.title,
      body: audienceResult.body,
      data: body.data,
    }));

    const pushResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(messages),
    });

    if (!pushResponse.ok) return jsonError("Expo push service error", 502);
    return Response.json({ sent: messages.length });
  }),
};

async function resolveAudience(
  type: NotificationType,
  data: NonNullable<SendPushBody["data"]>,
  caller: { id: string; role: Role; society_id: string; flat_id: string | null },
  admin: any,
): Promise<NotificationAudience | Response> {
  if (type === "VISITOR_REQUEST") {
    if (caller.role !== "GUARD" || !data.requestId) return jsonError("Guard visitor request required", 403);

    const { data: request, error } = await admin
      .from("visitor_requests")
      .select("id, society_id, flat_id, raised_by, status, visitor:visitors(name, category)")
      .eq("id", data.requestId)
      .eq("society_id", caller.society_id)
      .single();
    if (error || !request || request.raised_by !== caller.id || request.status !== "PENDING") {
      return jsonError("Visitor request is not available", 403);
    }

    const { data: residents } = await admin
      .from("profiles")
      .select("id")
      .eq("society_id", caller.society_id)
      .eq("flat_id", request.flat_id)
      .eq("role", "RESIDENT");

    return {
      profileIds: (residents ?? []).map((profile: { id: string }) => profile.id),
      title: `${request.visitor?.name ?? "A visitor"} is at the gate`,
      body: `${titleCase(request.visitor?.category ?? "Guest")} - Tap to respond`,
    };
  }

  if (type === "VISITOR_DECISION") {
    if (caller.role !== "RESIDENT" || !caller.flat_id || !data.requestId) {
      return jsonError("Resident visitor decision required", 403);
    }

    const { data: request, error } = await admin
      .from("visitor_requests")
      .select("id, society_id, flat_id, raised_by, decision_by, status, visitor:visitors(name)")
      .eq("id", data.requestId)
      .eq("society_id", caller.society_id)
      .single();
    if (
      error ||
      !request ||
      request.flat_id !== caller.flat_id ||
      request.decision_by !== caller.id ||
      !["APPROVED", "REJECTED", "LEFT_AT_GATE"].includes(request.status)
    ) {
      return jsonError("Visitor decision is not available", 403);
    }

    const decision =
      request.status === "APPROVED" ? "approved" : request.status === "REJECTED" ? "denied" : "left at the gate";
    return {
      profileIds: request.raised_by ? [request.raised_by] : [],
      title: `${request.visitor?.name ?? "Visitor"} - ${decision}`,
      body: `The resident marked this request as ${decision}.`,
    };
  }

  if (type === "NOTICE") {
    if (caller.role !== "ADMIN" || !data.noticeId) return jsonError("Admin notice required", 403);

    const { data: notice, error } = await admin
      .from("notices")
      .select("id, society_id, title, state, created_by")
      .eq("id", data.noticeId)
      .eq("society_id", caller.society_id)
      .single();
    if (error || !notice || notice.created_by !== caller.id || notice.state !== "PUBLISHED") {
      return jsonError("Notice is not available", 403);
    }

    const { data: residents } = await admin
      .from("profiles")
      .select("id")
      .eq("society_id", caller.society_id)
      .eq("role", "RESIDENT");

    return {
      profileIds: (residents ?? []).map((profile: { id: string }) => profile.id),
      title: "New notice published",
      body: notice.title,
    };
  }

  if (type === "BOOKING_DECISION") {
    if (caller.role !== "ADMIN" || !data.bookingId) return jsonError("Admin booking decision required", 403);

    const { data: booking, error } = await admin
      .from("amenity_bookings")
      .select("id, society_id, booked_by, status, slot_start, amenity:amenities(name)")
      .eq("id", data.bookingId)
      .eq("society_id", caller.society_id)
      .single();
    if (error || !booking || !["CONFIRMED", "CANCELLED"].includes(booking.status)) {
      return jsonError("Booking decision is not available", 403);
    }

    const decision = booking.status === "CONFIRMED" ? "confirmed" : "declined";
    return {
      profileIds: [booking.booked_by],
      title: `${booking.amenity?.name ?? "Amenity"} booking ${decision}`,
      body: `Your requested slot was ${decision}.`,
    };
  }

  return jsonError("Unsupported notification type", 400);
}

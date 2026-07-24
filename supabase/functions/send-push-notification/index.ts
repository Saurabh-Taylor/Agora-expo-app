import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type Role = "RESIDENT" | "GUARD" | "ADMIN";
type NotificationType = "VISITOR_REQUEST" | "VISITOR_DECISION" | "NOTICE" | "COMPLAINT_STATUS" | "BOOKING_DECISION" | "BOOKING_MAINTENANCE_CANCELLED" | "MAINTENANCE_REMINDER" | "TASK_ASSIGNMENT";

type SendPushBody = {
  data?: {
    type?: NotificationType;
    requestId?: string;
    noticeId?: string;
    complaintId?: string;
    bookingId?: string;
    dueId?: string;
    taskId?: string;
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

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return jsonError("Method not allowed", 405);

    const callerId = ctx.userClaims?.id;
    if (!callerId) return jsonError("Unauthorized", 401);

    const { data: caller, error: callerError } = await ctx.supabase
      .from("profiles")
      .select("id, role, society_id, flat_id, is_active")
      .eq("id", callerId)
      .single();

    if (callerError || !caller || !caller.is_active) return jsonError("Unauthorized", 401);

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

    await processPendingPushReceipts(caller.society_id, ctx.supabaseAdmin);

    const { data: recipients, error: recipientsError } = await ctx.supabaseAdmin
      .from("profiles")
      .select("id")
      .in("id", audienceResult.profileIds)
      .eq("society_id", caller.society_id)
      .eq("is_active", true);
    if (recipientsError) return jsonError("Could not authorize notification recipients", 500);

    const allowedIds = (recipients ?? []).map((profile) => profile.id);
    if (allowedIds.length === 0) return Response.json({ sent: 0 });

    const { data: tokens, error: tokensError } = await ctx.supabaseAdmin
      .from("push_tokens")
      .select("id, token")
      .eq("society_id", caller.society_id)
      .in("profile_id", allowedIds);
    if (tokensError) return jsonError("Could not load notification tokens", 500);
    if (!tokens?.length) return Response.json({ sent: 0 });

    const messages = tokens.map(({ token }) => ({
      to: token,
      title: audienceResult.title,
      body: audienceResult.body,
      data: body.data,
      priority: "high",
    }));

    let acceptedCount = 0;
    let trackedCount = 0;
    const invalidTokens: string[] = [];
    for (let offset = 0; offset < messages.length; offset += EXPO_PUSH_CHUNK_SIZE) {
      const messageChunk = messages.slice(offset, offset + EXPO_PUSH_CHUNK_SIZE);
      const tickets = await sendExpoPushChunk(messageChunk);
      if (tickets instanceof Response) return tickets;

      tickets.forEach((ticket, index) => {
        if (ticket.status === "ok") acceptedCount += 1;
        if (ticket.details?.error === "DeviceNotRegistered") {
          invalidTokens.push(messageChunk[index].to);
        }
      });

      const receiptRows = tickets.flatMap((ticket, index) => {
        if (!ticket.id) return [];
        return [{
          ticket_id: ticket.id,
          society_id: caller.society_id,
          push_token_id: tokens[offset + index].id,
          notification_type: type,
          status: "PENDING",
        }];
      });
      if (receiptRows.length > 0) {
        const { error: receiptError } = await ctx.supabaseAdmin
          .from("push_delivery_receipts")
          .insert(receiptRows);
        if (!receiptError) trackedCount += receiptRows.length;
      }
    }

    if (invalidTokens.length > 0) {
      await ctx.supabaseAdmin
        .from("push_tokens")
        .delete()
        .eq("society_id", caller.society_id)
        .in("token", invalidTokens);
    }

    return Response.json({ sent: acceptedCount, rejected: messages.length - acceptedCount, tracked: trackedCount });
  }),
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: SendPushBody["data"];
  priority: "high";
};

type ExpoPushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

const EXPO_PUSH_CHUNK_SIZE = 100;
const EXPO_PUSH_MAX_ATTEMPTS = 3;
const EXPO_PUSH_RETRY_BASE_MS = 500;
const EXPO_PUSH_RECEIPT_BATCH_SIZE = 1000;
const EXPO_PUSH_RECEIPT_DELAY_MS = 15 * 60 * 1000;

async function processPendingPushReceipts(societyId: string, admin: SupabaseClient) {
  const receiptCutoff = new Date(Date.now() - EXPO_PUSH_RECEIPT_DELAY_MS).toISOString();
  const { data: pendingReceipts, error } = await admin
    .from("push_delivery_receipts")
    .select("ticket_id, push_token_id")
    .eq("society_id", societyId)
    .eq("status", "PENDING")
    .lte("sent_at", receiptCutoff)
    .limit(EXPO_PUSH_RECEIPT_BATCH_SIZE);
  if (error || !pendingReceipts?.length) return;

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ ids: pendingReceipts.map((receipt: { ticket_id: string }) => receipt.ticket_id) }),
    });
    if (!response.ok) return;

    const payload = (await response.json()) as { data?: Record<string, ExpoPushTicket> };
    const deliveredIds: string[] = [];
    const errorGroups = new Map<string, string[]>();
    const invalidPushTokenIds: string[] = [];

    pendingReceipts.forEach((pending: { ticket_id: string; push_token_id: string | null }) => {
      const receipt = payload.data?.[pending.ticket_id];
      if (!receipt) return;
      if (receipt.status === "ok") {
        deliveredIds.push(pending.ticket_id);
        return;
      }

      const errorCode = receipt.details?.error ?? "UNKNOWN";
      errorGroups.set(errorCode, [...(errorGroups.get(errorCode) ?? []), pending.ticket_id]);
      if (errorCode === "DeviceNotRegistered" && pending.push_token_id) {
        invalidPushTokenIds.push(pending.push_token_id);
      }
    });

    const checkedAt = new Date().toISOString();
    if (deliveredIds.length > 0) {
      await admin
        .from("push_delivery_receipts")
        .update({ status: "DELIVERED", checked_at: checkedAt, error_code: null })
        .eq("society_id", societyId)
        .in("ticket_id", deliveredIds);
    }
    for (const [errorCode, ticketIds] of errorGroups) {
      await admin
        .from("push_delivery_receipts")
        .update({ status: "ERROR", checked_at: checkedAt, error_code: errorCode })
        .eq("society_id", societyId)
        .in("ticket_id", ticketIds);
    }
    if (invalidPushTokenIds.length > 0) {
      await admin
        .from("push_tokens")
        .delete()
        .eq("society_id", societyId)
        .in("id", invalidPushTokenIds);
    }
  } catch {
    // Delivery state remains pending and will be checked by a later invocation.
  }
}

async function sendExpoPushChunk(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[] | Response> {
  for (let attempt = 0; attempt < EXPO_PUSH_MAX_ATTEMPTS; attempt += 1) {
    try {
      const pushResponse = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(messages),
      });

      if (pushResponse.ok) {
        const payload = (await pushResponse.json()) as { data?: ExpoPushTicket[] | ExpoPushTicket };
        const tickets = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
        if (tickets.length !== messages.length) return jsonError("Expo push response was incomplete", 502);
        return tickets;
      }

      const isTransient = pushResponse.status === 429 || pushResponse.status >= 500;
      if (!isTransient) return jsonError("Expo rejected the push request", 502);
    } catch {
      if (attempt === EXPO_PUSH_MAX_ATTEMPTS - 1) return jsonError("Expo push service is unavailable", 502);
    }

    if (attempt < EXPO_PUSH_MAX_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, EXPO_PUSH_RETRY_BASE_MS * 2 ** attempt));
    }
  }

  return jsonError("Expo push service is unavailable", 502);
}

async function resolveAudience(
  type: NotificationType,
  data: NonNullable<SendPushBody["data"]>,
  caller: { id: string; role: Role; society_id: string; flat_id: string | null },
  admin: SupabaseClient,
): Promise<NotificationAudience | Response> {
  if (type === "VISITOR_REQUEST") {
    if (caller.role !== "GUARD" || !data.requestId) return jsonError("Guard visitor request required", 403);

    const { data: request, error } = await admin
      .from("visitor_requests")
      .select("id, society_id, flat_id, raised_by, status")
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
      title: "Visitor waiting at the gate",
      body: "Open Agora to review and respond.",
    };
  }

  if (type === "VISITOR_DECISION") {
    if (caller.role !== "RESIDENT" || !caller.flat_id || !data.requestId) {
      return jsonError("Resident visitor decision required", 403);
    }

    const { data: request, error } = await admin
      .from("visitor_requests")
      .select("id, society_id, flat_id, raised_by, decision_by, status")
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
      title: "Visitor request updated",
      body: "Open Agora to view the resident decision.",
    };
  }

  if (type === "NOTICE") {
    if (caller.role !== "ADMIN" || !data.noticeId) return jsonError("Admin notice required", 403);

    const { data: notice, error } = await admin
      .from("notices")
      .select("id, society_id, state, archived_at")
      .eq("id", data.noticeId)
      .eq("society_id", caller.society_id)
      .single();
    if (error || !notice || notice.state !== "PUBLISHED" || notice.archived_at) {
      return jsonError("Notice is not available", 403);
    }

    const { data: residents } = await admin
      .from("profiles")
      .select("id")
      .eq("society_id", caller.society_id)
      .eq("role", "RESIDENT");

    return {
      profileIds: (residents ?? []).map((profile: { id: string }) => profile.id),
      title: "New society notice",
      body: "Open Agora to read the latest notice.",
    };
  }

  if (type === "COMPLAINT_STATUS") {
    if (caller.role !== "ADMIN" || !data.complaintId) return jsonError("Admin complaint update required", 403);

    const { data: complaint, error } = await admin
      .from("complaints")
      .select("id, society_id, raised_by, status")
      .eq("id", data.complaintId)
      .eq("society_id", caller.society_id)
      .single();
    if (error || !complaint || !["IN_PROGRESS", "RESOLVED"].includes(complaint.status)) {
      return jsonError("Complaint update is not available", 403);
    }

    const { data: latestEvent, error: eventError } = await admin
      .from("complaint_events")
      .select("status, created_by")
      .eq("complaint_id", complaint.id)
      .eq("society_id", caller.society_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (eventError || !latestEvent || latestEvent.created_by !== caller.id || latestEvent.status !== complaint.status) {
      return jsonError("Complaint update was not made by this admin", 403);
    }

    return {
      profileIds: [complaint.raised_by],
      title: "Complaint status updated",
      body: "Open Agora to view the latest update.",
    };
  }

  if (type === "MAINTENANCE_REMINDER") {
    if (caller.role !== "ADMIN" || !data.dueId) return jsonError("Admin maintenance reminder required", 403);

    const { data: due, error } = await admin
      .from("maintenance_dues")
      .select("id, society_id, flat_id, status, cancelled_at")
      .eq("id", data.dueId)
      .eq("society_id", caller.society_id)
      .single();
    if (error || !due || due.status !== "UNPAID" || due.cancelled_at) {
      return jsonError("Unpaid maintenance invoice is not available", 403);
    }

    const { data: residents } = await admin
      .from("profiles")
      .select("id")
      .eq("society_id", caller.society_id)
      .eq("flat_id", due.flat_id)
      .eq("role", "RESIDENT");

    return {
      profileIds: (residents ?? []).map((profile: { id: string }) => profile.id),
      title: "Maintenance payment reminder",
      body: "Open Agora to review your outstanding society dues.",
    };
  }

  if (type === "TASK_ASSIGNMENT") {
    if (caller.role !== "ADMIN" || !data.taskId) return jsonError("Admin task notification required", 403);

    const { data: task, error } = await admin
      .from("operational_tasks")
      .select("id, society_id, title, status, assigned_guard_id")
      .eq("id", data.taskId)
      .eq("society_id", caller.society_id)
      .single();
    if (error || !task || !task.assigned_guard_id || !["PENDING", "IN_PROGRESS"].includes(task.status)) {
      return jsonError("Active guard task is not available", 403);
    }

    return {
      profileIds: [task.assigned_guard_id],
      title: "Society task assigned",
      body: task.title,
    };
  }

  if (type === "BOOKING_DECISION" || type === "BOOKING_MAINTENANCE_CANCELLED") {
    if (caller.role !== "ADMIN" || !data.bookingId) return jsonError("Admin booking update required", 403);

    const { data: booking, error } = await admin
      .from("amenity_bookings")
      .select("id, society_id, booked_by, status, status_reason, decided_by")
      .eq("id", data.bookingId)
      .eq("society_id", caller.society_id)
      .single();
    if (error || !booking || booking.decided_by !== caller.id) {
      return jsonError("Booking update is not available", 403);
    }

    if (type === "BOOKING_MAINTENANCE_CANCELLED") {
      if (booking.status !== "CANCELLED" || !booking.status_reason?.startsWith("Cancelled because")) {
        return jsonError("Maintenance cancellation is not available", 403);
      }
      return {
        profileIds: [booking.booked_by],
        title: "Amenity booking cancelled",
        body: "Open Agora to view the reason and booking details.",
      };
    }

    if (!["CONFIRMED", "CANCELLED"].includes(booking.status)) {
      return jsonError("Booking decision is not available", 403);
    }
    const decision = booking.status === "CONFIRMED" ? "confirmed" : "declined";
    return {
      profileIds: [booking.booked_by],
      title: `Amenity booking ${decision}`,
      body: "Open Agora to view the booking details.",
    };
  }

  return jsonError("Unsupported notification type", 400);
}

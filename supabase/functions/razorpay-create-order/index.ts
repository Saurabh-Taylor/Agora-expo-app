import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

import {
  getRazorpayCredentials,
  jsonError,
  razorpayApi,
  toAmountPaise,
} from "../_shared/razorpay.ts";

type CreateOrderBody = {
  dueId?: string;
};

type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: string;
};

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return jsonError("Method not allowed", 405);

    const callerId = ctx.userClaims?.id;
    if (!callerId) return jsonError("Unauthorized", 401);

    const body = await req.json().catch(() => null) as CreateOrderBody | null;
    if (!body?.dueId) return jsonError("Maintenance due is required", 400);

    const { data: caller, error: callerError } = await ctx.supabase
      .from("profiles")
      .select("id, role, society_id, flat_id, full_name, is_active")
      .eq("id", callerId)
      .single();
    if (
      callerError ||
      !caller ||
      !caller.is_active ||
      caller.role !== "RESIDENT" ||
      !caller.flat_id
    ) {
      return jsonError("Only active residents assigned to a flat can pay dues", 403);
    }

    const { data: due, error: dueError } = await ctx.supabase
      .from("maintenance_dues")
      .select("id, society_id, flat_id, quarter_label, amount, status, cancelled_at")
      .eq("id", body.dueId)
      .eq("society_id", caller.society_id)
      .eq("flat_id", caller.flat_id)
      .single();
    if (dueError || !due) return jsonError("Maintenance due is not available", 404);
    if (due.status !== "UNPAID" || due.cancelled_at) {
      return jsonError("This maintenance due is no longer payable", 409);
    }

    try {
      const credentials = getRazorpayCredentials();
      const amountPaise = toAmountPaise(Number(due.amount));
      const receipt = `agora-${due.id.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}`;
      const order = await razorpayApi<RazorpayOrder>("/orders", credentials, {
        method: "POST",
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt,
          notes: {
            society_id: caller.society_id,
            due_id: due.id,
            flat_id: caller.flat_id,
            mode: "AGORA_HACKATHON_TEST",
          },
        }),
      });
      if (
        !order.id ||
        order.amount !== amountPaise ||
        order.currency !== "INR" ||
        order.status !== "created"
      ) {
        return jsonError("Razorpay returned an invalid order", 502);
      }

      const { data: attempt, error: attemptError } = await ctx.supabaseAdmin
        .from("razorpay_payment_attempts")
        .insert({
          society_id: caller.society_id,
          flat_id: caller.flat_id,
          due_id: due.id,
          created_by: caller.id,
          razorpay_order_id: order.id,
          amount_paise: amountPaise,
          currency: "INR",
        })
        .select("id, checkout_token")
        .single();
      if (attemptError || !attempt) {
        return jsonError("Could not initialize the secure checkout", 500);
      }

      const requestUrl = new URL(req.url);
      const checkoutUrl = `${requestUrl.origin}/functions/v1/razorpay-checkout?session=${attempt.checkout_token}`;
      return Response.json({
        attemptId: attempt.id,
        checkoutUrl,
        amountPaise,
        quarterLabel: due.quarter_label,
      });
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Could not create Razorpay order", 502);
    }
  }),
};

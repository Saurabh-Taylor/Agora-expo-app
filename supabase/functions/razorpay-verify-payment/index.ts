import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

import {
  getRazorpayCredentials,
  jsonError,
  razorpayApi,
} from "../_shared/razorpay.ts";

type VerifyPaymentBody = {
  attemptId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
};

type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
};

async function createSignature(orderId: string, paymentId: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${orderId}|${paymentId}`),
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return jsonError("Method not allowed", 405);

    const callerId = ctx.userClaims?.id;
    if (!callerId) return jsonError("Unauthorized", 401);
    const body = await req.json().catch(() => null) as VerifyPaymentBody | null;
    if (
      !body?.attemptId ||
      !body.razorpayOrderId ||
      !body.razorpayPaymentId ||
      !body.razorpaySignature
    ) {
      return jsonError("Complete Razorpay verification details are required", 400);
    }

    const { data: attempt, error: attemptError } = await ctx.supabase
      .from("razorpay_payment_attempts")
      .select("id, society_id, flat_id, due_id, created_by, razorpay_order_id, amount_paise, currency, status, expires_at")
      .eq("id", body.attemptId)
      .eq("created_by", callerId)
      .single();
    if (attemptError || !attempt) return jsonError("Payment attempt is not available", 404);
    if (attempt.razorpay_order_id !== body.razorpayOrderId) {
      return jsonError("Payment order does not match", 400);
    }
    if (attempt.status === "CAPTURED") {
      const { data: existingPayment } = await ctx.supabase
        .from("payments")
        .select("*")
        .eq("gateway", "RAZORPAY")
        .eq("gateway_order_id", attempt.razorpay_order_id)
        .single();
      if (existingPayment) return Response.json({ payment: existingPayment });
    }
    if (attempt.status !== "CREATED" || new Date(attempt.expires_at).getTime() <= Date.now()) {
      return jsonError("Payment attempt has expired", 410);
    }

    try {
      const credentials = getRazorpayCredentials();
      const expectedSignature = await createSignature(
        attempt.razorpay_order_id,
        body.razorpayPaymentId,
        credentials.keySecret,
      );
      if (!timingSafeEqual(expectedSignature, body.razorpaySignature.toLowerCase())) {
        return jsonError("Razorpay signature verification failed", 400);
      }

      const gatewayPayment = await razorpayApi<RazorpayPayment>(
        `/payments/${encodeURIComponent(body.razorpayPaymentId)}`,
        credentials,
      );
      if (
        gatewayPayment.id !== body.razorpayPaymentId ||
        gatewayPayment.order_id !== attempt.razorpay_order_id ||
        gatewayPayment.amount !== attempt.amount_paise ||
        gatewayPayment.currency !== attempt.currency
      ) {
        return jsonError("Razorpay payment details do not match the invoice", 400);
      }
      if (gatewayPayment.status !== "captured") {
        return jsonError("Payment is authorized but not captured; enable automatic capture in Razorpay", 409);
      }

      const { data: payment, error: paymentError } = await ctx.supabaseAdmin.rpc(
        "record_verified_razorpay_payment",
        {
          target_attempt_id: attempt.id,
          verified_order_id: attempt.razorpay_order_id,
          verified_payment_id: gatewayPayment.id,
        },
      );
      if (paymentError || !payment) {
        return jsonError(paymentError?.message ?? "Could not record the verified payment", 500);
      }
      if (
        payment.society_id !== attempt.society_id ||
        payment.flat_id !== attempt.flat_id ||
        payment.due_id !== attempt.due_id
      ) {
        return jsonError("Verified payment scope is invalid", 500);
      }
      return Response.json({ payment });
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Could not verify Razorpay payment", 502);
    }
  }),
};

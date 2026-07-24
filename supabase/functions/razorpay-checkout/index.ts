import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

import { getRazorpayCredentials } from "../_shared/razorpay.ts";

const APP_RETURN_URL = "agoraexpoapp://razorpay-complete";

function page(message: string, status = 200) {
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agora payment</title><style>
body{margin:0;background:#ede7da;color:#17251d;font:16px system-ui,sans-serif;display:grid;min-height:100vh;place-items:center}
main{margin:20px;max-width:420px;background:#fff;border:1px solid #e5e0d2;border-radius:22px;padding:28px;text-align:center}
h1{font-size:24px;margin:0 0 10px}p{color:#75806f;line-height:1.5;margin:0}
</style></head><body><main><h1>Agora</h1><p>${message}</p></main></body></html>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function scriptJson(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    if (req.method !== "GET") return page("Method not allowed.", 405);
    const session = new URL(req.url).searchParams.get("session");
    if (!session) return page("This checkout link is invalid.", 400);

    const { data: attempt, error } = await ctx.supabaseAdmin
      .from("razorpay_payment_attempts")
      .select("id, razorpay_order_id, amount_paise, currency, status, expires_at")
      .eq("checkout_token", session)
      .single();
    if (error || !attempt) return page("This checkout link is invalid or has expired.", 404);
    if (attempt.status === "CAPTURED") return page("This maintenance invoice is already paid.", 409);
    if (attempt.status !== "CREATED" || new Date(attempt.expires_at).getTime() <= Date.now()) {
      await ctx.supabaseAdmin
        .from("razorpay_payment_attempts")
        .update({ status: "EXPIRED", updated_at: new Date().toISOString() })
        .eq("id", attempt.id)
        .eq("status", "CREATED");
      return page("This secure checkout session has expired. Return to Agora and try again.", 410);
    }

    let keyId: string;
    try {
      keyId = getRazorpayCredentials().keyId;
    } catch (credentialError) {
      return page(credentialError instanceof Error ? credentialError.message : "Payment is not configured.", 503);
    }

    const options = {
      key: keyId,
      amount: String(attempt.amount_paise),
      currency: attempt.currency,
      name: "Agora",
      description: "Society maintenance payment · Test Mode",
      order_id: attempt.razorpay_order_id,
      theme: { color: "#10261B" },
      modal: { confirm_close: true },
      retry: { enabled: true },
    };
    const returnUrl = scriptJson(APP_RETURN_URL);
    return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agora · Razorpay Test Mode</title><style>
body{margin:0;background:#ede7da;color:#17251d;font:16px system-ui,sans-serif;display:grid;min-height:100vh;place-items:center}
main{margin:20px;max-width:420px;background:#fff;border:1px solid #e5e0d2;border-radius:22px;padding:28px;text-align:center}
h1{font-size:24px;margin:0 0 8px}.badge{display:inline-block;background:#fff6df;color:#8a5a00;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:800}
p{color:#75806f;line-height:1.5}.spinner{width:34px;height:34px;margin:22px auto;border:4px solid #e5e0d2;border-top-color:#10261b;border-radius:50%;animation:s .8s linear infinite}
button{border:0;border-radius:14px;background:#10261b;color:#fff;padding:14px 20px;font-weight:700;font-size:15px}
@keyframes s{to{transform:rotate(360deg)}}</style></head><body><main><span class="badge">TEST MODE · NO REAL MONEY</span>
<h1>Opening Razorpay</h1><p>Complete the sandbox payment, then you will return securely to Agora.</p>
<div class="spinner" id="spinner"></div><button id="retry" hidden>Open checkout</button></main>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script><script>
const returnUrl=${returnUrl};
const options=${scriptJson(options)};
options.handler=function(response){
  const params=new URLSearchParams({
    status:"success",
    attempt:${scriptJson(attempt.id)},
    order:response.razorpay_order_id,
    payment:response.razorpay_payment_id,
    signature:response.razorpay_signature
  });
  window.location.replace(returnUrl+"?"+params.toString());
};
options.modal={...options.modal,ondismiss:function(){
  window.location.replace(returnUrl+"?status=cancelled");
}};
const checkout=new Razorpay(options);
checkout.on("payment.failed",function(response){
  const message=response.error && response.error.description ? response.error.description : "Payment failed";
  document.querySelector("p").textContent=message+" You can retry or return to Agora.";
});
function openCheckout(){
  document.getElementById("spinner").hidden=false;
  checkout.open();
}
document.getElementById("retry").onclick=openCheckout;
try{openCheckout()}catch(error){
  document.getElementById("spinner").hidden=true;
  document.getElementById("retry").hidden=false;
  document.querySelector("p").textContent="Checkout could not open. Please retry.";
}
</script></body></html>`, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; script-src 'self' https://checkout.razorpay.com 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data:; connect-src https://*.razorpay.com; frame-src https://*.razorpay.com; form-action https://*.razorpay.com; base-uri 'none'",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }),
};

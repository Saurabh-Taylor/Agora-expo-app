export type RazorpayCredentials = {
  keyId: string;
  keySecret: string;
};

export function getRazorpayCredentials(): RazorpayCredentials {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
  if (!keyId || !keySecret) {
    throw new Error("Razorpay Test Mode is not configured");
  }
  if (!keyId.startsWith("rzp_test_")) {
    throw new Error("Agora demo accepts only Razorpay Test Mode keys");
  }
  return { keyId, keySecret };
}

export function razorpayAuthorization(credentials: RazorpayCredentials) {
  return `Basic ${btoa(`${credentials.keyId}:${credentials.keySecret}`)}`;
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function razorpayApi<T>(
  path: string,
  credentials: RazorpayCredentials,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: razorpayAuthorization(credentials),
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => null) as T & {
    error?: { description?: string };
  } | null;
  if (!response.ok || !data) {
    throw new Error(data?.error?.description ?? "Razorpay request failed");
  }
  return data;
}

export function toAmountPaise(amount: number) {
  const amountPaise = Math.round(amount * 100);
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) {
    throw new Error("Maintenance amount is not valid for Razorpay");
  }
  return amountPaise;
}

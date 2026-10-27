import { supabase } from "@/lib/supabase";

const FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";

export async function callEdgeFunction<T>(
  functionName: string,
  body: any,
  method: "POST" | "GET" = "POST"
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const url = `${FUNCTION_URL}/${functionName}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error?.message || "Function call failed");
  return data.data;
}

export async function spendCredits(amount: number, reason?: string) {
  return callEdgeFunction("credits-spend", { amount, reason });
}

export async function logApiUsage(
  providerName: string,
  unitsUsed: number,
  costInr: number,
  reason?: string,
  courseId?: string
) {
  return callEdgeFunction("log-api-usage", {
    provider_name: providerName,
    units_used: unitsUsed,
    cost_inr: costInr,
    reason,
    course_id: courseId,
  });
}

export async function createRazorpayOrder(creditsPurchased: number, amountInrPaise: number, receipt?: string) {
  return callEdgeFunction<{ order_id: string }>("razorpay-create-order", { credits_purchased: creditsPurchased, amount_inr_paise: amountInrPaise, receipt });
}

export async function verifyRazorpayPayment(orderId: string, paymentId: string, signature: string) {
  return callEdgeFunction("razorpay-verify", { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature });
}

export async function fetchProviderUsage() {
  return callEdgeFunction("fetch-provider-usage", {}, "GET");
}

/**
 * supabase-js reports any non-2xx reply as "Edge Function returned a non-2xx status code" and keeps the
 * function's own message in the response body. Read that message so the real cause reaches the user.
 */
export async function functionErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === "function") {
    const body = await context.json().catch(() => null) as { error?: unknown } | null;
    if (typeof body?.error === "string" && body.error) return body.error;
  }
  return error instanceof Error ? error.message : "Unknown error";
}

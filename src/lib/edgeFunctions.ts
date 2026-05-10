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

export async function createRazorpayOrder(creditsPurchased: number, amountInrPaise: number, receipt?: string) {
  return callEdgeFunction<{ order_id: string }>("razorpay-create-order", { credits_purchased: creditsPurchased, amount_inr_paise: amountInrPaise, receipt });
}

export async function verifyRazorpayPayment(orderId: string, paymentId: string, signature: string) {
  return callEdgeFunction("razorpay-verify", { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature });
}

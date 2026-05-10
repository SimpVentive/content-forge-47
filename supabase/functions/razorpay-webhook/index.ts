// POST /razorpay-webhook
// Body: raw Razorpay webhook payload
// Auth: NONE (Razorpay calls this directly). Verified via X-Razorpay-Signature.
//
// IMPORTANT: deploy with `supabase functions deploy razorpay-webhook --no-verify-jwt`
// so Razorpay's unauthenticated calls reach the function.
//
// Handled events:
//   - payment.captured  → idempotent call to complete_razorpay_payment RPC
//   - payment.failed    → mark tx failed
//   - order.paid        → same as payment.captured

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, serverError } from "../_shared/responses.ts";
import { adminClient } from "../_shared/supabase.ts";
import { hmacSha256Hex, timingSafeEqual } from "../_shared/hmac.ts";

const WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return badRequest("Method not allowed");
  if (!WEBHOOK_SECRET) return serverError("Webhook secret not configured");

  const sig = req.headers.get("x-razorpay-signature");
  if (!sig) return unauthorized("Missing X-Razorpay-Signature");

  // Read raw body — must be the exact bytes Razorpay signed.
  const raw = await req.text();
  const expected = await hmacSha256Hex(raw, WEBHOOK_SECRET);
  if (!timingSafeEqual(expected, sig)) return unauthorized("Invalid webhook signature");

  let payload: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; status?: string } };
      order?: { entity?: { id?: string } };
    };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return badRequest("Invalid JSON");
  }

  const admin = adminClient();
  const event = payload.event ?? "";
  const paymentEntity = payload.payload?.payment?.entity;
  const orderEntity = payload.payload?.order?.entity;
  const orderId = paymentEntity?.order_id ?? orderEntity?.id;
  const paymentId = paymentEntity?.id;

  if (event === "payment.captured" || event === "order.paid") {
    if (!orderId || !paymentId) return badRequest("Missing order_id / payment_id in payload");
    const { error } = await admin.rpc("complete_razorpay_payment", {
      p_order_id: orderId,
      p_payment_id: paymentId,
    });
    // The RPC is idempotent — duplicate deliveries are fine. Log on error but
    // still 200 to Razorpay so it doesn't retry storms.
    if (error) console.error("complete_razorpay_payment failed:", error);
    return ok({ event, processed: true });
  }

  if (event === "payment.failed") {
    if (!orderId) return badRequest("Missing order_id");
    const { error } = await admin
      .from("billing_transactions")
      .update({ status: "failed", razorpay_payment_id: paymentId ?? null })
      .eq("razorpay_order_id", orderId)
      .eq("status", "created");
    if (error) console.error("mark failed:", error);
    return ok({ event, processed: true });
  }

  // Other events: acknowledge but no-op.
  return ok({ event, processed: false, reason: "event ignored" });
});

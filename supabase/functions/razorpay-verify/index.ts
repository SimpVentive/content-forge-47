// POST /razorpay-verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Auth: Bearer user JWT
//
// Verifies the HMAC signature returned by the Razorpay JS SDK after a
// successful checkout, then completes the payment atomically via the
// `complete_razorpay_payment` RPC (marks tx paid + grants credits).
//
// HMAC scheme (per Razorpay docs):
//   expected = HMAC-SHA256(`${order_id}|${payment_id}`, KEY_SECRET) hex

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, forbidden, serverError, methodNotAllowed } from "../_shared/responses.ts";
import { getAuthedUser, AuthError } from "../_shared/auth.ts";
import { adminClient } from "../_shared/supabase.ts";
import { hmacSha256Hex, timingSafeEqual } from "../_shared/hmac.ts";

const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

type Body = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return methodNotAllowed("POST");
  if (!RAZORPAY_KEY_SECRET) return serverError("Razorpay not configured");

  let ctx;
  try {
    ctx = await getAuthedUser(req);
  } catch (e) {
    if (e instanceof AuthError) return e.status === 403 ? forbidden(e.message) : unauthorized(e.message);
    return serverError("Auth failure");
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return badRequest("razorpay_order_id, razorpay_payment_id, razorpay_signature required");
  }

  const expected = await hmacSha256Hex(
    `${razorpay_order_id}|${razorpay_payment_id}`,
    RAZORPAY_KEY_SECRET,
  );
  if (!timingSafeEqual(expected, razorpay_signature)) {
    return unauthorized("Invalid Razorpay signature");
  }

  // Confirm the order belongs to this user (defence in depth: don't let users
  // verify someone else's payment, even with a valid signature).
  const admin = adminClient();
  const { data: tx, error: txErr } = await admin
    .from("billing_transactions")
    .select("id, user_id, status")
    .eq("razorpay_order_id", razorpay_order_id)
    .maybeSingle();
  if (txErr) return serverError("Lookup failed", txErr);
  if (!tx) return badRequest("Unknown order");
  if (tx.user_id !== ctx.user.id) return forbidden("Order belongs to a different user");

  const { data: rpc, error: rpcErr } = await admin.rpc("complete_razorpay_payment", {
    p_order_id: razorpay_order_id,
    p_payment_id: razorpay_payment_id,
  });
  if (rpcErr) return serverError("Failed to complete payment", rpcErr);

  return ok({ transaction_id: tx.id, ...rpc });
});

// POST /razorpay-create-order
// Body: { credits_purchased: number, amount_inr_paise: number, receipt?: string }
// Auth: Bearer user JWT
//
// Creates a Razorpay order via the Orders API and inserts a 'created'
// billing_transactions row owned by the caller. Returns the data the
// frontend Razorpay JS SDK needs to open the checkout.

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, serverError, unauthorized, forbidden, methodNotAllowed } from "../_shared/responses.ts";
import { getAuthedUser, AuthError } from "../_shared/auth.ts";
import { adminClient } from "../_shared/supabase.ts";

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

type Body = {
  credits_purchased?: number;
  amount_inr_paise?: number;
  receipt?: string;
};

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return methodNotAllowed("POST");

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return serverError("Razorpay not configured");
  }

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

  const credits = Number(body.credits_purchased);
  const amount = Number(body.amount_inr_paise);
  if (!Number.isInteger(credits) || credits <= 0) return badRequest("credits_purchased must be a positive integer");
  if (!Number.isInteger(amount) || amount <= 0) return badRequest("amount_inr_paise must be a positive integer");

  // Razorpay receipt is max 40 chars. Keep it deterministic and short.
  const receipt = body.receipt ?? `cf_${ctx.user.id.slice(0, 8)}_${Date.now()}`;

  const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
  const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify({
      amount,
      currency: "INR",
      receipt,
      notes: {
        user_id: ctx.user.id,
        credits_purchased: String(credits),
      },
    }),
  });

  if (!rzpRes.ok) {
    const detail = await rzpRes.text();
    return serverError("Razorpay order creation failed", { status: rzpRes.status, detail });
  }
  const order = await rzpRes.json() as { id: string; amount: number; currency: string };

  const admin = adminClient();
  const { error: dbErr } = await admin.from("billing_transactions").insert({
    user_id: ctx.user.id,
    razorpay_order_id: order.id,
    amount_inr: amount,
    credits_purchased: credits,
    status: "created",
  });
  if (dbErr) {
    return serverError("Failed to record transaction", dbErr);
  }

  return ok({
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: RAZORPAY_KEY_ID,
    receipt,
  });
});

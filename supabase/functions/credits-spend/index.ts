// POST /credits-spend
// Body: { amount: number, reason?: string }
// Auth: Bearer user JWT
//
// Atomically deducts `amount` credits from the caller's profile via the
// `spend_credits` RPC. The RPC takes a row-level lock and raises
// `insufficient_credits` if the user can't afford the request.
//
// Returns 402 Payment Required when balance is insufficient so the course
// generation pipeline can surface a clean error to the user.

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, forbidden, serverError, methodNotAllowed } from "../_shared/responses.ts";
import { getAuthedUser, AuthError } from "../_shared/auth.ts";
import { adminClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";

type Body = { amount?: number; reason?: string };

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return methodNotAllowed("POST");

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
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    return badRequest("amount must be a positive integer");
  }

  const admin = adminClient();
  const { data, error } = await admin.rpc("spend_credits", {
    p_user_id: ctx.user.id,
    p_amount: amount,
    p_reason: body.reason ?? null,
  });

  if (error) {
    // Postgres SQLSTATE / message check for insufficient balance.
    const isInsufficient =
      error.code === "P0001" || /insufficient_credits/i.test(error.message ?? "");
    if (isInsufficient) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: "insufficient_credits", message: "Not enough credits" },
        }),
        { status: 402, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }
    return serverError("Spend failed", error);
  }

  return ok({ remaining_credits: data });
});

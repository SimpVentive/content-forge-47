// POST /log-api-usage
// Body: { provider_name: string, units_used: number, cost_inr: number, reason?: string, course_id?: string }
// Auth: Bearer user JWT
//
// Logs API usage to api_usage_logs table and deducts cost from user's credits.
// Returns the updated remaining credits.

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, forbidden, serverError, methodNotAllowed } from "../_shared/responses.ts";
import { getAuthedUser, AuthError } from "../_shared/auth.ts";
import { adminClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";

type Body = {
  provider_name?: string;
  units_used?: number;
  cost_inr?: number;
  reason?: string;
  course_id?: string;
};

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

  const providerName = body.provider_name?.trim();
  const unitsUsed = Number(body.units_used);
  const costInr = Number(body.cost_inr);

  if (!providerName) {
    return badRequest("provider_name is required");
  }
  if (!Number.isInteger(unitsUsed) || unitsUsed <= 0) {
    return badRequest("units_used must be a positive integer");
  }
  if (costInr < 0) {
    return badRequest("cost_inr must be non-negative");
  }

  const admin = adminClient();

  // 1. Log the API usage
  const { error: logError } = await admin.from("api_usage_logs").insert({
    user_id: ctx.user.id,
    provider_name: providerName,
    units_used: unitsUsed,
    cost: costInr,
    reason: body.reason ?? null,
    course_id: body.course_id ?? null,
    created_at: new Date().toISOString(),
  });

  if (logError) {
    console.error("Failed to log API usage:", logError);
    return serverError("Failed to log API usage", logError);
  }

  // 2. Deduct cost from user's credits
  const costAsCredits = Math.ceil(costInr);

  if (costAsCredits > 0) {
    const { data, error: spendError } = await admin.rpc("spend_credits", {
      p_user_id: ctx.user.id,
      p_amount: costAsCredits,
      p_reason: `${providerName}: ${body.reason ?? "API usage"}`,
    });

    if (spendError) {
      const isInsufficient =
        spendError.code === "P0001" || /insufficient_credits/i.test(spendError.message ?? "");
      if (isInsufficient) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: { code: "insufficient_credits", message: "Not enough credits for this operation" },
          }),
          { status: 402, headers: { ...corsHeaders, "content-type": "application/json" } },
        );
      }
      console.error("Failed to deduct credits:", spendError);
      return serverError("Failed to deduct credits", spendError);
    }

    return ok({
      logged: true,
      cost_deducted: costAsCredits,
      remaining_credits: data,
    });
  }

  // No cost to deduct, just return success
  const { data: profile } = await admin
    .from("profiles")
    .select("credits_total, credits_used")
    .eq("id", ctx.user.id)
    .single();

  const remaining = (profile?.credits_total ?? 0) - (profile?.credits_used ?? 0);

  return ok({
    logged: true,
    cost_deducted: 0,
    remaining_credits: remaining,
  });
});

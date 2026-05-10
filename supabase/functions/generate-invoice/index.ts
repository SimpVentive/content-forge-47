// GET /generate-invoice?transaction_id=<uuid>
// Auth: Bearer user JWT (own transaction) OR admin (any transaction).
//
// Returns a short-lived signed URL for the invoice PDF stored in the
// 'invoices' Storage bucket. The PDF path is stored on the transaction row
// in the `invoice_pdf_path` column (added in the 20260509000001 migration).
//
// Returns 404 if the PDF hasn't been generated yet (path is null).

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "../_shared/responses.ts";
import { getAuthedUser, AuthError } from "../_shared/auth.ts";
import { adminClient } from "../_shared/supabase.ts";

const INVOICE_BUCKET = Deno.env.get("INVOICE_BUCKET") ?? "invoices";
const SIGNED_URL_TTL_SECONDS = 60 * 5; // 5 minutes

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "GET") return badRequest("Method not allowed");

  let ctx;
  try {
    ctx = await getAuthedUser(req);
  } catch (e) {
    if (e instanceof AuthError) return e.status === 403 ? forbidden(e.message) : unauthorized(e.message);
    return serverError("Auth failure");
  }

  const url = new URL(req.url);
  const transactionId = url.searchParams.get("transaction_id");
  if (!transactionId) return badRequest("transaction_id query param required");

  const admin = adminClient();
  const { data: tx, error } = await admin
    .from("billing_transactions")
    .select("id, user_id, status, invoice_pdf_path")
    .eq("id", transactionId)
    .maybeSingle();
  if (error) return serverError("Lookup failed", error);
  if (!tx) return notFound("Transaction not found");

  if (tx.user_id !== ctx.user.id && ctx.role !== "admin") {
    return forbidden("Not your transaction");
  }
  if (tx.status !== "paid") return badRequest("Invoice only available for paid transactions");
  if (!tx.invoice_pdf_path) return notFound("Invoice PDF not yet generated");

  const { data: signed, error: signErr } = await admin.storage
    .from(INVOICE_BUCKET)
    .createSignedUrl(tx.invoice_pdf_path, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed) return serverError("Failed to sign URL", signErr);

  return ok({
    url: signed.signedUrl,
    expires_in_seconds: SIGNED_URL_TTL_SECONDS,
    expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
  });
});

// POST /provider-config-write
// Body: { id?: uuid, provider_name: string, api_key: string, is_active?: boolean, config_json?: object }
// Auth: Bearer user JWT, must have role='admin'
//
// Encrypts api_key with AES-GCM (master key in PROVIDER_KEY_ENCRYPTION_SECRET)
// before writing to provider_configs. The plaintext key never leaves this
// function — provider-test handles decryption + outbound API calls.
//
// If `id` is present this is an update; otherwise an insert.

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, forbidden, serverError } from "../_shared/responses.ts";
import { requireAdmin, AuthError } from "../_shared/auth.ts";
import { adminClient } from "../_shared/supabase.ts";
import { encryptSecret } from "../_shared/encryption.ts";

type Body = {
  id?: string;
  provider_name?: string;
  api_key?: string;
  is_active?: boolean;
  config_json?: Record<string, unknown> | null;
};

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST" && req.method !== "PUT") return badRequest("Method not allowed");

  let ctx;
  try {
    ctx = await requireAdmin(req);
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
  if (!body.provider_name?.trim()) return badRequest("provider_name required");
  if (!body.api_key?.trim()) return badRequest("api_key required");

  let encrypted: string;
  try {
    encrypted = await encryptSecret(body.api_key);
  } catch (e) {
    return serverError("Encryption failed", e instanceof Error ? e.message : String(e));
  }

  const admin = adminClient();
  const row = {
    provider_name: body.provider_name.trim(),
    api_key_encrypted: encrypted,
    is_active: body.is_active ?? true,
    config_json: body.config_json ?? null,
    updated_by: ctx.user.id,
    updated_at: new Date().toISOString(),
  };

  if (body.id) {
    const { data, error } = await admin
      .from("provider_configs")
      .update(row)
      .eq("id", body.id)
      .select("id, provider_name, is_active, config_json, updated_at")
      .maybeSingle();
    if (error) return serverError("Update failed", error);
    if (!data) return badRequest("Provider config not found");
    return ok(data);
  }

  const { data, error } = await admin
    .from("provider_configs")
    .insert(row)
    .select("id, provider_name, is_active, config_json, updated_at")
    .single();
  if (error) return serverError("Insert failed", error);
  return ok(data);
});

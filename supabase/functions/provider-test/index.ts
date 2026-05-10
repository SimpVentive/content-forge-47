// POST /provider-test
// Body: { provider_id: uuid }
// Auth: Bearer user JWT, must have role='admin'
//
// Decrypts the stored API key for a provider_configs row and makes a minimal
// authenticated request to the upstream API as a connectivity / credentials
// probe. Returns latency and HTTP status.
//
// Supported provider_name values (case-insensitive):
//   anthropic, openai, elevenlabs, youtube
// Anything else returns ok=false with "unsupported provider" — extend the
// switch below to add more.

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "../_shared/responses.ts";
import { requireAdmin, AuthError } from "../_shared/auth.ts";
import { adminClient } from "../_shared/supabase.ts";
import { decryptSecret } from "../_shared/encryption.ts";

type Body = { provider_id?: string };

type ProbeResult = { ok: boolean; status_code: number; latency_ms: number; message: string };

const probe = async (providerName: string, key: string): Promise<ProbeResult> => {
  const t0 = performance.now();
  let url = "";
  let headers: Record<string, string> = {};

  switch (providerName.toLowerCase()) {
    case "anthropic":
      url = "https://api.anthropic.com/v1/models";
      headers = { "x-api-key": key, "anthropic-version": "2023-06-01" };
      break;
    case "openai":
      url = "https://api.openai.com/v1/models";
      headers = { authorization: `Bearer ${key}` };
      break;
    case "elevenlabs":
      url = "https://api.elevenlabs.io/v1/voices";
      headers = { "xi-api-key": key };
      break;
    case "youtube":
      url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=test&key=${encodeURIComponent(key)}`;
      break;
    default:
      return {
        ok: false,
        status_code: 0,
        latency_ms: 0,
        message: `Unsupported provider: ${providerName}`,
      };
  }

  try {
    const res = await fetch(url, { headers });
    const latency = Math.round(performance.now() - t0);
    return {
      ok: res.ok,
      status_code: res.status,
      latency_ms: latency,
      message: res.ok ? "Connection OK" : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      ok: false,
      status_code: 0,
      latency_ms: Math.round(performance.now() - t0),
      message: e instanceof Error ? e.message : "Network error",
    };
  }
};

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return badRequest("Method not allowed");

  try {
    await requireAdmin(req);
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
  if (!body.provider_id) return badRequest("provider_id required");

  const admin = adminClient();
  const { data: row, error } = await admin
    .from("provider_configs")
    .select("provider_name, api_key_encrypted, is_active")
    .eq("id", body.provider_id)
    .maybeSingle();
  if (error) return serverError("Lookup failed", error);
  if (!row) return notFound("Provider config not found");

  let plaintext: string;
  try {
    plaintext = await decryptSecret(row.api_key_encrypted);
  } catch (e) {
    return serverError("Decryption failed", e instanceof Error ? e.message : String(e));
  }

  const result = await probe(row.provider_name, plaintext);
  return ok(result);
});

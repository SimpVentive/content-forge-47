// POST /heygen-proxy
// Body: { action: "generate", payload: object }
//     | { action: "status", videoId: string }
//     | { action: "usage" }
// Auth: Bearer user JWT
//
// Forwards HeyGen calls with the API key from the Supabase secret HEYGEN_API_KEY.
// The key never reaches the browser bundle. Returns { ok: true, data: { status, body } }
// where status/body are HeyGen's own HTTP status and JSON, so the client can handle them as before.

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, forbidden, serverError, methodNotAllowed } from "../_shared/responses.ts";
import { getAuthedUser, AuthError } from "../_shared/auth.ts";

const HEYGEN_API_URL = "https://api.heygen.com/v1";

type Body =
  | { action: "generate"; payload?: unknown }
  | { action: "status"; videoId?: string }
  | { action: "usage" };

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return methodNotAllowed("POST");

  try {
    await getAuthedUser(req);
  } catch (e) {
    if (e instanceof AuthError) return e.status === 403 ? forbidden(e.message) : unauthorized(e.message);
    return serverError("Auth failure");
  }

  const apiKey = Deno.env.get("HEYGEN_API_KEY");
  if (!apiKey) return serverError("HEYGEN_API_KEY secret is not set");

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  let url: string;
  let init: RequestInit;

  if (body.action === "generate") {
    if (!body.payload || typeof body.payload !== "object") return badRequest("payload is required");
    url = `${HEYGEN_API_URL}/video_generate`;
    init = {
      method: "POST",
      headers: { "X-HEYGEN-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body.payload),
    };
  } else if (body.action === "status") {
    if (!body.videoId || !/^[A-Za-z0-9_-]{1,128}$/.test(body.videoId)) {
      return badRequest("videoId is invalid");
    }
    url = `${HEYGEN_API_URL}/video/${body.videoId}`;
    init = { method: "GET", headers: { "X-HEYGEN-API-KEY": apiKey } };
  } else if (body.action === "usage") {
    url = `${HEYGEN_API_URL}/account`;
    init = { method: "GET", headers: { "x-api-key": apiKey } };
  } else {
    return badRequest("action must be generate, status or usage");
  }

  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { error: { message: text.slice(0, 300) } };
    }
    return ok({ status: res.status, body: parsed });
  } catch (e) {
    console.error("heygen-proxy upstream failure", e);
    return serverError("HeyGen is unreachable");
  }
});

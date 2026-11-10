// POST /flux-fill
// Body: { image: base64 PNG, mask: base64 PNG (white = area to repaint), prompt: string, seed: number }
// Auth: Bearer user JWT.
//
// One Black Forest Labs Flux Fill (inpainting) call. The BFL key stays in Supabase secrets (BFL_API_KEY); the browser
// never sees it. The result is returned to the caller only; nothing is stored here. The browser decides what to keep.

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, serverError, methodNotAllowed } from "../_shared/responses.ts";
import { getAuthedUser, AuthError } from "../_shared/auth.ts";

const BFL_SUBMIT = "https://api.bfl.ai/v1/flux-pro-1.0-fill";
const POLL_TIMEOUT_MS = 120_000;
const MAX_BASE64_CHARS = 12 * 1024 * 1024;
const MAX_PROMPT_CHARS = 800;

function isPngBase64(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_BASE64_CHARS && /^[A-Za-z0-9+/=]+$/.test(value);
}

async function pollUntilReady(pollingUrl: string, key: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(pollingUrl, { headers: { "x-key": key } });
    if (!res.ok) throw new Error(`BFL poll ${res.status}`);
    const data = await res.json();
    if (data?.status === "Ready") {
      const sampleUrl = data?.result?.sample;
      if (!sampleUrl) throw new Error("BFL returned no image");
      const img = await fetch(sampleUrl);
      if (!img.ok) throw new Error(`BFL image download ${img.status}`);
      const bytes = new Uint8Array(await img.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(binary);
    }
    if (["Error", "Failed", "Request Moderated", "Content Moderated"].includes(data?.status)) {
      throw new Error(`BFL ${data.status}`);
    }
  }
  throw new Error("BFL timed out");
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return methodNotAllowed("POST");

  try {
    await getAuthedUser(req);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    return serverError("Auth failure");
  }

  let body: { image?: unknown; mask?: unknown; prompt?: unknown; seed?: unknown };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (!isPngBase64(body.image) || !isPngBase64(body.mask)) return badRequest("image and mask must be base64 PNG");
  if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > MAX_PROMPT_CHARS) {
    return badRequest("prompt is required (800 characters at most)");
  }
  const seed = Number.isInteger(body.seed) ? (body.seed as number) : 1;

  const key = Deno.env.get("BFL_API_KEY");
  if (!key) return serverError("Image service is not configured");

  try {
    const submit = await fetch(BFL_SUBMIT, {
      method: "POST",
      headers: { "x-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: body.prompt,
        image: body.image,
        mask: body.mask,
        steps: 50,
        guidance: 60,
        output_format: "png",
        seed,
      }),
    });
    if (!submit.ok) {
      const detail = (await submit.text().catch(() => "")).slice(0, 200);
      return serverError(`Image service refused the request (${submit.status}) ${detail}`.trim());
    }
    const job = await submit.json();
    if (!job?.polling_url) return serverError("Image service returned no job");
    const png = await pollUntilReady(job.polling_url, key);
    return ok({ png });
  } catch (e) {
    return serverError((e as Error).message || "Image service failed");
  }
});

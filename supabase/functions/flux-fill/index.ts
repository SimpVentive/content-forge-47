// POST /flux-fill
// Body: { image: base64 PNG, mask: base64 PNG (white = area to repaint), prompt: string, seed: number }
// Auth: Bearer user JWT.
//
// One Black Forest Labs Flux Fill (inpainting) call. The BFL key stays in Supabase secrets (BFL_API_KEY); the browser
// never sees it. The result is returned to the caller only; nothing is stored here. Every call writes one log line per
// step (start, submitted, poll, ready, failed) with the BFL task id, so failures can be traced in the function logs.

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, serverError, methodNotAllowed } from "../_shared/responses.ts";
import { getAuthedUser, AuthError } from "../_shared/auth.ts";

const BFL_SUBMIT = "https://api.bfl.ai/v1/flux-pro-1.0-fill";
const POLL_TIMEOUT_MS = 120_000;
const MAX_BASE64_CHARS = 12 * 1024 * 1024;
const MAX_PROMPT_CHARS = 800;
const FAILED_STATUSES = ["Error", "Failed", "Request Moderated", "Content Moderated"];

function log(entry: Record<string, unknown>): void {
  console.log(JSON.stringify({ fn: "flux-fill", at: new Date().toISOString(), ...entry }));
}

function isBase64(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_BASE64_CHARS && /^[A-Za-z0-9+/=]+$/.test(value);
}

/** Thrown with BFL's own status word (for example "Request Moderated") so the user sees the exact reason. */
class BflFailure extends Error {}

function bflReason(status: string, details: unknown): string {
  const extra = details === undefined || details === null || details === "" ? "" : `: ${typeof details === "string" ? details : JSON.stringify(details)}`;
  return `${status}${extra}`;
}

async function pollUntilReady(taskId: string, pollingUrl: string, key: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let last = "";
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(pollingUrl, { headers: { "x-key": key } });
    if (!res.ok) {
      log({ event: "poll_http_error", taskId, httpStatus: res.status });
      throw new Error(`The image service did not answer the status check (HTTP ${res.status})`);
    }
    const data = await res.json();
    if (data?.status !== last) {
      log({ event: "poll", taskId, status: data?.status ?? "(none)" });
      last = data?.status ?? "";
    }
    if (data?.status === "Ready") {
      const sampleUrl = data?.result?.sample;
      if (!sampleUrl) throw new BflFailure("Ready, but the image service returned no picture link");
      const img = await fetch(sampleUrl);
      if (!img.ok) throw new Error(`The image could not be downloaded from the image service (HTTP ${img.status})`);
      const bytes = new Uint8Array(await img.arrayBuffer());
      log({ event: "ready", taskId, bytes: bytes.length });
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(binary);
    }
    if (FAILED_STATUSES.includes(data?.status)) {
      throw new BflFailure(bflReason(data.status, data?.details));
    }
  }
  throw new Error("The image service timed out");
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
  if (!isBase64(body.image) || !isBase64(body.mask)) return badRequest("image and mask must be base64 PNG");
  if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > MAX_PROMPT_CHARS) {
    return badRequest("prompt is required (800 characters at most)");
  }
  const seed = Number.isInteger(body.seed) ? (body.seed as number) : 1;

  const key = Deno.env.get("BFL_API_KEY");
  if (!key) {
    log({ event: "config_missing", detail: "BFL_API_KEY is not set in Supabase secrets" });
    return serverError("The image service key is not configured");
  }

  log({ event: "start", seed, imageChars: body.image.length, maskChars: body.mask.length, promptChars: body.prompt.length });
  let taskId: string | null = null;
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
    const submitText = await submit.text();
    if (!submit.ok) {
      log({ event: "submit_failed", httpStatus: submit.status, taskId: null, reason: submitText.slice(0, 300) });
      return serverError(`The image service refused the request (HTTP ${submit.status}): ${submitText.slice(0, 200)}`.trim());
    }
    let job: { id?: string; polling_url?: string } = {};
    try {
      job = JSON.parse(submitText);
    } catch {
      // Handled below.
    }
    if (!job?.polling_url) {
      log({ event: "submit_no_task", httpStatus: submit.status, reason: submitText.slice(0, 300) });
      return serverError("The image service accepted the request but returned no task");
    }
    taskId = job.id ?? null;
    log({ event: "submitted", taskId, httpStatus: submit.status });
    const png = await pollUntilReady(taskId ?? "", job.polling_url, key);
    return ok({ png });
  } catch (e) {
    const message = (e as Error).message || "The image service failed";
    log({ event: "failed", taskId, reason: message, from_bfl: e instanceof BflFailure });
    return serverError(message);
  }
});

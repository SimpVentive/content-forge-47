// POST /worker-gateway. The only way the Render worker reaches Supabase.
// Headers: X-Worker-Pass (the worker pass) and Authorization: Bearer <public anon key> (needed when verify_jwt is on).
// Body: { op, job_id?, claim_token?, ... }. The operations are listed in paths.ts. Any other op is refused.
// No CORS headers on purpose: browsers may not call this. Requests that carry an Origin header are refused.
// Never log the request body, the pass, the claim token or a signed URL.

import { adminClient } from "../_shared/supabase.ts";
import {
  cachePrefix,
  clampVoiceSettings,
  clipsPrefix,
  constantTimeEqual,
  costFromReport,
  base64Url,
  isClaimToken,
  isKnownOp,
  isUuid,
  LINK_TTL_SECONDS,
  MAX_FAIL_CHARS,
  MAX_NAMES_PER_REQUEST,
  MAX_PROGRESS_CHARS,
  outputPaths,
  safeName,
  sanitizeMessage,
} from "./paths.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const denied = () => json(401, { error: "unauthorized" });
const forbidden = () => json(403, { error: "not allowed" });
const conflict = () => json(409, { error: "job is not in the right state" });
const badRequest = () => json(400, { error: "bad request" });

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Checks the X-Worker-Pass header against WORKER_PASS and WORKER_PASS_NEXT (both are hashed and compared in constant time). */
async function checkPass(req: Request): Promise<"ok" | "unauthorized" | "unconfigured"> {
  const current = Deno.env.get("WORKER_PASS") ?? "";
  const next = Deno.env.get("WORKER_PASS_NEXT") ?? "";
  if (!current && !next) return "unconfigured";
  const given = await sha256Hex(req.headers.get("x-worker-pass") ?? "");
  let ok = false;
  for (const candidate of [current, next]) {
    if (!candidate) continue;
    const expected = await sha256Hex(candidate);
    if (constantTimeEqual(given, expected)) ok = true;
  }
  return ok ? "ok" : "unauthorized";
}

/** Finds the job for a claim. Only the holder of the right token gets through. */
async function claimedJob(admin: Admin, body: Record<string, unknown>) {
  if (!isUuid(body.job_id) || !isClaimToken(body.claim_token)) return { failure: badRequest() };
  const { data: claim } = await admin.from("module_job_claims").select("token_hash").eq("job_id", body.job_id).maybeSingle();
  if (!claim) return { failure: forbidden() };
  const given = await sha256Hex(body.claim_token);
  if (!constantTimeEqual(given, claim.token_hash)) return { failure: forbidden() };
  const { data: job } = await admin
    .from("module_jobs")
    .select("id, owner_user_id, trainer_id, team_id, status, script_text")
    .eq("id", body.job_id)
    .maybeSingle();
  if (!job) return { failure: forbidden() };
  if (job.status !== "generating") return { failure: conflict() };
  return { job };
}

/** Stops the job with a short message and releases the claim. Only acts while the job is generating. */
async function failJob(admin: Admin, jobId: string, message: string): Promise<boolean> {
  const text = sanitizeMessage(message, MAX_FAIL_CHARS);
  const { data } = await admin
    .from("module_jobs")
    .update({ status: "failed", progress: "Failed", error: text, progress_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "generating")
    .select("id");
  if (!data || data.length === 0) return false;
  await admin.from("module_job_events").insert({ job_id: jobId, status: "failed", message: text });
  await admin.from("module_job_claims").delete().eq("job_id", jobId);
  return true;
}

/** Consent is checked again before any generation step. If it has been withdrawn, the job fails. */
async function consentStillRecorded(admin: Admin, job: { id: string; trainer_id: string }) {
  const { data: trainer } = await admin
    .from("custom_trainers")
    .select("owner_user_id, deleted_at")
    .eq("id", job.trainer_id)
    .maybeSingle();
  if (!trainer || trainer.deleted_at) {
    await failJob(admin, job.id, "The trainer is no longer available.");
    return false;
  }
  const { count } = await admin
    .from("custom_trainer_consents")
    .select("id", { count: "exact", head: true })
    .eq("trainer_id", job.trainer_id)
    .eq("owner_user_id", trainer.owner_user_id)
    .not("consent_audio_path", "is", null);
  if (!count) {
    await failJob(admin, job.id, "Consent is no longer recorded for this trainer.");
    return false;
  }
  return true;
}

async function trainerRecord(admin: Admin, trainerId: string) {
  const { data } = await admin
    .from("custom_trainers")
    .select("owner_user_id, voice_id, voice_status, voice_settings")
    .eq("id", trainerId)
    .maybeSingle();
  return data;
}

async function signedDownloads(admin: Admin, bucket: string, prefix: string, keep: (name: string) => boolean) {
  const { data: listing } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  const names = (listing ?? [])
    .filter((o: { id: string | null }) => o.id !== null)
    .map((o: { name: string }) => safeName(o.name))
    .filter((n: string | null): n is string => n !== null && keep(n));
  const out: { name: string; url: string }[] = [];
  for (const name of names) {
    const { data } = await admin.storage.from(bucket).createSignedUrl(`${prefix}/${name}`, LINK_TTL_SECONDS);
    if (data?.signedUrl) out.push({ name, url: data.signedUrl });
  }
  return out;
}

async function signedUpload(admin: Admin, bucket: string, path: string): Promise<string | null> {
  const { data } = await admin.storage.from(bucket).createSignedUploadUrl(path, { upsert: true });
  return data?.signedUrl ?? null;
}

async function opClaim(admin: Admin) {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = base64Url(bytes);
  const { data: jobId, error } = await admin.rpc("claim_next_module_job", { p_token_hash: await sha256Hex(token) });
  if (error) return json(500, { error: "server error" });
  if (!jobId) return json(200, { job: null });
  return json(200, { job_id: jobId, claim_token: token });
}

async function opInputs(admin: Admin, body: Record<string, unknown>) {
  const { job, failure } = await claimedJob(admin, body);
  if (failure) return failure;
  if (!(await consentStillRecorded(admin, job))) return conflict();
  const trainer = await trainerRecord(admin, job.trainer_id);
  if (!trainer?.voice_id || trainer.voice_status !== "ready") {
    await failJob(admin, job.id, "The trainer's voice is not ready.");
    return conflict();
  }
  return json(200, {
    script_text: job.script_text,
    trainer: { voice_id: trainer.voice_id, voice_settings: clampVoiceSettings(trainer.voice_settings) },
  });
}

async function opLinksDownload(admin: Admin, body: Record<string, unknown>) {
  const { job, failure } = await claimedJob(admin, body);
  if (failure) return failure;
  if (!(await consentStillRecorded(admin, job))) return conflict();
  const trainer = await trainerRecord(admin, job.trainer_id);
  if (!trainer) return conflict();
  const owner = trainer.owner_user_id;
  const clips = await signedDownloads(admin, "trainer-clips", clipsPrefix(owner, job.trainer_id), (n) => /\.mp4$/i.test(n));
  const cache = await signedDownloads(admin, "module-cache", cachePrefix(owner, job.trainer_id), () => true);
  return json(200, { clips, cache });
}

async function opLinksUpload(admin: Admin, body: Record<string, unknown>) {
  const { job, failure } = await claimedJob(admin, body);
  if (failure) return failure;
  if (!(await consentStillRecorded(admin, job))) return conflict();
  const trainer = await trainerRecord(admin, job.trainer_id);
  if (!trainer) return conflict();

  const names = Array.isArray(body.names) ? body.names : [];
  if (names.length > MAX_NAMES_PER_REQUEST) return badRequest();
  const cleanNames = names.map(safeName);
  if (cleanNames.some((n) => n === null)) return badRequest();

  const outputs = outputPaths(trainer.owner_user_id, job.id);
  const outputLinks = {
    final: await signedUpload(admin, "generated-videos", outputs.final),
    proof: await signedUpload(admin, "generated-videos", outputs.proof),
    report: await signedUpload(admin, "generated-videos", outputs.report),
  };
  const cache: { name: string; url: string }[] = [];
  for (const name of cleanNames as string[]) {
    const url = await signedUpload(admin, "module-cache", `${cachePrefix(trainer.owner_user_id, job.trainer_id)}/${name}`);
    if (url) cache.push({ name, url });
  }
  return json(200, { outputs: outputLinks, cache });
}

async function opProgress(admin: Admin, body: Record<string, unknown>) {
  const { job, failure } = await claimedJob(admin, body);
  if (failure) return failure;
  const text = sanitizeMessage(body.message, MAX_PROGRESS_CHARS);
  const { data } = await admin
    .from("module_jobs")
    .update({ progress: text, progress_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("status", "generating")
    .select("id");
  if (!data || data.length === 0) return conflict();
  return json(200, { ok: true });
}

async function opComplete(admin: Admin, body: Record<string, unknown>) {
  const { job, failure } = await claimedJob(admin, body);
  if (failure) return failure;
  const trainer = await trainerRecord(admin, job.trainer_id);
  if (!trainer) return conflict();
  const paths = outputPaths(trainer.owner_user_id, job.id);
  const folder = `${trainer.owner_user_id}/${job.id}`;
  const { data: listing } = await admin.storage.from("generated-videos").list(folder, { limit: 100 });
  const present = new Set((listing ?? []).map((o: { name: string }) => o.name));
  if (!present.has("final.mp4") || !present.has("proof.mp4") || !present.has("run_report.json")) {
    await failJob(admin, job.id, "The outputs were not uploaded.");
    return conflict();
  }
  const { data: reportFile } = await admin.storage.from("generated-videos").download(paths.report);
  let cost: number | null = null;
  try {
    cost = costFromReport(JSON.parse(await reportFile.text()));
  } catch {
    cost = null;
  }
  const { data } = await admin
    .from("module_jobs")
    .update({
      status: "ready_for_review",
      progress: "Ready for review",
      output_path: paths.final,
      proof_path: paths.proof,
      report_path: paths.report,
      cost_usd: cost,
      progress_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "generating")
    .select("id");
  if (!data || data.length === 0) return conflict();
  await admin.from("module_job_events").insert({
    job_id: job.id,
    status: "ready_for_review",
    message: "Generated and labelled. Waiting for review.",
  });
  await admin.from("module_job_claims").delete().eq("job_id", job.id);
  return json(200, { ok: true, status: "ready_for_review" });
}

async function opFail(admin: Admin, body: Record<string, unknown>) {
  const { job, failure } = await claimedJob(admin, body);
  if (failure) return failure;
  const done = await failJob(admin, job.id, sanitizeMessage(body.message, MAX_FAIL_CHARS));
  return done ? json(200, { ok: true, status: "failed" }) : conflict();
}

Deno.serve(async (req) => {
  if (req.headers.has("origin")) return denied();
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const pass = await checkPass(req);
  if (pass === "unconfigured") return json(503, { error: "not configured" });
  if (pass !== "ok") return denied();

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return badRequest();
    body = parsed as Record<string, unknown>;
  } catch {
    return badRequest();
  }
  if (!isKnownOp(body.op)) return json(404, { error: "unknown operation" });

  const admin = adminClient();
  try {
    switch (body.op) {
      case "claim": return await opClaim(admin);
      case "inputs": return await opInputs(admin, body);
      case "links_download": return await opLinksDownload(admin, body);
      case "links_upload": return await opLinksUpload(admin, body);
      case "progress": return await opProgress(admin, body);
      case "complete": return await opComplete(admin, body);
      case "fail": return await opFail(admin, body);
    }
  } catch {
    // The error is not logged: it can contain request data.
    return json(500, { error: "server error" });
  }
  return json(404, { error: "unknown operation" });
});

// POST /module-job-create
// Body: { team_id, trainer_id, script_text }
// Auth: Bearer user JWT. Only team creators and admins may create a job.
// Blocks: trainer not in the team, consent not recorded, voice not ready, estimate over the cap, too many running jobs.
// Writes one queued job. The worker picks it up. No keys are used or returned here.

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError, methodNotAllowed } from "../_shared/responses.ts";
import { getAuthedUser, AuthError } from "../_shared/auth.ts";
import { adminClient } from "../_shared/supabase.ts";
import { estimateUsd, MAX_CONCURRENT_JOBS_PER_USER, MAX_SCRIPT_CHARS } from "../_shared/module-jobs.ts";
import { jobCapUsd } from "../_shared/job-cap.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return methodNotAllowed("POST");

  let user;
  try {
    ({ user } = await getAuthedUser(req));
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    return serverError("Auth failure");
  }

  let body: { team_id?: string; trainer_id?: string; script_text?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const teamId = String(body.team_id || "");
  const trainerId = String(body.trainer_id || "");
  const script = String(body.script_text || "").trim();
  if (!UUID.test(teamId) || !UUID.test(trainerId)) return badRequest("team_id and trainer_id must be ids");
  if (!script) return badRequest("script_text is empty");
  if (script.length > MAX_SCRIPT_CHARS) return badRequest(`script_text is over ${MAX_SCRIPT_CHARS} characters`);

  const admin = adminClient();

  // 1. Role in the team
  const { data: membership } = await admin
    .from("team_members").select("role").eq("team_id", teamId).eq("user_id", user.id).maybeSingle();
  if (!membership) return forbidden("You are not a member of this team.");
  if (!["creator", "admin"].includes(membership.role)) {
    return forbidden("Only creators and admins can generate trainer videos.");
  }

  // 2. Trainer in the same team, with consent and a ready voice
  const { data: trainer } = await admin
    .from("custom_trainers")
    .select("id, team_id, consent_recorded, voice_status, base_clip_count, deleted_at")
    .eq("id", trainerId).maybeSingle();
  if (!trainer || trainer.deleted_at) return notFound("Trainer not found.");
  if (trainer.team_id !== teamId) return forbidden("This trainer is not in your team.");
  if (!trainer.consent_recorded) return forbidden("Consent is not recorded for this trainer. Generation is blocked.");
  if (trainer.voice_status !== "ready") return badRequest("The trainer's voice is not ready yet.");
  if (!(trainer.base_clip_count > 0)) return badRequest("No base clips are uploaded for this trainer yet.");

  // 3. Estimate and hard cap per job
  const estimate = estimateUsd(script);
  const cap = jobCapUsd();
  if (estimate > cap) {
    return badRequest(`The estimate ($${estimate.toFixed(2)}) is over the per-job cap ($${cap.toFixed(2)}).`);
  }

  // 4. Concurrency per user
  const { count } = await admin
    .from("module_jobs").select("id", { count: "exact", head: true })
    .eq("owner_user_id", user.id).in("status", ["queued", "generating"]);
  if ((count ?? 0) >= MAX_CONCURRENT_JOBS_PER_USER) {
    return badRequest(`You already have ${MAX_CONCURRENT_JOBS_PER_USER} jobs running. Wait for one to finish.`);
  }

  // 5. Queue the job
  const { data: job, error } = await admin
    .from("module_jobs")
    .insert({
      team_id: teamId, owner_user_id: user.id, trainer_id: trainerId, script_text: script,
      status: "queued", progress: "Waiting for the worker", estimate_usd: estimate,
    })
    .select("id, status, estimate_usd, created_at").single();
  if (error || !job) return serverError("The job could not be queued.");
  await admin.from("module_job_events").insert({
    job_id: job.id, status: "queued", message: `Estimate $${estimate.toFixed(2)}`,
  });
  return ok(job);
});

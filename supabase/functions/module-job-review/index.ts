// POST /module-job-review
// Body: { job_id, action: "sign" | "approve" | "reject" }
// Auth: Bearer user JWT. Team members may view (sign) a job's proof video.
// Only team creators and admins may approve or reject, and only a job that is ready for review.
// Nothing is published without an explicit approve.

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError, methodNotAllowed } from "../_shared/responses.ts";
import { getAuthedUser, AuthError } from "../_shared/auth.ts";
import { adminClient } from "../_shared/supabase.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGN_SECONDS = 600;

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

  let body: { job_id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const jobId = String(body.job_id || "");
  const action = String(body.action || "");
  if (!UUID.test(jobId)) return badRequest("job_id must be an id");
  if (!["sign", "approve", "reject"].includes(action)) return badRequest("action must be sign, approve or reject");

  const admin = adminClient();
  const { data: job } = await admin
    .from("module_jobs").select("id, team_id, status, output_path, proof_path").eq("id", jobId).maybeSingle();
  if (!job) return notFound("Job not found.");

  const { data: membership } = await admin
    .from("team_members").select("role").eq("team_id", job.team_id).eq("user_id", user.id).maybeSingle();
  if (!membership) return forbidden("You are not a member of this team.");

  if (action === "sign") {
    if (!job.proof_path) return badRequest("The proof video is not ready.");
    const { data, error } = await admin.storage.from("generated-videos").createSignedUrl(job.proof_path, SIGN_SECONDS);
    if (error || !data) return serverError("The video link could not be made.");
    return ok({ url: data.signedUrl, expires_in_seconds: SIGN_SECONDS });
  }

  if (!["creator", "admin"].includes(membership.role)) {
    return forbidden("Only creators and admins can approve or reject.");
  }
  if (job.status !== "ready_for_review") return badRequest(`This job is ${job.status}, not ready for review.`);

  const now = new Date().toISOString();
  const next = action === "approve" ? "published" : "rejected";
  const patch: Record<string, unknown> = { status: next, reviewed_by: user.id, reviewed_at: now, updated_at: now };
  if (next === "published") patch.published_at = now;
  const { error } = await admin.from("module_jobs").update(patch).eq("id", jobId).eq("status", "ready_for_review");
  if (error) return serverError("The review could not be saved.");
  await admin.from("module_job_events").insert({
    job_id: jobId, status: next, message: `Reviewed by a team ${membership.role}`,
  });
  return ok({ id: jobId, status: next });
});

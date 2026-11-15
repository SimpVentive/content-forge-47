// POST /trainer-attach-team
// Body: { trainer_id, team_id }
// Auth: Bearer user JWT. The caller must own the trainer AND be a creator or admin of the team.
// The team is set with the service role, because the database guard refuses browser changes to team_id.

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError, methodNotAllowed } from "../_shared/responses.ts";
import { getAuthedUser, AuthError } from "../_shared/auth.ts";
import { adminClient } from "../_shared/supabase.ts";

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

  let body: { trainer_id?: string; team_id?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const trainerId = String(body.trainer_id || "");
  const teamId = String(body.team_id || "");
  if (!UUID.test(trainerId) || !UUID.test(teamId)) return badRequest("trainer_id and team_id must be ids");

  const admin = adminClient();
  const { data: trainer } = await admin
    .from("custom_trainers").select("id, owner_user_id, deleted_at").eq("id", trainerId).maybeSingle();
  if (!trainer || trainer.deleted_at) return notFound("Trainer not found.");
  if (trainer.owner_user_id !== user.id) return forbidden("Only the trainer's owner can add it to a team.");

  const { data: membership } = await admin
    .from("team_members").select("role").eq("team_id", teamId).eq("user_id", user.id).maybeSingle();
  if (!membership || !["creator", "admin"].includes(membership.role)) {
    return forbidden("You must be a creator or admin of the team.");
  }

  const { error } = await admin.from("custom_trainers").update({ team_id: teamId }).eq("id", trainerId);
  if (error) return serverError("The trainer could not be added to the team.");
  return ok({ trainer_id: trainerId, team_id: teamId });
});
